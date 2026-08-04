import contextvars
import logging
import sys

request_id_ctx_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


class RequestIDFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        req_id = request_id_ctx_var.get()
        if req_id:
            record.req_id = f" [{req_id}]"
        else:
            record.req_id = ""
        return super().format(record)


def setup_logging() -> logging.Logger:
    """Configure standard application logging."""
    logger = logging.getLogger("blr_life")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = RequestIDFormatter(
            "[%(asctime)s] [%(levelname)s] [%(name)s]%(req_id)s: %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
