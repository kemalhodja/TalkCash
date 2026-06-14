#!/usr/bin/env python3
"""TalkCash API smoke test — run after deploy or locally."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone


def request(method: str, url: str, data: dict | None = None, headers: dict | None = None) -> tuple[int, dict | list]:
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"detail": raw}
        return e.code, payload


def main() -> int:
    root = os.environ.get("API_URL", "http://localhost:8000").rstrip("/")
    base = f"{root}/api/v1"
    failures: list[str] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        if ok:
            print(f"  OK  {name}")
        else:
            msg = f"{name}: {detail}"
            failures.append(msg)
            print(f"  FAIL {msg}")

    print(f"Smoke test → {root}")

    status, health = request("GET", f"{root}/health")
    check("health", status == 200 and health.get("status") in ("ok", "degraded"), str(health))

    email = f"smoke_{uuid.uuid4().hex[:8]}@talkcash.io"
    status, reg = request("POST", f"{base}/auth/register", {
        "email": email,
        "password": "testpass123",
        "full_name": "Smoke Test",
    })
    check("register", status == 200 and "access_token" in reg, str(reg))
    if status != 200:
        print("\nSmoke test FAILED")
        return 1

    token = reg["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    status, wallets = request("GET", f"{base}/wallets/", headers=auth)
    check("wallets", status == 200 and isinstance(wallets, list) and len(wallets) >= 1, str(wallets))

    for w in wallets if isinstance(wallets, list) else []:
        if w.get("wallet_type") == "credit_card":
            continue
        request("POST", f"{base}/wallets/income?wallet_id={w['id']}&amount=50000&description=smoke", headers=auth)

    status, parsed = request("POST", f"{base}/input/parse?text=50%20TL%20kahve", headers=auth)
    check("nlp parse", status == 200 and parsed.get("parsed", {}).get("intent") == "add_expense", str(parsed))

    if parsed.get("parsed"):
        status, executed = request("POST", f"{base}/execute/confirm", {
            "parsed": parsed["parsed"],
            "action": {"confirmed": True},
        }, headers=auth)
        check("execute expense", status == 200 and executed.get("status") == "success", str(executed))

    status, shopping = request("POST", f"{base}/shopping/add", {"items": ["SmokeItem"]}, headers=auth)
    check("shopping add", status == 200, str(shopping))

    status, price = request("GET", f"{base}/ai/price-tracker?product=milk", headers=auth)
    check("price tracker", status == 200 and "has_data" in price, str(price))

    status, i18n = request("GET", f"{base}/i18n/en")
    check("i18n", status == 200 and "auth.login_success" in i18n, "missing keys")

    client_wallet_id = str(uuid.uuid4())
    status, sync_push = request("POST", f"{base}/sync/push", {
        "operations": [
            {
                "id": str(uuid.uuid4()),
                "type": "wallet_create",
                "payload": {
                    "name": "SmokeWallet",
                    "wallet_type": "cash",
                    "currency": "TRY",
                    "client_wallet_id": client_wallet_id,
                },
                "client_timestamp": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "type": "wallet_income",
                "payload": {
                    "wallet_id": client_wallet_id,
                    "amount": 100,
                    "description": "smoke income",
                },
                "client_timestamp": datetime.now(timezone.utc).isoformat(),
            },
        ],
    }, headers=auth)
    check(
        "offline sync chain",
        status == 200 and len(sync_push.get("applied", [])) == 2 and not sync_push.get("failed"),
        str(sync_push),
    )

    status, sync_pull = request("GET", f"{base}/sync/pull", headers=auth)
    check("sync pull", status == 200 and "budgets" in sync_pull, str(sync_pull))

    if failures:
        print(f"\nSmoke test FAILED ({len(failures)} checks)")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\nSmoke test PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
