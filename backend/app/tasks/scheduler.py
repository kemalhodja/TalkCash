import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database import async_session
from app.services.agenda.service import AgendaService
from app.services.budget_scheduler import daily_budget_alert_scan
from app.services.billing_scheduler import daily_premium_subscription_scan
from app.services.exchange.service import ExchangeService
from app.services.notifications.service import NotificationService
from app.services.shopping.service import ShoppingService
from app.utils.scheduler_lock import refresh_scheduler_leader

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()
shopping_service = ShoppingService()
notif_service = NotificationService()
exchange_service = ExchangeService()
agenda_service = AgendaService()


async def _guarded(job):
    if not await refresh_scheduler_leader():
        logger.debug("Skipping scheduled job — not scheduler leader")
        return
    await job()


async def daily_shopping_reset():
    async def _run():
        async with async_session() as db:
            count = await shopping_service.daily_reset(db)
            logger.info("Daily shopping reset: %d items cleared", count)

    await _guarded(_run)


async def agenda_reminders_today():
    async def _run():
        async with async_session() as db:
            count = await notif_service.check_agenda_reminders(db, when="today")
            logger.info("Agenda today reminders sent: %d", count)

    await _guarded(_run)


async def agenda_reminders_tomorrow():
    async def _run():
        async with async_session() as db:
            count = await notif_service.check_agenda_reminders(db, when="tomorrow")
            logger.info("Agenda tomorrow reminders sent: %d", count)

    await _guarded(_run)


async def spawn_recurring_bills():
    async def _run():
        async with async_session() as db:
            count = await agenda_service.spawn_recurring_bills(db)
            logger.info("Recurring bills spawned: %d", count)

    await _guarded(_run)


async def mark_overdue_bills():
    async def _run():
        async with async_session() as db:
            count = await agenda_service.mark_overdue_bills(db)
            logger.info("Agenda overdue marked: %d", count)

    await _guarded(_run)


async def budget_alerts_daily():
    async def _run():
        async with async_session() as db:
            count = await daily_budget_alert_scan(db)
            logger.info("Budget daily scan: %d alerts", count)

    await _guarded(_run)


async def premium_subscription_scan():
    async def _run():
        async with async_session() as db:
            count = await daily_premium_subscription_scan(db)
            logger.info("Premium subscription scan: %d notifications", count)

    await _guarded(_run)


async def subscription_reminders_scan():
    from app.services.subscription.scheduler import scan_subscription_reminders

    async def _run():
        async with async_session() as db:
            count = await scan_subscription_reminders(db)
            logger.info("Subscription T-2 reminders sent: %d", count)

    await _guarded(_run)


async def sync_exchange_rates():
    async def _run():
        async with async_session() as db:
            rates = await exchange_service.sync_rates(db)
            logger.info("Exchange rates synced: %s", list(rates.keys()))

    await _guarded(_run)


async def price_watch_scan():
    from app.services.price_watch.service import PriceWatchService

    async def _run():
        async with async_session() as db:
            count = await PriceWatchService().scan_all(db)
            logger.info("Price watch alerts sent: %d", count)

    await _guarded(_run)


async def weekly_podcast_scan():
    from app.models.user import User
    from app.services.podcast.service import PodcastService
    from sqlalchemy import select

    service = PodcastService()

    async def _run():
        async with async_session() as db:
            count = await service.generate_all_users(db)
            logger.info("Weekly podcast generated: %d users", count)

    await _guarded(_run)


async def rebuild_product_rules():
    from app.services.shopping.predictive import PredictiveShoppingService

    service = PredictiveShoppingService()

    async def _run():
        async with async_session() as db:
            count = await service.rebuild_all_users(db)
            logger.info("Product association rules rebuilt: %d rules", count)

    await _guarded(_run)


async def retention_evening_nudge():
    from app.services.notifications.retention_scheduler import scan_evening_expense_nudge

    async def _run():
        async with async_session() as db:
            count = await scan_evening_expense_nudge(db)
            logger.info("Retention evening nudges sent: %d", count)

    await _guarded(_run)


async def retention_weekly_report():
    from app.services.notifications.retention_scheduler import scan_weekly_finance_report

    async def _run():
        async with async_session() as db:
            count = await scan_weekly_finance_report(db)
            logger.info("Retention weekly finance reports sent: %d", count)

    await _guarded(_run)


async def retention_persona_nudge():
    from app.services.notifications.retention_scheduler import scan_persona_weekly_nudge

    async def _run():
        async with async_session() as db:
            count = await scan_persona_weekly_nudge(db)
            logger.info("Retention persona nudges sent: %d", count)

    await _guarded(_run)


async def retention_paywall_recovery():
    from app.services.notifications.retention_scheduler import scan_paywall_recovery

    async def _run():
        async with async_session() as db:
            count = await scan_paywall_recovery(db)
            logger.info("Retention paywall recovery sent: %d", count)

    await _guarded(_run)


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def start_scheduler():
    from app.config import settings

    if not settings.scheduler_enabled:
        logger.info("Scheduler disabled (SCHEDULER_ENABLED=false)")
        return
    tz = ZoneInfo(settings.app_timezone)
    scheduler.add_job(daily_shopping_reset, "cron", hour=0, minute=0, timezone=tz, id="daily_reset")
    scheduler.add_job(mark_overdue_bills, "cron", hour=7, minute=0, timezone=tz, id="overdue_bills")
    scheduler.add_job(agenda_reminders_today, "cron", hour=8, minute=0, timezone=tz, id="morning_reminders")
    scheduler.add_job(budget_alerts_daily, "cron", hour=9, minute=0, timezone=tz, id="budget_alerts")
    scheduler.add_job(premium_subscription_scan, "cron", hour=11, minute=0, timezone=tz, id="premium_expiry")
    scheduler.add_job(price_watch_scan, "cron", hour=10, minute=0, timezone=tz, id="price_watch")
    scheduler.add_job(agenda_reminders_tomorrow, "cron", hour=20, minute=0, timezone=tz, id="evening_reminders")
    scheduler.add_job(subscription_reminders_scan, "cron", hour=9, minute=30, timezone=tz, id="subscription_reminders")
    scheduler.add_job(spawn_recurring_bills, "cron", hour=1, minute=0, timezone=tz, id="recurring_bills")
    scheduler.add_job(weekly_podcast_scan, "cron", day_of_week="sun", hour=8, minute=0, timezone=tz, id="weekly_podcast")
    scheduler.add_job(rebuild_product_rules, "cron", hour=3, minute=30, timezone=tz, id="product_rules")
    scheduler.add_job(retention_evening_nudge, "cron", minute=30, timezone=tz, id="retention_evening")
    scheduler.add_job(retention_weekly_report, "cron", minute=0, timezone=tz, id="retention_weekly")
    scheduler.add_job(retention_persona_nudge, "cron", minute=0, timezone=tz, id="retention_persona")
    scheduler.add_job(retention_paywall_recovery, "cron", minute=15, timezone=tz, id="retention_paywall")
    scheduler.add_job(sync_exchange_rates, "interval", hours=1, id="rate_sync")
    scheduler.start()
    logger.info("Scheduler started")
