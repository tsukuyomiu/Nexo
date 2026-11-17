"""
Configurações do Back-End Nexo.
Define os diretórios do projeto e carrega variáveis de ambiente (ou .env).
"""

from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT_DIR = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
LOGS_DIR = BACKEND_DIR / "logs"
SQL_DIR = PROJECT_ROOT_DIR / "database" / "sql"
SEEDS_DIR = PROJECT_ROOT_DIR / "database" / "json_seeds"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "backups").mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    """Configurações principais da API."""

    NEXO_ENV: str = "development"
    NEXO_APP_NAME: str = "Projeto Nexo API"
    NEXO_VERSION: str = "1.0.0"
    NEXO_API_V1_PREFIX: str = "/api/v1"

    # Banco de Dados SQLite local por padrão
    NEXO_DATABASE_URL: str = f"sqlite:///{(DATA_DIR / 'nexo.db').as_posix()}"

    # Configurações JWT
    NEXO_SECRET_KEY: str = "nexo-secret-jwt-key-2026-project-academic-auth"
    NEXO_JWT_ALGORITHM: str = "HS256"
    NEXO_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    NEXO_RESET_CODE_EXPIRE_MINUTES: int = 15

    # Origens permitidas no CORS
    NEXO_CORS_ORIGINS: str = (
        "http://localhost:3000,http://localhost:5173,http://localhost:8080,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:8080"
    )

    # Configurações de Acesso Administrativo
    NEXO_LOGS_PUBLIC_IN_DEV: bool = False
    NEXO_ADMIN_EMAILS: str = "admin@nexo.com,ggnonato@gmail.com,tylex.dev@gmail.com"
    NEXO_ADMIN_MASTER_CODE: str = "NEXO-ADM-2026"

    # Configurações de SMTP (opcional, via .env)
    NEXO_SMTP_HOST: str = "smtp.gmail.com"
    NEXO_SMTP_PORT: int = 587
    NEXO_SMTP_USER: str = ""
    NEXO_SMTP_PASSWORD: str = ""
    NEXO_ALERT_EMAIL_TO: str = "admin@nexo.com"

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.NEXO_CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def admin_emails_set(self) -> set[str]:
        return {e.strip().lower() for e in self.NEXO_ADMIN_EMAILS.split(",") if e.strip()}


settings = Settings()
