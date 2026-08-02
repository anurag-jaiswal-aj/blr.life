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
