import logging
import os
import sys

from loguru import logger

from app.core.config import settings


class InterceptHandler(logging.Handler):
    """
    Default handler from examples in loguru documentation.
    Intercepts standard library logging messages and routes them to Loguru.
    """

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging() -> None:
    """
    Configures Loguru logging with separate console, app.log, and error.log sinks.
    Applies configurable retention period (default 7 days) and rotation.
    """
    log_dir = os.path.abspath(settings.LOG_DIR)
    os.makedirs(log_dir, exist_ok=True)

    retention_period = f"{settings.LOG_RETENTION_DAYS} days"

    # Remove all existing handlers
    logger.remove()

    # 1. Console Handler (Colorized, human-readable stdout)
    console_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        format=console_format,
        colorize=True,
        backtrace=True,
        diagnose=settings.DEBUG,
    )

    # File log format (Structured with timestamp, level, process, location)
    file_format = (
        "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
        "{level: <8} | "
        "{process} | "
        "{name}:{function}:{line} - "
        "{message}"
    )

    # 2. General Application Log (app.log: Captures all application & system logs)
    app_log_path = os.path.join(log_dir, "app.log")
    logger.add(
        app_log_path,
        level=settings.LOG_LEVEL,
        format=file_format,
        rotation=settings.LOG_ROTATION,
        retention=retention_period,
        compression="zip",
        encoding="utf-8",
        enqueue=True,  # Asynchronous thread-safe logging
        backtrace=True,
        diagnose=False,
    )

    # 3. Dedicated Error Log (error.log: Captures ERROR and CRITICAL with full stack traces)
    error_log_path = os.path.join(log_dir, "error.log")
    logger.add(
        error_log_path,
        level="ERROR",
        format=file_format,
        rotation=settings.LOG_ROTATION,
        retention=retention_period,
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=settings.DEBUG,
    )

    # Intercept standard library logging (e.g. uvicorn, fastapi, motor)
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for uvicorn_logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        uv_logger = logging.getLogger(uvicorn_logger_name)
        uv_logger.handlers = [InterceptHandler()]
        uv_logger.propagate = False

    logger.info(
        f"Loguru initialized. App logs -> {app_log_path}, Error logs -> {error_log_path} "
        f"(Retention: {retention_period}, Rotation: {settings.LOG_ROTATION})"
    )


__all__ = ["logger", "setup_logging"]
