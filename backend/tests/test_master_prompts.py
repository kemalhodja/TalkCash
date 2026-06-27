"""Tests for AI persona master prompts."""

from app.services.nlp.master_prompts import mentor_system_prompt, nlp_persona_master
from app.services.nlp.personas import (
    is_essential_spend,
    normalize_persona,
    persona_spend_speech,
)


def test_nlp_angry_mom_master_user_prompt():
    overlay = nlp_persona_master("angry_mom", "tr")
    assert "Türk annesisin" in overlay
    assert "Evde yemek mi yok" in overlay
    assert "Aferin" in overlay


def test_nlp_wall_street_master_wolf_tone():
    overlay = nlp_persona_master("wall_street", "tr")
    assert "Wall Street broker" in overlay
    assert "fırsat maliyeti" in overlay
    assert "Zaman kaybediyorsun" in overlay


def test_nlp_zen_guru_master_mindful():
    overlay = nlp_persona_master("zen_guru", "tr")
    assert "Zen ustası" in overlay
    assert "uzun vadeli bir huzur" in overlay


def test_mentor_angry_mom_full_system():
    system = mentor_system_prompt("angry_mom", "tr")
    assert "Parayı sokaktan mı topluyorsun" in system


def test_normalize_zen_guru():
    assert normalize_persona("zen_guru") == "zen_guru"


def test_angry_mom_essential_spend_calms_down():
    assert is_essential_spend("Faturalar", "elektrik faturası", "")
    speech = persona_spend_speech(
        "angry_mom", "tr", user_name="Ayşe", category="Faturalar", amount=350,
        description="elektrik faturası",
    )
    assert speech
    assert "aferin" in speech.lower()
    assert "lükse" in speech.lower()


def test_angry_mom_luxury_coffee_roast():
    speech = persona_spend_speech(
        "angry_mom", "tr", user_name="Ahmet", category="Kahve", amount=150,
        description="starbucks latte",
    )
    assert speech
    assert "150" in speech
    assert "Evde yemek mi yok" in speech or "sokaktan" in speech


def test_wall_street_wolf_opportunity_cost():
    speech = persona_spend_speech(
        "wall_street", "tr", user_name="Mehmet", category="Yemek", amount=500,
    )
    assert speech
    assert "5 yıl" in speech
    assert "Zaman kaybediyorsun" in speech


def test_zen_guru_mindful_question():
    speech = persona_spend_speech(
        "zen_guru", "tr", user_name="Zeynep", category="Alışveriş", amount=200,
    )
    assert speech
    assert "nefes" in speech.lower()
    assert "huzur" in speech.lower()
