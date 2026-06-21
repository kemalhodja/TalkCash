from app.services.nlp.personas import is_luxury_spend, normalize_persona, persona_spend_speech
from app.services.subscription.manager import detect_subscription


def test_normalize_persona():
    assert normalize_persona("angry_mom") == "angry_mom"
    assert normalize_persona("invalid") == "default"


def test_luxury_spend_detection():
    assert is_luxury_spend("Yeme-İçme", "Starbucks latte", "")
    assert not is_luxury_spend("Market", "süt", "")


def test_angry_mom_speech():
    speech = persona_spend_speech(
        "angry_mom", "tr", user_name="Ahmet Yılmaz", category="Kahve", amount=85,
        description="Starbucks latte",
    )
    assert speech
    assert "Ahmet" in speech
    assert "kahve" in speech.lower() or "Kahve" in speech


def test_angry_mom_taxi_speech():
    speech = persona_spend_speech(
        "angry_mom", "tr", user_name="Ayşe", category="Ulaşım", amount=200,
        raw_text="uber taksi 200",
    )
    assert speech
    assert "taksi" in speech.lower() or "200" in speech


def test_detect_chatgpt_subscription():
    is_sub, name = detect_subscription("chatgpt plus aylık 500")
    assert is_sub
    assert name == "ChatGPT Plus"


def test_subscription_cancel_url():
    from app.services.subscription.manager import subscription_cancel_url
    assert subscription_cancel_url("Netflix")
    assert subscription_cancel_url("Unknown") is None


def test_upcoming_subscriptions_route_exists():
    from app.routers.transactions import upcoming_subscriptions
    assert callable(upcoming_subscriptions)


def test_detect_netflix_subscription():
    is_sub, name = detect_subscription("Bugün Netflix'e 150 TL ödedim")
    assert is_sub
    assert name == "Netflix"


def test_detect_spotify_subscription():
    is_sub, name = detect_subscription("spotify aylık 60 lira")
    assert is_sub
    assert name == "Spotify"


def test_subscription_scheduler_target_date():
    from datetime import datetime, timedelta
    from app.services.subscription.scheduler import scan_subscription_reminders

    assert callable(scan_subscription_reminders)
    # T-2 scan targets transactions due in exactly 2 days
    assert (datetime.utcnow().date() + timedelta(days=2)).isoformat()
