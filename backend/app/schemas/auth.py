from uuid import UUID

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PinRequest(BaseModel):
    pin: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    full_name: str
    biometric_enabled: bool
    has_pin: bool


class UserProfile(BaseModel):
    id: UUID
    email: str
    full_name: str
    biometric_enabled: bool
    has_pin: bool
