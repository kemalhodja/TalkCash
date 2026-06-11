import re
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if value.isdigit():
            raise ValueError("auth.password_too_weak")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PinRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=6)

    @field_validator("pin")
    @classmethod
    def pin_digits(cls, value: str) -> str:
        if not re.fullmatch(r"\d{4,6}", value):
            raise ValueError("auth.pin_invalid_format")
        return value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    full_name: str
    biometric_enabled: bool
    has_pin: bool
    locale: str = "tr"
    timezone: str = "Europe/Istanbul"


class UserProfile(BaseModel):
    id: UUID
    email: str
    full_name: str
    biometric_enabled: bool
    has_pin: bool
    locale: str = "tr"
    timezone: str = "Europe/Istanbul"


class LocaleRequest(BaseModel):
    locale: str


class TimezoneRequest(BaseModel):
    timezone: str
