#!/usr/bin/env python3
"""
JanVaani admin CLI — the ONLY way to grant/revoke a citizen's MP role.

This tool must be run from the one machine that holds the local device
secret (~/.janvaani-admin/device.key). Losing that file means losing the
ability to manage MPs from this machine — use the recovery code (shown
once when the admin secrets were set up) to re-authorize a new device.

Note: email/phone are stored as one-way hashes, never in the clear — so
`list-mp` can only show the label you gave each entry, not the original
email/phone. Always pass a meaningful --label when creating an entry.

Usage:
    python admin_cli.py create-mp-account --email mp@example.gov.in --label "MP Name, Constituency"
    python admin_cli.py create-mp --email mp@example.gov.in --label "MP Name, Constituency"
    python admin_cli.py list-mp
    python admin_cli.py delete-mp --email mp@example.gov.in
"""
import argparse
import getpass
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.error
import urllib.request
from typing import Any

API_URL = "https://asia-south1-vipasana-499205.cloudfunctions.net/api"
DEVICE_KEY_PATH = os.path.expanduser("~/.janvaani-admin/device.key")


def load_device_secret() -> str:
    if not os.path.exists(DEVICE_KEY_PATH):
        raise SystemExit(
            f"Device secret not found at {DEVICE_KEY_PATH}.\n"
            "This machine is not authorized as the admin device."
        )
    with open(DEVICE_KEY_PATH) as f:
        return f.read().strip()


def admin_auth_fields() -> dict[str, Any]:
    device_secret = load_device_secret()
    email = input("Admin email: ").strip()
    password = getpass.getpass("Admin password: ")
    timestamp = str(int(time.time()))
    proof = hmac.new(device_secret.encode(), f"{email}:{timestamp}".encode(), hashlib.sha256).hexdigest()
    return {"email": email, "password": password, "timestamp": timestamp, "proof": proof}


def call_admin_api(path: str, payload: dict[str, Any]) -> Any:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{API_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Request failed ({e.code}): {e.read().decode()}")


def cmd_create_mp(args: argparse.Namespace) -> None:
    payload = admin_auth_fields()
    payload.update(
        mp_email=args.email, mp_phone=args.phone, label=args.label,
        constituency=args.constituency, district=args.district,
    )
    result = call_admin_api("/admin/mp-allowlist", payload)
    if result.get("added"):
        print(f"MP added to allowlist: {args.label or args.email or args.phone}")
    else:
        print("Unexpected response:", result)


def cmd_create_mp_account(args: argparse.Namespace) -> None:
    mp_password = args.mp_password or secrets.token_urlsafe(12)
    payload = admin_auth_fields()
    payload.update(
        mp_email=args.email, mp_password=mp_password, label=args.label,
        constituency=args.constituency, district=args.district,
    )
    result = call_admin_api("/admin/mp-account", payload)
    if result.get("created"):
        print(f"MP login account created: {args.email}")
        print(f"Password (share this with the MP securely): {mp_password}")
    else:
        print("Unexpected response:", result)


def cmd_list_mp(_args: argparse.Namespace) -> None:
    payload = admin_auth_fields()
    entries = call_admin_api("/admin/mp-allowlist/list", payload)
    if not entries:
        print("No MPs in the allowlist yet.")
        return
    print(f"{'Label':<25} {'Constituency':<20} {'District':<15} {'Has email':<10} {'Has phone':<10} Created at")
    for e in entries:
        print(
            f"{(e['label'] or '(no label)'):<25} {(e.get('constituency') or '(none)'):<20} "
            f"{(e.get('district') or '(none)'):<15} {str(e['has_email']):<10} {str(e['has_phone']):<10} {e['created_at']}"
        )


def cmd_delete_mp(args: argparse.Namespace) -> None:
    payload = admin_auth_fields()
    payload.update(mp_email=args.email, mp_phone=args.phone)
    result = call_admin_api("/admin/mp-allowlist/delete", payload)
    print(f"Deleted {result.get('deleted', 0)} matching entr(ies).")


def main() -> None:
    parser = argparse.ArgumentParser(description="JanVaani admin CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create-mp", help="Authorize a citizen's email/phone as an MP")
    p_create.add_argument("--email", help="MP's sign-in email")
    p_create.add_argument("--phone", help="MP's sign-in phone number (E.164, e.g. +91...)")
    p_create.add_argument("--label", help="Human-readable note, e.g. MP's name")
    p_create.add_argument("--constituency", help="Constituency this MP represents — controls what they see on the dashboard")
    p_create.add_argument("--district", help="Delhi district (e.g. 'North East-I') matching government data — used for evidence stats")
    p_create.set_defaults(func=cmd_create_mp)

    p_account = sub.add_parser("create-mp-account", help="Create a ready-to-use email+password login for an MP")
    p_account.add_argument("--email", required=True, help="MP's login email")
    p_account.add_argument("--mp-password", help="Password to set (random one is generated if omitted)")
    p_account.add_argument("--label", help="Human-readable note, e.g. MP's name")
    p_account.add_argument("--constituency", help="Constituency this MP represents — controls what they see on the dashboard")
    p_account.add_argument("--district", help="Delhi district (e.g. 'North East-I') matching government data — used for evidence stats")
    p_account.set_defaults(func=cmd_create_mp_account)

    p_list = sub.add_parser("list-mp", help="List all allowlisted MPs (label + date only)")
    p_list.set_defaults(func=cmd_list_mp)

    p_delete = sub.add_parser("delete-mp", help="Remove an MP from the allowlist")
    p_delete.add_argument("--email", help="MP's sign-in email (must match exactly what was used to create it)")
    p_delete.add_argument("--phone", help="MP's sign-in phone number")
    p_delete.set_defaults(func=cmd_delete_mp)

    args = parser.parse_args()
    if args.command == "create-mp" and not (args.email or args.phone):
        parser.error("create-mp requires --email or --phone")
    if args.command == "delete-mp" and not (args.email or args.phone):
        parser.error("delete-mp requires --email or --phone")
    args.func(args)


if __name__ == "__main__":
    main()
