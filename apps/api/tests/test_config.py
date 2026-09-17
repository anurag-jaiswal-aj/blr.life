from app.core.config import Settings


def test_cors_origins_parsing() -> None:
    settings_json = Settings(
        CORS_ORIGINS='["http://localhost:3000", "http://127.0.0.1:3000"]'  # type: ignore[arg-type]
    )
    assert settings_json.CORS_ORIGINS == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    settings_csv = Settings(
        CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"  # type: ignore[arg-type]
    )
    assert settings_csv.CORS_ORIGINS == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def test_database_url_parsing() -> None:
    # 1. postgresql://... with sslmode=require
    s1 = Settings(DATABASE_URL="postgresql://user:pass@host/db?sslmode=require")
    assert s1.DATABASE_URL == "postgresql+asyncpg://user:pass@host/db?ssl=require"

    # 2. postgres://... with sslmode=require and other params
    s2 = Settings(DATABASE_URL="postgres://user:pass@host/db?sslmode=require&foo=bar")
    assert s2.DATABASE_URL == "postgresql+asyncpg://user:pass@host/db?foo=bar&ssl=require"

    # 3. already-normalized postgresql+asyncpg://...
    s3 = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@host/db?ssl=require")
    assert s3.DATABASE_URL == "postgresql+asyncpg://user:pass@host/db?ssl=require"

    # 4. preservation of unrelated query parameters
    s4 = Settings(DATABASE_URL="postgresql://user:pass@host/db?foo=bar")
    assert s4.DATABASE_URL == "postgresql+asyncpg://user:pass@host/db?foo=bar"
