"""Shared load-test SLA helpers (used by scripts/load_test.py and unit tests)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class LoadStats:
    latencies_ms: list[float] = field(default_factory=list)
    errors: int = 0

    def record_ok(self, ms: float) -> None:
        self.latencies_ms.append(ms)

    def record_error(self) -> None:
        self.errors += 1
        self.latencies_ms.append(-1.0)

    @property
    def total(self) -> int:
        return len(self.latencies_ms)

    def p95(self) -> float | None:
        ok = sorted(x for x in self.latencies_ms if x >= 0)
        if not ok:
            return None
        idx = max(0, int(len(ok) * 0.95) - 1)
        return ok[idx]

    def error_rate(self) -> float:
        if not self.total:
            return 0.0
        return self.errors / self.total


def evaluate_sla(stats: LoadStats, *, max_error_rate: float, max_p95_ms: float) -> list[str]:
    failures: list[str] = []
    if stats.total == 0:
        failures.append("no requests completed")
    rate = stats.error_rate()
    if rate > max_error_rate:
        failures.append(f"error rate {rate:.1%} exceeds {max_error_rate:.1%}")
    p95 = stats.p95()
    if p95 is not None and p95 > max_p95_ms:
        failures.append(f"p95 {p95:.1f}ms exceeds {max_p95_ms:.0f}ms")
    return failures
