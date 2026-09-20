import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent

# Resolve Database URL:
# 1. If DATABASE_URL is in environment (e.g., Render / Supabase / Neon PostgreSQL), use it.
#    (Fix Render/Heroku legacy 'postgres://' schema to 'postgresql://')
# 2. Otherwise default to a persistent local SQLite file in the backend directory.
raw_db_url = os.environ.get("DATABASE_URL", "").strip()

if raw_db_url:
    if raw_db_url.startswith("postgres://"):
        DATABASE_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
    else:
        DATABASE_URL = raw_db_url
    connect_args = {}
else:
    db_file_path = CURRENT_DIR / "deepguard.db"
    DATABASE_URL = f"sqlite:///{db_file_path.as_posix()}"
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    """FastAPI dependency yielding an independent database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_database_status():
    """Returns metadata about the active database connection."""
    firebase_project = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    if firebase_project:
        return {
            "status": "connected",
            "engine": "FIREBASE",
            "is_sqlite": False,
            "target": f"Google Cloud Firestore ({firebase_project})"
        }

    dialect_name = engine.dialect.name
    return {
        "status": "connected",
        "engine": dialect_name.upper(),
        "is_sqlite": dialect_name == "sqlite",
        "target": "Local File (deepguard.db)" if dialect_name == "sqlite" else "Remote Cloud Database"
    }


def ensure_schema():
    """Lightweight auto-migration for SQLite to guarantee newly added columns exist."""
    try:
        if engine.dialect.name == "sqlite":
            with engine.begin() as conn:
                res = conn.exec_driver_sql("PRAGMA table_info(scan_records)")
                cols = [r[1] for r in res.fetchall()]
                if cols and "face_count" not in cols:
                    conn.exec_driver_sql("ALTER TABLE scan_records ADD COLUMN face_count INTEGER DEFAULT 1")
    except Exception as e:
        print(f"Warning in schema migration: {e}")

