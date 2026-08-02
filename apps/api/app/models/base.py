"""SQLAlchemy declarative base with PostgreSQL naming conventions.

All domain models inherit from this Base so that Alembic sees a single
unified MetaData object and can generate consistent constraint/index names.

Naming convention:
  ix  → index
  uq  → unique constraint
  ck  → check constraint
  fk  → foreign key
  pk  → primary key
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Project-wide declarative base."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
