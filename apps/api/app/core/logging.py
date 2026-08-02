import logging
import sys


def setup_logging() -> logging.Logger:
    """Configure standard application logging."""
    logger = logging.getLogger("blr_life")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
