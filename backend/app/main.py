"""
Arquivo principal da API do Projeto Nexo (FastAPI).
Configura o banco de dados, middlewares, rotas e documentação Swagger (/docs).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, dashboard, logs, transactions, users
from app.core.config import settings
from app.core.exceptions import (
    NexoException,
    nexo_exception_handler,
    validation_exception_handler,
)
from app.core.security import now_brazil_iso, now_utc_iso
from app.db.scripts.init_db import initialize_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Inicializa as tabelas SQL e dados iniciais ao subir o servidor."""
    initialize_database()
    yield


app = FastAPI(
    title=settings.NEXO_APP_NAME,
    version=settings.NEXO_VERSION,
    description="API REST do Projeto Nexo — Gestão Financeira e Auditoria de Logs.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configuração de CORS liberada para localhost, rede local (LAN) e front-end em nuvem
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tratamento de erros da API
app.add_exception_handler(NexoException, nexo_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]

# Registro das rotas em /api/v1
api_prefix = settings.NEXO_API_V1_PREFIX
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(transactions.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(logs.router, prefix=api_prefix)


@app.get("/", tags=["Status"])
def root() -> Dict[str, Any]:
    """Rota inicial para verificar se a API está online."""
    return {
        "ok": True,
        "service": settings.NEXO_APP_NAME,
        "version": settings.NEXO_VERSION,
        "environment": settings.NEXO_ENV,
        "timestamp_brasilia": now_brazil_iso(),
        "timestamp_utc": now_utc_iso(),
        "docs_swagger": "/docs",
    }


@app.get("/health", tags=["Status"])
def healthcheck() -> Dict[str, Any]:
    """Verifica a saúde do servidor."""
    return {
        "status": "healthy",
        "timestamp_brasilia": now_brazil_iso(),
    }
