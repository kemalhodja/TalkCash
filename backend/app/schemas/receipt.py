from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.utils.validation import parse_positive_amount


class ReceiptUpdate(BaseModel):
    merchant: str | None = Field(default=None, max_length=255)
    total_amount: float | None = None
    receipt_date: str | None = None

    @field_validator("total_amount")
    @classmethod
    def validate_amount(cls, value: float | None) -> float | None:
        if value is None:
            return None
        parse_positive_amount(value, field="total_amount")
        return value

    def parsed_date(self) -> datetime | None:
        if not self.receipt_date:
            return None
        raw = self.receipt_date.replace("Z", "")
        return datetime.fromisoformat(raw)
