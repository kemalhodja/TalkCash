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

    print(f"Smoke test -> {root}")

    status, health = request("GET", f"{root}/health")
    check("health", status == 200 and health.get("status") in ("ok", "degraded"), str(health))
    check(
        "health micro-savings feature",
        health.get("features", {}).get("micro_savings") is True,
        str(health.get("features")),
    )

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

    status, billing = request("GET", f"{base}/billing/me", headers=auth)
    check("billing me", status == 200 and "is_premium" in billing and "plan" in billing, str(billing))

    status, products = request("GET", f"{base}/billing/products", headers=auth)
    check("billing products", status == 200 and len(products.get("products", [])) >= 1, str(products))

    premium_unlocked = health.get("features", {}).get("premium_unlocked") is True

    status, premium_check = request("GET", f"{base}/billing/premium-check", headers=auth)
    if premium_unlocked:
        check(
            "premium check open access",
            status == 200 and premium_check.get("is_premium") is True,
            str(premium_check),
        )
    else:
        check("premium check free blocked", status == 403, str(premium_check))

    status, ms_prefs = request("PATCH", f"{base}/micro-savings/prefs", {
        "round_up_enabled": True,
        "round_up_step": 10,
    }, headers=auth)
    check("micro-savings prefs", status == 200 and ms_prefs.get("round_up_enabled") is True, str(ms_prefs))

    status, auto_denied = request("PATCH", f"{base}/micro-savings/prefs", {"auto_round_up": True}, headers=auth)
    if premium_unlocked:
        check(
            "auto round-up open access",
            status == 200 and auto_denied.get("auto_round_up") is True,
            str(auto_denied),
        )
    else:
        check("auto round-up requires premium", status == 402, str(auto_denied))

    status, brokers = request("GET", f"{base}/micro-savings/brokers", headers=auth)
    check("micro-savings brokers", status == 200 and len(brokers.get("brokers", [])) >= 1, str(brokers))

    status, coffee_expense = request("POST", f"{base}/execute/confirm", {
        "parsed": {
            "intent": "add_expense",
            "amount": 55,
            "category": "Yeme",
            "description": "Starbucks kahve",
            "wallet_name": "Nakit",
        },
        "action": {"confirmed": True},
    }, headers=auth)
    result = coffee_expense.get("result", {}) if isinstance(coffee_expense, dict) else {}
    swap = result.get("swap_nudge") or {}
    round_up = result.get("round_up") or {}
    check(
        "micro-savings swap nudge",
        status == 200 and swap.get("saved_amount", 0) > 0 and not swap.get("locked"),
        str(coffee_expense),
    )
    check("micro-savings round-up nudge", status == 200 and round_up.get("spare_amount", 0) > 0, str(coffee_expense))

    if swap.get("source_wallet_id") and swap.get("target_wallet_id"):
        status, ms_transfer = request("POST", f"{base}/micro-savings/transfer", {
            "from_wallet_id": swap["source_wallet_id"],
            "to_wallet_id": swap["target_wallet_id"],
            "amount": swap["saved_amount"],
            "rule_key": swap.get("rule_key", "coffee"),
        }, headers=auth)
        check("micro-savings transfer", status == 200 and ms_transfer.get("status") == "success", str(ms_transfer))

        status, ms_summary = request("GET", f"{base}/micro-savings/summary", headers=auth)
        check(
            "micro-savings summary",
            status == 200 and ms_summary.get("week_saved", 0) >= swap.get("saved_amount", 0),
            str(ms_summary),
        )

    status, ms_rates = request("GET", f"{base}/micro-savings/rates", headers=auth)
    check(
        "micro-savings live rates",
        status == 200 and ms_rates.get("live_rates", {}).get("gold_try_per_gram", 0) > 0,
        str(ms_rates),
    )

    status, ms_sim = request("POST", f"{base}/micro-savings/simulate", {
        "monthly_contribution": 100,
        "months": 12,
    }, headers=auth)
    check(
        "micro-savings simulate",
        status == 200 and ms_sim.get("final_balance", 0) > 0 and ms_sim.get("disclaimer"),
        str(ms_sim),
    )

    try:
        with urllib.request.urlopen(f"{root}/privacy", timeout=15) as resp:
            privacy_html = resp.read().decode()
        check("privacy page", resp.status == 200 and "TalkCash" in privacy_html, "missing privacy")
    except Exception as exc:
        check("privacy page", False, str(exc))

    if failures:
        print(f"\nSmoke test FAILED ({len(failures)} checks)")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\nSmoke test PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
