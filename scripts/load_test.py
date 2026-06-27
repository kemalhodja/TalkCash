#!/usr/bin/env python3
"""Lightweight API load test with SLA gates — run against staging/prod with caution."""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
import uuid
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.utils.load_sla import LoadStats, evaluate_sla

DEFAULT_BASE = "http://localhost:8000/api/v1"


async def register_and_login(client: httpx.AsyncClient, base: str) -> str:
    email = f"load-{uuid.uuid4().hex[:10]}@talkcash.test"
    password = "LoadTest123!"
    r = await client.post(f"{base}/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Load Test",
    })
    r.raise_for_status()
    r = await client.post(f"{base}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


ENDPOINTS = (
    ("GET", "/wallets/net-worth"),
    ("GET", "/wallets/monthly-summary"),
    ("GET", "/transactions/?limit=20"),
)


async def worker(
    client: httpx.AsyncClient,
    base: str,
    token: str,
    duration: float,
    stats: LoadStats,
    endpoint_idx: int,
) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    end = time.monotonic() + duration
    idx = endpoint_idx
    while time.monotonic() < end:
        method, path = ENDPOINTS[idx % len(ENDPOINTS)]
        idx += 1
        t0 = time.monotonic()
        try:
            r = await client.request(method, f"{base}{path}", headers=headers, timeout=30.0)
            r.raise_for_status()
        except Exception:
            stats.record_error()
        else:
            stats.record_ok((time.monotonic() - t0) * 1000)
        await asyncio.sleep(0.05)


async def main() -> int:
    parser = argparse.ArgumentParser(description="TalkCash API load test")
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--duration", type=int, default=30, help="seconds per worker")
    parser.add_argument("--max-error-rate", type=float, default=0.05, help="fail if above this ratio")
    parser.add_argument("--max-p95-ms", type=float, default=1500, help="fail if p95 latency exceeds this")
    parser.add_argument("--json", action="store_true", help="print JSON summary")
    args = parser.parse_args()

    stats = LoadStats()
    health_url = args.base.replace("/api/v1", "") + "/health"

    async with httpx.AsyncClient() as client:
        health = await client.get(health_url, timeout=60.0)
        health.raise_for_status()
        token = await register_and_login(client, args.base)

    async with httpx.AsyncClient() as client:
        tasks = [
            worker(client, args.base, token, args.duration, stats, i)
            for i in range(args.workers)
        ]
        await asyncio.gather(*tasks)

    ok = [x for x in stats.latencies_ms if x >= 0]
    summary = {
        "requests": stats.total,
        "errors": stats.errors,
        "error_rate": round(stats.error_rate(), 4),
        "p50_ms": round(statistics.median(ok), 1) if ok else None,
        "p95_ms": round(stats.p95(), 1) if stats.p95() is not None else None,
        "max_ms": round(max(ok), 1) if ok else None,
        "workers": args.workers,
        "duration_s": args.duration,
        "base": args.base,
    }
    failures = evaluate_sla(stats, max_error_rate=args.max_error_rate, max_p95_ms=args.max_p95_ms)
    summary["sla_passed"] = not failures
    summary["sla_failures"] = failures

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(f"Requests: {stats.total}  errors: {stats.errors}  error_rate: {stats.error_rate():.1%}")
        if ok:
            print(
                f"p50: {statistics.median(ok):.1f}ms  "
                f"p95: {stats.p95():.1f}ms  max: {max(ok):.1f}ms"
            )
        if failures:
            print("SLA FAILED:")
            for item in failures:
                print(f"  - {item}")
        else:
            print("SLA PASSED")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
