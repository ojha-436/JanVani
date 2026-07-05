#!/usr/bin/env python3
"""
Seeds realistic-looking demo complaints for a hackathon walkthrough — never
run this against a real production database with real citizen data.

Generates complaints clustered around a handful of geographic hotspots
(for the map + consensus graph to have something to show) with a growth
curve skewed toward recent dates (so evidence.py's last-30-vs-prev-30
signal shows a realistic spike, not flat noise).

Deliberately makes zero Gemini calls — this is fake data, so paying for
AI transcription/vision on it would be pure waste. Verification scores are
computed in-memory using the same duplicate-corroboration signal as
verify_complaint(), just batched instead of one DB round-trip per row.

Run locally (needs DATABASE_URL pointing at the target database):
    export DATABASE_URL=...
    python scripts/seed_demo_data.py --constituency "New Delhi" --count 5000

--constituency MUST exactly match the `constituency` value already set on
the MP account you'll sign in as for the demo (see MPAllowlistEntry /
tools/admin_cli.py) — otherwise the dashboard will show zero complaints.

To remove the seeded data after the demo:
    python scripts/seed_demo_data.py --constituency "New Delhi" --delete

Cleanup is safe and precise because seeded rows are the only complaints
with user_id IS NULL — every real complaint always has a user_id, set
server-side from the authenticated submitter (see api/complaints.py), so
this can never accidentally match a real citizen's complaint.
"""
import argparse
import os
import random
import sys
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import delete

from app.database import _get_session_factory
from app.models.complaint import Complaint
from app.models import user  # noqa: F401 — registers "users" table so Complaint.user_id's FK resolves

CATEGORIES = ["Roads", "Water Supply", "Education", "Healthcare", "Electricity", "Sanitation", "Public Safety"]

TEMPLATES = {
    "Roads": [
        "The road in our area has been broken for months, full of potholes.",
        "No streetlights on the main road, very unsafe at night.",
        "Road construction started but never finished, blocking traffic.",
    ],
    "Water Supply": [
        "We haven't had regular water supply for over two weeks.",
        "The water that comes through the pipeline is dirty and unsafe to drink.",
        "Borewell in our locality has dried up, need urgent help.",
    ],
    "Education": [
        "Our government school doesn't have enough teachers.",
        "Children have to travel very far because there's no school nearby.",
        "The school building is in poor condition and needs repair.",
    ],
    "Healthcare": [
        "The local health center doesn't have a doctor most days.",
        "No ambulance service available in our village.",
        "Medicines are often out of stock at the government dispensary.",
    ],
    "Electricity": [
        "Frequent power cuts, sometimes for 6-8 hours a day.",
        "Transformer near our street has been faulty for weeks.",
        "New connections have been pending for over a year.",
    ],
    "Sanitation": [
        "Garbage hasn't been collected in our area for over a week.",
        "Open drains near the school pose a health risk to children.",
        "No public toilets in this locality, causing serious problems.",
    ],
    "Public Safety": [
        "Street lighting is very poor, women don't feel safe walking at night.",
        "Frequent thefts reported in this area, need more police patrolling.",
        "No CCTV cameras installed despite repeated requests.",
    ],
}

LOCATIONS = ["Sector 12", "Rampur Colony", "Shivpur", "Gandhi Nagar", "Model Town", "Old City", "New Basti", "Krishna Vihar"]


def make_hotspots(center_lat: float, center_lng: float, n: int):
    return [
        (center_lat + random.uniform(-0.05, 0.05), center_lng + random.uniform(-0.05, 0.05), random.choice(LOCATIONS))
        for _ in range(n)
    ]


def weighted_days_ago(max_days: int = 180) -> int:
    return int(max_days * (random.random() ** 2.2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--constituency", required=True, help="Must match an existing MP account's constituency")
    parser.add_argument("--count", type=int, default=5000)
    parser.add_argument("--center-lat", type=float, default=28.6139, help="Default: central Delhi")
    parser.add_argument("--center-lng", type=float, default=77.2090)
    parser.add_argument("--hotspots", type=int, default=6)
    parser.add_argument("--delete", action="store_true", help="Delete previously seeded demo data instead of adding more")
    args = parser.parse_args()

    if args.delete:
        db = _get_session_factory()()
        result = db.execute(
            delete(Complaint).where(Complaint.user_id.is_(None), Complaint.constituency == args.constituency)
        )
        db.commit()
        print(f"Deleted {result.rowcount} demo complaints for constituency={args.constituency!r}")
        return

    hotspots = make_hotspots(args.center_lat, args.center_lng, args.hotspots)
    now = datetime.now(timezone.utc)

    complaints = []
    for _ in range(args.count):
        category = random.choice(CATEGORIES)
        lat_c, lng_c, location = random.choice(hotspots)
        created_at = now - timedelta(days=weighted_days_ago(), hours=random.randint(0, 23))

        complaints.append(
            Complaint(
                id=uuid.uuid4(),
                text=random.choice(TEMPLATES[category]),
                locale="en",
                category=category,
                location=location,
                lat=lat_c + random.uniform(-0.006, 0.006),
                lng=lng_c + random.uniform(-0.006, 0.006),
                anonymous=random.random() < 0.3,
                status="new",
                created_at=created_at,
                constituency=args.constituency,
            )
        )

    # Duplicate-corroboration signal, same weighting as verify_complaint(),
    # computed once over the in-memory batch instead of a query per row.
    counts = Counter((c.category, c.location) for c in complaints)
    for c in complaints:
        nearby = counts[(c.category, c.location)] - 1
        score = min(100, min(30, nearby * 3) + 15)
        c.verification_confidence = score
        c.verification_status = "Strong" if score >= 70 else "Moderate" if score >= 40 else "Weak"
        c.verification_reasons = [f"{nearby} other complaint(s) reported nearby in the same category"]

    db = _get_session_factory()()
    db.bulk_save_objects(complaints)
    db.commit()
    print(f"Seeded {len(complaints)} demo complaints for constituency={args.constituency!r}")


if __name__ == "__main__":
    main()
