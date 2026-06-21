from app.models.shopping import ShoppingCategory

CATEGORY_KEYWORDS = {
    ShoppingCategory.BUTCHER: [
        "et", "sucuk", "sosis", "tavuk", "köfte", "kofte",
        "meat", "chicken", "beef", "sausage", "steak",
    ],
    ShoppingCategory.GREENS: [
        "domates", "salatalık", "salatalik", "biber", "marul", "meyve",
        "tomato", "cucumber", "pepper", "lettuce", "fruit", "apple", "banana",
    ],
    ShoppingCategory.DAIRY: [
        "süt", "sut", "yumurta", "peynir", "yoğurt", "yogurt", "tereyağı",
        "milk", "egg", "cheese", "yogurt", "butter", "cream",
    ],
    ShoppingCategory.CLEANING: [
        "deterjan", "sabun", "temizlik", "bulaşık", "bulasik",
        "detergent", "soap", "cleaning", "bleach", "sponge",
    ],
    ShoppingCategory.BAKERY: [
        "ekmek", "simit", "poğaça", "pogaca",
        "bread", "bagel", "pastry", "roll",
    ],
    ShoppingCategory.BEVERAGE: [
        "su", "kola", "meyve suyu", "çay", "cay", "kahve",
        "water", "cola", "juice", "tea", "coffee", "soda",
    ],
}


def categorize_shopping_item(name: str) -> ShoppingCategory:
    name_lower = name.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            return category
    return ShoppingCategory.OTHER
