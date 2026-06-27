"""Load test SLA evaluation."""

from app.utils.load_sla import LoadStats, evaluate_sla


def test_sla_passes_on_healthy_stats():
    stats = LoadStats()
    for ms in [100, 120, 140, 160, 180]:
        stats.record_ok(float(ms))
    assert evaluate_sla(stats, max_error_rate=0.05, max_p95_ms=1500) == []


def test_sla_fails_on_high_error_rate():
    stats = LoadStats()
    stats.record_ok(100)
    stats.record_error()
    failures = evaluate_sla(stats, max_error_rate=0.05, max_p95_ms=1500)
    assert any("error rate" in f for f in failures)


def test_sla_fails_on_slow_p95():
    stats = LoadStats()
    for ms in range(100, 2100, 100):
        stats.record_ok(float(ms))
    failures = evaluate_sla(stats, max_error_rate=0.05, max_p95_ms=1500)
    assert any("p95" in f for f in failures)
