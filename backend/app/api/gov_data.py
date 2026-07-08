"""MP-facing government-data ingest: upload a file (Excel/CSV/PDF) or pull
from a data.gov.in API resource. Both paths funnel through the same
pipeline: parse -> AI schema detection -> AI data-quality check -> Python
decides commit vs needs_review -> AI writes a plain-language summary.

The AI never decides whether data gets stored — see _ingest() below. It only
proposes a mapping and flags concerns; a fixed confidence threshold (in
Python) decides whether that mapping is trusted enough to commit."""

import json
import os
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import gemini_client, parsers
from app.app_check import verify_app_check
from app.database import get_db
from app.deps import get_current_mp
from app.models.gov_data_import import GovDataImport, GovDataRecord
from app.models.mp_allowlist import MPAllowlistEntry
from app.schemas.gov_data import ApiImportRequest, GovDataImportOut

router = APIRouter(prefix="/gov-data", tags=["gov-data"])

CONFIDENCE_THRESHOLD = 60


def _ingest(rows: list[dict], source_type: str, source_label: str, mp: MPAllowlistEntry, db: Session) -> GovDataImport:
    if not rows:
        raise HTTPException(status_code=400, detail="No rows found in the given data")

    mapping = gemini_client.detect_schema(rows)
    quality = gemini_client.assess_data_quality(rows, mapping)

    district_col = mapping.get("district_column")
    metric_cols = [c for c in mapping.get("metric_columns", []) if isinstance(c, str)]
    confidence = int(mapping.get("confidence") or 0)

    records: list[GovDataRecord] = []
    districts_seen: set[str] = set()
    for row in rows:
        metrics = {}
        for col in metric_cols:
            value = row.get(col)
            if value in (None, ""):
                continue
            metrics[col] = _coerce_number(value)
        if not metrics:
            continue
        district = str(row.get(district_col)).strip() if district_col and row.get(district_col) not in (None, "") else None
        if district:
            districts_seen.add(district)
        records.append(
            GovDataRecord(district=district, category=mapping.get("category", "other"), metrics=metrics)
        )

    trusted = confidence >= CONFIDENCE_THRESHOLD and quality.get("usable", False)
    status = "committed" if trusted and records else "needs_review"

    sample_metrics = records[0].metrics if records else {}
    explanation = gemini_client.explain_import(
        category=mapping.get("category", "other"),
        row_count=len(records) if status == "committed" else 0,
        district_count=len(districts_seen),
        sample_metrics=sample_metrics,
    )

    import_row = GovDataImport(
        mp_id=mp.id,
        source_type=source_type,
        source_label=source_label,
        detected_category=mapping.get("category"),
        field_mapping={"district_column": district_col, "metric_columns": metric_cols},
        confidence=confidence,
        status=status,
        row_count=len(records) if status == "committed" else 0,
        issues=quality.get("issues", []),
        explanation=explanation,
    )
    db.add(import_row)
    db.flush()

    if status == "committed":
        for record in records:
            record.import_id = import_row.id
            db.add(record)

    db.commit()
    db.refresh(import_row)
    return import_row


def _coerce_number(value):
    try:
        f = float(str(value).replace(",", "").strip())
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return str(value)


@router.post("/upload", response_model=GovDataImportOut, dependencies=[Depends(verify_app_check)])
async def upload_gov_data(file: UploadFile, mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        rows = parsers.parse_file(file.filename or "upload", content)
    except parsers.UnsupportedFileType as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse this file — check the format and try again")

    import_row = _ingest(rows, source_type="file", source_label=file.filename or "upload", mp=mp, db=db)
    return import_row


@router.post("/import-api", response_model=GovDataImportOut, dependencies=[Depends(verify_app_check)])
def import_from_api(payload: ApiImportRequest, mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    api_key = os.environ.get("GOV_DATA_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOV_DATA_API_KEY is not configured on the server")

    url = f"https://api.data.gov.in/resource/{payload.resource_id}?api-key={api_key}&format=json&limit=500"
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.0", "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach data.gov.in for this resource")

    rows = data.get("records", [])
    label = payload.label or payload.resource_id
    import_row = _ingest(rows, source_type="api", source_label=label, mp=mp, db=db)
    return import_row


@router.get("/imports", response_model=list[GovDataImportOut])
def list_imports(mp: MPAllowlistEntry = Depends(get_current_mp), db: Session = Depends(get_db)):
    imports = db.execute(
        select(GovDataImport).where(GovDataImport.mp_id == mp.id).order_by(GovDataImport.created_at.desc())
    ).scalars().all()
    return imports
