from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_privacy_policy_served():
    res = client.get("/privacy")
    assert res.status_code == 200
    assert "Content unavailable" not in res.text
    assert "TalkCash Privacy Policy" in res.text


def test_terms_served():
    res = client.get("/terms")
    assert res.status_code == 200
    assert "Content unavailable" not in res.text
    assert "TalkCash Terms" in res.text
