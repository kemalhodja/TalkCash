#!/usr/bin/env python3
"""Clear PIN for a user by email (requires INTERNAL_UPGRADE_SECRET on API)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("API_URL", "https://talkcash-api-prod.onrender.com").rstrip("/") + "/api/v1"
EMAIL = os.environ.get("USER_EMAIL", "ozyurtkemal35@gmail.com")
SECRET = os.environ.get("INTERNAL_UPGRADE_SECRET", "talkcash-internal-test-2026")


def main() -> int:
    headers = {
        "Content-Type": "application/json",
        "x-internal-upgrade-secret": SECRET,
    }
    body = json.dumps({"email": EMAIL}).encode()
    req = urllib.request.Request(
        BASE + "/auth/admin/clear-pin",
        data=body,
        method="POST",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            print(resp.read().decode())
            return 0
    except urllib.error.HTTPError as exc:
        print(exc.read().decode(), file=sys.stderr)
        return exc.code


if __name__ == "__main__":
    raise SystemExit(main())
