import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/firebaseAdmin";
import { inviteLink, type MpAllocation } from "@/lib/mp";
import { resolveConstituency } from "@/lib/constituencies";
import { requireAdmin } from "@/lib/security/auth";

/* ------------------------------------------------------------------
   Bulk MP provisioning (admin).

   GET  /api/mp/bulk?template=csv|xlsx  → downloadable template.
   POST /api/mp/bulk (multipart: adminKey + file)  → creates/updates one
        MP allocation per row and returns each row's invite link or error.

   Columns (header row required): email*  name  constituency*
   Constituency must be an official Lok Sabha constituency (same list the
   citizen picks), so every provisioned MP maps to a routable dashboard.
   ------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 500;

const TEMPLATE_HEADERS = ["email", "name", "constituency"];
const TEMPLATE_ROWS = [
  ["mp.nawada@example.gov.in", "Hon'ble MP — Nawada", "Nawada"],
  ["mp.gaya@example.gov.in", "Hon'ble MP — Gaya", "Gaya (SC)"],
];

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("template") === "xlsx" ? "xlsx" : "csv";

  if (format === "csv") {
    const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS]
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
      .join("\r\n");
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="janvaani-mp-accounts-template.csv"' },
    });
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("MP accounts");
  ws.addRow(TEMPLATE_HEADERS);
  ws.getRow(1).font = { bold: true };
  TEMPLATE_ROWS.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c, i) => (c.width = i === 1 ? 30 : 28));
  const help = wb.addWorksheet("Instructions");
  [
    ["JanVaani — bulk MP account provisioning"],
    [""],
    ["email", "REQUIRED. The email the MP signs in with."],
    ["name", "Optional. Display name."],
    ["constituency", "REQUIRED. Official Lok Sabha constituency name exactly as listed (e.g. Nawada, Gaya (SC), Patna Sahib)."],
    [""],
    ["Each row creates a one-time invite link (returned after upload) to send to the MP.", ""],
    ["Re-uploading an email updates that MP's allocation.", ""],
    [`Up to ${MAX_ROWS} rows per file.`, ""],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).width = 22;
  help.getColumn(2).width = 90;
  help.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="janvaani-mp-accounts-template.xlsx"',
    },
  });
}

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, reason: "no-db", note: "Provisioning needs the live database." }, { status: 200 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected a multipart upload." }, { status: 400 });
  }
  if (!requireAdmin(req, String(form.get("adminKey") ?? ""))) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No file uploaded (field: file)." }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");
    const table = isXlsx ? await parseXlsx(buf) : parseCsv(buf.toString("utf8"));
    if (table.length < 2) return NextResponse.json({ ok: false, error: "File has no data rows." }, { status: 400 });

    const headers = table[0].map((h) => h.toLowerCase().replace(/[\s_*]/g, ""));
    const col = (names: string[]) => headers.findIndex((h) => names.includes(h));
    const idx = { email: col(["email", "mpemail"]), name: col(["name", "mpname"]), constituency: col(["constituency", "pc", "loksabha"]) };
    if (idx.email === -1 || idx.constituency === -1) {
      return NextResponse.json({ ok: false, error: 'Missing required columns "email" and "constituency".' }, { status: 400 });
    }

    // Existing allocations by email → reuse their token on re-upload.
    const existing = new Map<string, MpAllocation>();
    (await db.collection("mpAccounts").get()).forEach((d) => {
      const r = d.data() as MpAllocation;
      existing.set(r.email, r);
    });

    const now = new Date().toISOString();
    const rows = table.slice(1, 1 + MAX_ROWS);
    const results: { row: number; email: string; constituency?: string; ok: boolean; link?: string; error?: string }[] = [];
    const batch = db.batch();
    let writes = 0;

    rows.forEach((cells, i) => {
      const rowNum = i + 2;
      const get = (j: number) => (j >= 0 && j < cells.length ? String(cells[j] ?? "").trim() : "");
      const email = get(idx.email).toLowerCase();
      const name = get(idx.name);
      const cRaw = get(idx.constituency);

      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        results.push({ row: rowNum, email, ok: false, error: "invalid email" });
        return;
      }
      const resolved = resolveConstituency(cRaw);
      if (!resolved) {
        results.push({ row: rowNum, email, ok: false, error: `unknown constituency "${cRaw}"` });
        return;
      }
      const prior = existing.get(email);
      const token = prior?.inviteToken ?? randomUUID().replace(/-/g, "");
      const rec: MpAllocation = {
        inviteToken: token,
        email,
        name,
        constituency: resolved.name,
        status: prior?.status === "active" ? "active" : "invited",
        createdAt: prior?.createdAt ?? now,
        activatedAt: prior?.activatedAt ?? null,
        revokedAt: null,
      };
      batch.set(db.collection("mpAccounts").doc(token), rec);
      writes++;
      results.push({ row: rowNum, email, constituency: resolved.name, ok: true, link: inviteLink(token) });
    });

    if (writes > 0) await batch.commit();
    const created = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, created, failed: results.length - created, truncated: Math.max(0, table.length - 1 - MAX_ROWS), results });
  } catch (err) {
    console.error("mp bulk error", err);
    return NextResponse.json({ ok: false, error: "Could not parse the file. Use the provided template." }, { status: 400 });
  }
}

/* ---------- parsers (compact, quote-aware CSV + first-sheet XLSX) ---------- */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      const v = row.getCell(c).value;
      cells.push(v == null ? "" : typeof v === "object" ? String((v as { text?: string; result?: unknown }).text ?? (v as { result?: unknown }).result ?? "") : String(v));
    }
    rows.push(cells);
  });
  return rows;
}
