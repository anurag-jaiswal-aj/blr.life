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
    from app.db.url import normalize_asyncpg_url, normalize_psycopg_url

    # --- Runtime / asyncpg tests ---
    # a. postgresql://...?sslmode=require&channel_binding=require ->
    #    postgresql+asyncpg://...?ssl=require with channel_binding absent
    url_a = normalize_asyncpg_url(
        "postgresql://user:pass@host/db?sslmode=require&channel_binding=require"
    )
    assert url_a == "postgresql+asyncpg://user:pass@host/db?ssl=require"

    # b. postgres://...?sslmode=require&channel_binding=require behaves the same
    url_b = normalize_asyncpg_url(
        "postgres://user:pass@host/db?sslmode=require&channel_binding=require"
    )
    assert url_b == "postgresql+asyncpg://user:pass@host/db?ssl=require"

    # c. already-normalized postgresql+asyncpg://...?ssl=require remains valid
    url_c = normalize_asyncpg_url("postgresql+asyncpg://user:pass@host/db?ssl=require")
    assert url_c == "postgresql+asyncpg://user:pass@host/db?ssl=require"

    # d & e. unrelated query parameters and credentials are preserved
    url_de = normalize_asyncpg_url(
        "postgresql://user:pass@host/db?foo=bar&sslmode=require&channel_binding=require"
    )
    assert url_de == "postgresql+asyncpg://user:pass@host/db?foo=bar&ssl=require"

    # --- Migration / psycopg tests ---
    # f. postgresql://...?sslmode=require&channel_binding=require -> postgresql+psycopg://...?sslmode=require&channel_binding=require
    url_f = normalize_psycopg_url(
        "postgresql://user:pass@host/db?sslmode=require&channel_binding=require"
    )
    assert url_f in (
        "postgresql+psycopg://user:pass@host/db?sslmode=require&channel_binding=require",
        "postgresql+psycopg://user:pass@host/db?channel_binding=require&sslmode=require",
    )

    # g. postgres:// behaves the same
    url_g = normalize_psycopg_url(
        "postgres://user:pass@host/db?sslmode=require&channel_binding=require"
    )
    assert url_g in (
        "postgresql+psycopg://user:pass@host/db?sslmode=require&channel_binding=require",
        "postgresql+psycopg://user:pass@host/db?channel_binding=require&sslmode=require",
    )

    # h. postgresql+asyncpg://...?ssl=require&channel_binding=require -> postgresql+psycopg://...?sslmode=require&channel_binding=require
    url_h = normalize_psycopg_url(
        "postgresql+asyncpg://user:pass@host/db?ssl=require&channel_binding=require"
    )
    assert url_h == "postgresql+psycopg://user:pass@host/db?channel_binding=require&sslmode=require"

    # i. unrelated query parameters are preserved
    url_i = normalize_psycopg_url("postgresql://user:pass@host/db?foo=bar")
    assert url_i == "postgresql+psycopg://user:pass@host/db?foo=bar"
