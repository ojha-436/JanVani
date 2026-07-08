import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getDb } from "@/lib/firebaseAdmin";
import { geocodeToArea } from "@/lib/ai";
import { AREA_NAMES } from "@/lib/publicData";
import { recomputeAndStore } from "@/lib/recompute";

/* ------------------------------------------------------------------
   Bulk complaint ingestion for the MP dashboard.

   GET  /api/bulk?template=csv|xlsx → downloadable upload template.
   POST /api/bulk (multipart, field "file", .csv or .xlsx)
        → validates each row, writes them as normal `submissions`
          (channel: "bulk"), then refreshes rankings/latest — so bulk
          rows rank, map and drill down exactly like citizen voices.

   Template columns (header row required, any order, extra cols ignored):
     complaint*  category  area  location  latitude  longitude
     urgency (0–1 or 0–100)  date (YYYY-MM-DD)  citizen_name
   Only `complaint` is required per row.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_ROWS = 1000;
const SALT = process.env.SUBMISSION_SALT || "janvaani-dev-salt";

const CATEGORIES = ["Roads & transport", "Water & sanitation", "Education", "Health", "Electricity", "Livelihood", "Other"];

const TEMPLATE_HEADERS = ["complaint", "category", "area", "location", "latitude", "longitude", "urgency", "date", "citizen_name"];
const TEMPLATE_ROWS = [
  ["Handpump near the primary school has been dry for two months", "Water & sanitation", "Meskaur", "Ward 4, near primary school", "24.702", "85.66", "0.8", "2026-06-15", ""],
  ["Road to the block office floods every monsoon", "Roads & transport", "Rajauli", "Main road, Rajauli bazar", "", "", "70", "2026-06-20", "Ramesh Yadav"],
];

/* ================= GET — template download ================= */

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("template") === "xlsx" ? "xlsx" : "csv";

  if (format === "csv") {
    const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS]
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="janvaani-bulk-template.csv"',
      },
    });
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Complaints");
  ws.addRow(TEMPLATE_HEADERS);
  ws.getRow(1).font = { bold: true };
  TEMPLATE_ROWS.forEach((r) => ws.addRow(r));
  ws.columns.forEach((col, i) => (col.width = i === 0 ? 55 : 18));

  const help = wb.addWorksheet("Instructions");
  [
    ["JanVaani bulk complaint upload — format"],
    [""],
    ["complaint", "REQUIRED. The citizen's need/complaint in plain words (any language)."],
    ["category", `One of: ${CATEGORIES.join(" | ")}. Anything else becomes "Other".`],
    ["area", `One of the constituency areas: ${AREA_NAMES.join(", ")}. Leave blank to auto-resolve from location/GPS.`],
    ["location", "Free text — village / ward / landmark."],
    ["latitude / longitude", "Optional GPS decimal degrees. Used for the demand map and area resolution."],
    ["urgency", "0–1 (e.g. 0.8) or 0–100 (e.g. 80). Default 0.6."],
    ["date", "YYYY-MM-DD (when the complaint was received). Default: upload time."],
    ["citizen_name", "Optional. If given, the row counts as a named (verified) complaint; blank = anonymous."],
    [""],
    [`Up to ${MAX_ROWS} rows per file. Extra columns are ignored. Rows without a complaint are skipped.`],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).width = 24;
  help.getColumn(2).width = 110;
  help.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="janvaani-bulk-template.xlsx"',
    },
  });
}

/* ================= POST — ingest a CSV/XLSX file ================= */

export async function POST(req: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, reason: "no-db", note: "Firestore not configured (demo mode)." }, { status: 200 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file uploaded (field name: file)." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");
    const table = isXlsx ? await parseXlsx(buf) : parseCsv(buf.toString("utf8"));

    if (table.length < 2) {
      return NextResponse.json({ ok: false, error: "File has no data rows (need a header row + at least one row)." }, { status: 400 });
    }

    const headers = table[0].map(normalizeHeader);
    const col = (names: string[]) => headers.findIndex((h) => names.includes(h));
    const idx = {
      text: col(["complaint", "text", "need", "description"]),
      category: col(["category"]),
      area: col(["area", "block"]),
      location: col(["location", "landmark", "address"]),
      lat: col(["latitude", "lat"]),
      lng: col(["longitude", "lng", "lon", "long"]),
      urgency: col(["urgency", "priority"]),
      date: col(["date", "createdat", "receivedon"]),
      name: col(["citizenname", "name", "citizen"]),
    };
    if (idx.text === -1) {
      return NextResponse.json(
        { ok: false, error: 'Missing required "complaint" column. Download the template for the expected format.' },
        { status: 400 }
      );
    }

    const dataRows = table.slice(1, 1 + MAX_ROWS);
    const truncated = table.length - 1 > MAX_ROWS ? table.length - 1 - MAX_ROWS : 0;

    const skipped: { row: number; reason: string }[] = [];
    const docs: { id: string; row: Record<string, unknown> }[] = [];
    const nowIso = new Date().toISOString();

    dataRows.forEach((cells, i) => {
      const rowNum = i + 2; // 1-based, after header
      const get = (j: number) => (j >= 0 && j < cells.length ? String(cells[j] ?? "").trim() : "");

      const text = get(idx.text);
      if (!text) {
        skipped.push({ row: rowNum, reason: "empty complaint" });
        return;
      }

      const rawCat = get(idx.category);
      const category = CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? "Other";

      const lat = parseFloat(get(idx.lat));
      const lng = parseFloat(get(idx.lng));
      const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

      const rawArea = get(idx.area);
      const area =
        AREA_NAMES.find((a) => a.toLowerCase() === rawArea.toLowerCase()) ??
        geocodeToArea(`${rawArea} ${get(idx.location)}`, coords);

      let urgency = parseFloat(get(idx.urgency));
      if (!Number.isFinite(urgency)) urgency = 0.6;
      else if (urgency > 1) urgency = Math.min(urgency, 100) / 100;
      urgency = Math.min(1, Math.max(0, urgency));

      const dateRaw = get(idx.date);
      const parsedDate = dateRaw ? Date.parse(dateRaw) : NaN;
      const createdAt = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : nowIso;

      const name = get(idx.name);
      const id = `sub_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

      docs.push({
        id,
        row: {
          id,
          createdAt,
          citizenKey: name
            ? "c_" + createHash("sha256").update(SALT + name).digest("hex").slice(0, 24)
            : `anon-${randomUUID()}`,
          channel: "bulk",
          locale: "en",
          category,
          subcategory: "",
          need_en: text,
          urgency,
          entities: [],
          area,
          rawTextPresent: true,
          hasAudio: false,
          hasPhoto: false,
          transcript: null,
          photoDescription: null,
          coords,
          location: get(idx.location) || rawArea || null,
          anonymous: !name,
          verifiedName: name || null,
          media: {},
        },
      });
    });

    if (docs.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid rows found.", skipped: skipped.slice(0, 20) }, { status: 400 });
    }

    // Firestore batches cap at 500 writes.
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + 400)) {
        batch.set(db.collection("submissions").doc(d.id), d.row);
      }
      await batch.commit();
    }

    // Refresh the dashboard snapshot so counts/hotspots/priorities update now.
    let recomputed = true;
    try {
      await recomputeAndStore(db, { withRationale: false });
    } catch (e) {
      recomputed = false;
      console.warn("[bulk] recompute failed:", (e as Error).message);
    }

    return NextResponse.json({
      ok: true,
      imported: docs.length,
      skipped: skipped.slice(0, 20),
      skippedCount: skipped.length,
      truncated,
      recomputed,
    });
  } catch (err) {
    console.error("bulk upload error", err);
    return NextResponse.json({ ok: false, error: "Could not parse the file. Use the provided CSV/Excel template." }, { status: 400 });
  }
}

/* ================= parsers ================= */

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-*]/g, "");
}

/** Quote-aware CSV parser (handles commas/newlines inside quoted fields). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** First worksheet of an .xlsx file → string table. */
async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // row.cellCount spans to the last used cell; col 1-based
    for (let c = 1; c <= row.cellCount; c++) {
      const v = row.getCell(c).value;
      cells.push(cellToString(v));
    }
    rows.push(cells);
  });
  return rows;
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("");
    if (typeof o.text === "string") return o.text;
    if (o.result != null) return cellToString(o.result);
    return "";
  }
  return String(v);
}
