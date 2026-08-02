"""fix housing_config enum

Revision ID: 0003
Revises: 95a735a7c999
Create Date: 2026-08-02 17:40:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "95a735a7c999"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rename enum values safely, but only if they are still at the old state
    # This prevents failures on DBs that were already patched manually.
    op.execute("""
    DO $$ 
    BEGIN 
      IF EXISTS (
          SELECT 1 FROM pg_type t 
          JOIN pg_enum e ON t.oid = e.enumtypid 
          WHERE t.typname = 'housing_configuration' AND e.enumlabel = 'rk_1'
      ) THEN
        ALTER TYPE housing_configuration RENAME VALUE 'rk_1' TO '1rk';
        ALTER TYPE housing_configuration RENAME VALUE 'bhk_1' TO '1bhk';
        ALTER TYPE housing_configuration RENAME VALUE 'bhk_2' TO '2bhk';
        ALTER TYPE housing_configuration RENAME VALUE 'bhk_3' TO '3bhk';
      END IF;
    END $$;
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ 
    BEGIN 
      IF EXISTS (
          SELECT 1 FROM pg_type t 
          JOIN pg_enum e ON t.oid = e.enumtypid 
          WHERE t.typname = 'housing_configuration' AND e.enumlabel = '1rk'
      ) THEN
        ALTER TYPE housing_configuration RENAME VALUE '1rk' TO 'rk_1';
        ALTER TYPE housing_configuration RENAME VALUE '1bhk' TO 'bhk_1';
        ALTER TYPE housing_configuration RENAME VALUE '2bhk' TO 'bhk_2';
        ALTER TYPE housing_configuration RENAME VALUE '3bhk' TO 'bhk_3';
      END IF;
    END $$;
    """)
