from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.i18n import I18nError, resolve_error, t
from app.models.user import User
from app.schemas.execute import ExecuteRequest
from app.services.execute.service import dispatch_confirmed_action
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/execute", tags=["Execute"])


@router.post("/confirm")
async def execute_confirmed_action(
    body: ExecuteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.action.confirmed:
        return {"status": "cancelled"}
    await check_rate_limit(request, "execute", settings.execute_rate_limit, identifier=str(user.id), strict=True)
    locale = user.locale or "tr"
    try:
        result = await dispatch_confirmed_action(user.id, body.parsed, db, locale)
        return {"status": "success", "result": result}
    except I18nError as e:
        status = 409 if e.key == "agenda.duplicate_bill" else 400
        raise HTTPException(status_code=status, detail=resolve_error(e, locale))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, locale))
