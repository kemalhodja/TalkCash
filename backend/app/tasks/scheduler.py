import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database import async_session
from app.services.agenda.service import AgendaService
from app.services.exchange.service import ExchangeService
from app.services.notifications.service import NotificationService
from app.services.shopping.service import ShoppingService

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()
shopping_service = ShoppingService()
notif_service = NotificationService()
exchange_service = ExchangeService()
agenda_service = AgendaService()


async def daily_shopping_reset():
    async with async_session() as db:
        count = await shopping_service.daily_reset(db)
        logger.info("Daily shopping reset: %d items cleared", count)


async def agenda_reminders_today():
    async with async_session() as db:
        count = await notif_service.check_agenda_reminders(db, when="today")
        logger.info("Agenda today reminders sent: %d", count)


async def agenda_reminders_tomorrow():
    async with async_session() as db:
        count = await notif_service.check_agenda_reminders(db, when="tomorrow")
        logger.info("Agenda tomorrow reminders sent: %d", count)


async def spawn_recurring_bills():
    async with async_session() as db:
        count = await agenda_service.spawn_recurring_bills(db)
        logger.info("Recurring bills spawned: %d", count)


async def sync_exchange_rates():
    async with async_session() as db:
        rates = await exchange_service.sync_rates(db)
        logger.info("Exchange rates synced: %s", list(rates.keys()))


def start_scheduler():
    from app.config import settings

    if not settings.scheduler_enabled:
        logger.info("Scheduler disabled (SCHEDULER_ENABLED=false)")
        return
    tz = ZoneInfo(settings.app_timezone)
    scheduler.add_job(daily_shopping_reset, "cron", hour=0, minute=0, timezone=tz, id="daily_reset")
    scheduler.add_job(agenda_reminders_today, "cron", hour=8, minute=0, timezone=tz, id="morning_reminders")
    scheduler.add_job(agenda_reminders_tomorrow, "cron", hour=20, minute=0, timezone=tz, id="evening_reminders")
    scheduler.add_job(spawn_recurring_bills, "cron", hour=1, minute=0, timezone=tz, id="recurring_bills")
    scheduler.add_job(sync_exchange_rates, "interval", hours=1, id="rate_sync")
    scheduler.start()
    logger.info("Scheduler started")
