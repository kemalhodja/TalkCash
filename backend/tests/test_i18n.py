from app.i18n import SUPPORTED_LOCALES, maybe_translate, t


def test_supported_locales():
    assert "tr" in SUPPORTED_LOCALES
    assert "en" in SUPPORTED_LOCALES


def test_translate_turkish():
    assert "başarılı" in t("auth.login_success", "tr").lower() or "Giriş" in t("auth.login_success", "tr")


def test_translate_english():
    assert "successful" in t("auth.login_success", "en").lower()


def test_translate_with_params():
    msg = t("agenda.duplicate_bill", "tr", title="İnternet")
    assert "İnternet" in msg


def test_maybe_translate_key():
    assert maybe_translate("auth.pin_invalid", "en") == "Wrong PIN"
    assert maybe_translate("random error", "en") == "random error"
