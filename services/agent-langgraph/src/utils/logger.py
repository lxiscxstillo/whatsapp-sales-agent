"""
Structured JSON logger for the LangGraph agent.

Provides a consistent logging format across all nodes so that log aggregators
(Datadog, CloudWatch, Railway logs) can parse and query events by field.

Usage:
    from ...utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info("slot_check.start", extra={"node": "slot_check", "lead_id": "123"})
"""

import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Any


class JSONFormatter(logging.Formatter):
    """
    Formats log records as single-line JSON objects.

    Output fields:
        - event (str): The log message (use as a short event name).
        - level (str): Log level (INFO, WARNING, ERROR, etc.).
        - timestamp (str): ISO-8601 UTC timestamp.
        - logger (str): Logger name (usually the module path).
        - node (str | None): LangGraph node name, if provided via extra.
        - lead_id (str | None): Lead identifier, if provided via extra.
        - error (str | None): Error message string, if provided via extra.
        - exc_info (str | None): Full traceback string, only on exceptions.
        - <other extra fields>: Any additional fields passed via extra={}.
    """

    # Standard LogRecord attributes to exclude from the "extra" passthrough
    _RESERVED = frozenset({
        "name", "msg", "args", "levelname", "levelno", "pathname",
        "filename", "module", "exc_info", "exc_text", "stack_info",
        "lineno", "funcName", "created", "msecs", "relativeCreated",
        "thread", "threadName", "processName", "process", "message",
        "taskName",
    })

    def format(self, record: logging.LogRecord) -> str:
        """Serialize the log record to a JSON string."""
        payload: dict[str, Any] = {
            "event": record.getMessage(),
            "level": record.levelname,
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "logger": record.name,
        }

        # Attach traceback if present
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        elif record.exc_text:
            payload["exc_info"] = record.exc_text

        # Passthrough any extra fields (node, lead_id, error, etc.)
        for key, value in record.__dict__.items():
            if key not in self._RESERVED and not key.startswith("_"):
                payload[key] = value

        return json.dumps(payload, ensure_ascii=False, default=str)


def get_logger(name: str) -> logging.Logger:
    """
    Return a logger configured with JSONFormatter and a StreamHandler.

    Idempotent — repeated calls with the same name return the same logger
    without adding duplicate handlers.

    Args:
        name: Logger name. Pass __name__ from the calling module to get
              a hierarchical name (e.g., 'src.graph.nodes.slot_check').

    Returns:
        A Python Logger instance that emits JSON to stdout.
    """
    log = logging.getLogger(name)

    if not log.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        log.addHandler(handler)
        log.propagate = False

    if not log.level:
        log.setLevel(logging.INFO)

    return log
