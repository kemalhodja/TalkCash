PRICE_DIFF_THRESHOLD = 0.05


def normalize_product(name: str) -> str:
    return name.lower().strip()


def normalize_store(name: str) -> str:
    return name.lower().strip()


def display_product(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        return cleaned
    return cleaned[0].upper() + cleaned[1:]


def first_name(full_name: str | None) -> str:
    parts = (full_name or "").strip().split()
    return parts[0] if parts else ""


def price_diff_percent(current: float, previous: float) -> int:
    if previous <= 0:
        return 0
    return round(abs(current - previous) / previous * 100)
