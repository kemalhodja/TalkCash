"""Tests for production env bootstrap."""

import os

from app.bootstrap_env import normalize_production_env


def test_bootstrap_skips_in_debug(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("BILLING_PREMIUM_UNLOCKED", "true")
    assert normalize_production_env() == {}
    assert os.environ["BILLING_PREMIUM_UNLOCKED"] == "true"


def test_bootstrap_forces_production_flags(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("BILLING_PREMIUM_UNLOCKED", "true")
    monkeypatch.setenv("GOOGLE_PLAY_VERIFY_MOCK", "true")
    monkeypatch.setenv("INTERNAL_UPGRADE_SECRET", "talkcash-internal-test-2026")
    monkeypatch.setenv("SECRET_KEY", "x" * 48)
    applied = normalize_production_env()
    assert os.environ["BILLING_PREMIUM_UNLOCKED"] == "false"
    assert os.environ["GOOGLE_PLAY_VERIFY_MOCK"] == "false"
    assert os.environ["INTERNAL_UPGRADE_SECRET"] == "x" * 48
    assert "BILLING_PREMIUM_UNLOCKED" in applied
