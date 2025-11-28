# app/database.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "❌ ERROR: DATABASE_URL is not set. "
        "Please set it in your .env "
        "(e.g., postgresql+psycopg2://user:pass@db:5432/dbname)"
    )

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://", "postgresql+psycopg2://", 1
    )

print(f">> Using DATABASE_URL = {DATABASE_URL}", flush=True)

engine_kwargs = {"pool_pre_ping": True}

if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update(
        {
            "pool_size": 5,
            "max_overflow": 10,
            "pool_recycle": 1800,  # ✅ กัน connection idle โดนตัด
            "pool_timeout": 30,
        }
    )

engine = create_engine(
    DATABASE_URL,
    future=True,   # ✅ optional แต่แนะนำ
    **engine_kwargs,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)
