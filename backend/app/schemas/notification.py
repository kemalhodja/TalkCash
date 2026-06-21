from pydantic import BaseModel, Field


class NotificationPrefsResponse(BaseModel):
    agenda_reminder: bool = True
    budget_warning: bool = True
    budget_exceeded: bool = True
    price_change: bool = True
    premium_expiry_reminder: bool = True
    premium_grace: bool = True
    premium_expired: bool = True
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "08:00"


class NotificationPrefsUpdate(BaseModel):
    agenda_reminder: bool | None = None
    budget_warning: bool | None = None
    budget_exceeded: bool | None = None
    price_change: bool | None = None
    premium_expiry_reminder: bool | None = None
    premium_grace: bool | None = None
    premium_expired: bool | None = None
    quiet_hours_enabled: bool | None = None
    quiet_hours_start: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    quiet_hours_end: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
