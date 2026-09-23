import os
import time

from app.core.config import settings
from app.core.logger import logger, setup_logging


def test_logger_setup_and_separation(tmp_path):
    """
    Verifies that Loguru creates separate app.log and error.log,
    routes logs by severity level, and respects the 7-day retention setting.
    """
    # Verify retention setting defaults to 7 days
    assert settings.LOG_RETENTION_DAYS == 7

    test_log_dir = str(tmp_path / "logs")
    settings.LOG_DIR = test_log_dir

    # Re-initialize logging with temp directory
    setup_logging()

    app_log = os.path.join(test_log_dir, "app.log")
    error_log = os.path.join(test_log_dir, "error.log")

    assert os.path.exists(test_log_dir)

    # Emit info and error logs
    logger.info("Application started successfully - INFO level")
    logger.warning("Configuration fallback triggered - WARNING level")
    logger.error("Database connection timeout - ERROR level")

    # Allow async enqueue sink to flush to disk
    time.sleep(0.1)

    assert os.path.exists(app_log)
    assert os.path.exists(error_log)

    with open(app_log, encoding="utf-8") as f:
        app_content = f.read()

    with open(error_log, encoding="utf-8") as f:
        error_content = f.read()

    # app.log should have all logs (INFO, WARNING, ERROR)
    assert "Application started successfully - INFO level" in app_content
    assert "Configuration fallback triggered - WARNING level" in app_content
    assert "Database connection timeout - ERROR level" in app_content

    # error.log should ONLY have ERROR level logs
    assert "Database connection timeout - ERROR level" in error_content
    assert "Application started successfully - INFO level" not in error_content
    assert "Configuration fallback triggered - WARNING level" not in error_content
