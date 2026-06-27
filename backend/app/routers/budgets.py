from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetUpdate
from app.services.budget.service import BudgetService

router = APIRouter(prefix="/budgets", tags=["Budgets"])
budget_service = BudgetService()


@router.get("/")
async def list_budgets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    summaries = await budget_service.list_with_usage(db, user.id)
    return [
        {
            "id": str(s["id"]),
            "category": s["category"],
            "monthly_limit": float(s["monthly_limit"]),
            "currency": s["currency"],
            "created_at": s["created_at"].isoformat(),
            "spent": float(s["spent"]),
            "percent": s["percent"],
        }
        for s in summaries
    ]


@router.post("/", response_model=BudgetResponse)
async def create_budget(data: BudgetCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    budget = await budget_service.create(db, user.id, data.category, data.monthly_limit)
    return BudgetResponse.model_validate(budget)


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: UUID, data: BudgetUpdate,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        budget = await budget_service.update(
            db, budget_id, user.id, data.monthly_limit, data.category,
        )
        return BudgetResponse.model_validate(budget)
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.delete("/{budget_id}")
async def delete_budget(budget_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        await budget_service.delete(db, budget_id, user.id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.get("/overruns")
async def list_budget_overruns(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await budget_service.list_overruns(db, user.id)
