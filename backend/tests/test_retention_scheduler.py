"""Tests for retention notification scheduler."""

from decimal import Decimal

from app.services.notifications.retention_scheduler import (
    _build_weekly_summary_body,
    _food_spend_pct,
    _is_food_category,
)


def test_food_category_detection():
    assert _is_food_category("Yemek")
    assert _is_food_category("Kahve")
    assert _is_food_category("Market")
    assert not _is_food_category("Ulaşım")


def test_food_spend_pct():
    breakdown = [("Yemek", Decimal("700")), ("Ulaşım", Decimal("300"))]
    assert _food_spend_pct(breakdown) == 70.0


def test_weekly_summary_smart_over_save():
    breakdown = [("Kahve", Decimal("560")), ("Market", Decimal("400"))]
    budgets = {"Kahve": Decimal("500"), "Market": Decimal("600")}
    body = _build_weekly_summary_body(breakdown, budgets, "tr")
    assert "Kahve" in body
    assert "Market" in body


def test_weekly_summary_top_category():
    breakdown = [("Ulaşım", Decimal("800")), ("Yemek", Decimal("200"))]
    body = _build_weekly_summary_body(breakdown, {}, "en")
    assert "Transport" not in body  # category name as stored
    assert "Ulaşım" in body or "80" in body or "spending" in body.lower()


def test_retention_i18n_keys_exist():
    from app.i18n import t

    assert "🎙️" in t("notif.retention_evening_title", "tr")
    assert "fısılda" in t("notif.retention_evening_body", "tr")
    assert "5" in t("notif.retention_evening_body", "en")
    assert "Haftalık Finans" in t("notif.retention_weekly_title", "tr")
    assert "yapay zeka" in t("notif.retention_weekly_body", "tr").lower()
    assert "Evde yemek" in t("notif.retention_persona_angry_mom_title", "tr")
    assert "Fırsat maliyeti" in t("notif.retention_persona_wall_street_title", "tr")
    assert "%30" in t("notif.retention_paywall_title", "tr")
    assert "sınırsızca" in t("notif.retention_paywall_body", "tr")
