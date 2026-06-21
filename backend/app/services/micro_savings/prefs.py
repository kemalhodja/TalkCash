import json

from app.models.user import User

DEFAULT_MICRO_SAVINGS_PREFS: dict = {
    "round_up_enabled": False,
    "round_up_step": 10,
    "auto_round_up": False,
    "preferred_broker": "midas",
    "default_investment_wallet": "investment_gold",
}

ALLOWED_ROUND_UP_STEPS = (5, 10, 25)
ALLOWED_BROKERS = ("midas", "papara", "revolut", "trading212", "none")
ALLOWED_INVESTMENT_WALLETS = ("investment_gold", "investment_forex")


def parse_micro_savings_prefs(raw: str | None) -> dict:
    if not raw:
        return dict(DEFAULT_MICRO_SAVINGS_PREFS)
    try:
        stored = json.loads(raw)
        if not isinstance(stored, dict):
            return dict(DEFAULT_MICRO_SAVINGS_PREFS)
        merged = {**DEFAULT_MICRO_SAVINGS_PREFS, **stored}
        if merged.get("round_up_step") not in ALLOWED_ROUND_UP_STEPS:
            merged["round_up_step"] = DEFAULT_MICRO_SAVINGS_PREFS["round_up_step"]
        if merged.get("preferred_broker") not in ALLOWED_BROKERS:
            merged["preferred_broker"] = DEFAULT_MICRO_SAVINGS_PREFS["preferred_broker"]
        if merged.get("default_investment_wallet") not in ALLOWED_INVESTMENT_WALLETS:
            merged["default_investment_wallet"] = DEFAULT_MICRO_SAVINGS_PREFS["default_investment_wallet"]
        return merged
    except json.JSONDecodeError:
        return dict(DEFAULT_MICRO_SAVINGS_PREFS)


def serialize_micro_savings_prefs(prefs: dict) -> str:
    merged = {**DEFAULT_MICRO_SAVINGS_PREFS, **prefs}
    return json.dumps(merged)


def get_user_micro_savings_prefs(user: User) -> dict:
    return parse_micro_savings_prefs(user.micro_savings_prefs)
