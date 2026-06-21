"""Test environment defaults — avoid local .env breaking collection."""

import os

os.environ.setdefault("S3_ENABLED", "false")
os.environ.setdefault("SCHEDULER_ENABLED", "false")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
