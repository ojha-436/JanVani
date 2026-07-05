#!/usr/bin/env python3
"""
One-time/periodic import of Delhi district-level education statistics from
data.gov.in into our own database. Government data isn't fetched live on
every dashboard request — it's pulled in here, stored, and the evidence
engine reads from our own table.

Run locally (needs DATABASE_URL + GOV_DATA_API_KEY env vars):
    export DATABASE_URL=...
    export GOV_DATA_API_KEY=$(firebase functions:secrets:access GOV_DATA_API_KEY --project vipasana-499205)
    python scripts/import_gov_education.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import urllib.request
import json

from app.database import _get_session_factory
from app.models.gov_education_stat import GovEducationStat

RESOURCE_ID = "97adce0c-89a8-4f1e-a0f8-b66655136565"


def fetch_records() -> list[dict]:
    api_key = os.environ["GOV_DATA_API_KEY"]
    url = f"https://api.data.gov.in/resource/{RESOURCE_ID}?api-key={api_key}&format=json&limit=100"
    # api.data.gov.in hangs (never responds) against Python's default
    # urllib User-Agent — a curl-like one works fine.
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.0", "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())
    return data.get("records", [])


def main() -> None:
    records = fetch_records()
    print(f"Fetched {len(records)} district records")

    db = _get_session_factory()()
    imported = 0
    for r in records:
        district = r.get("district")
        if not district:
            continue

        stat = db.get(GovEducationStat, district)
        if stat is None:
            stat = GovEducationStat(district=district)
            db.add(stat)

        stat.schools_total = _to_int(r.get("no_of_schools___total"))
        stat.students_total = _to_int(r.get("no_of_students___total"))
        stat.pass_pct_class_x = _to_float(r.get("pass_percentage_in_class_x___before_compt____2023_24"))
        stat.pass_pct_class_xii = _to_float(r.get("pass_percentage_in_class_xii___before_compt___2023_24"))
        imported += 1

    db.commit()
    print(f"Imported/updated {imported} districts")


def _to_int(v) -> int | None:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    main()
