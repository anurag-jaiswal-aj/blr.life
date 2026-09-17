from sqlalchemy.engine.url import make_url


def normalize_asyncpg_url(raw_url: str) -> str:
    """Normalize a raw PostgreSQL URL for asyncpg runtime compatibility."""
    url = make_url(raw_url)

    if url.drivername in ("postgres", "postgresql"):
        url = url.set(drivername="postgresql+asyncpg")

    if url.drivername == "postgresql+asyncpg":
        query = dict(url.query)
        # Convert sslmode to ssl
        if "sslmode" in query:
            query["ssl"] = query.pop("sslmode")
        # Remove unsupported channel_binding
        if "channel_binding" in query:
            query.pop("channel_binding")
        url = url.set(query=query)

    return url.render_as_string(hide_password=False)


def normalize_psycopg_url(raw_url: str) -> str:
    """Normalize a raw PostgreSQL URL for psycopg (synchronous) migration compatibility."""
    url = make_url(raw_url)

    if url.drivername in ("postgres", "postgresql", "postgresql+asyncpg"):
        url = url.set(drivername="postgresql+psycopg")

    if url.drivername == "postgresql+psycopg":
        query = dict(url.query)
        # Convert ssl to sslmode in case it was pre-normalized
        if "ssl" in query:
            query["sslmode"] = query.pop("ssl")
        url = url.set(query=query)

    return url.render_as_string(hide_password=False)
