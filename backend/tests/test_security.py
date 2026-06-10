from uuid import uuid4

from app.utils.security import create_access_token, decode_token, hash_password, verify_password


def test_password_hashing():
    hashed = hash_password("secret123")
    assert verify_password("secret123", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_roundtrip():
    uid = uuid4()
    token = create_access_token(uid)
    decoded = decode_token(token)
    assert decoded == uid
