"""
Injeção de Dependências do FastAPI:
- Extração de Usuário Autenticado (JWT Bearer)
- Construção automática do Contexto de Auditoria (Quem, IP, User-Agent, Rota, Request ID)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import NexoException
from app.core.security import (
    decode_access_token,
    deterministic_user_id,
    hash_password,
    now_utc_iso,
)
from app.db.models import SessionToken, User, UserProfilePreference
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def extract_client_ip(request: Request) -> str:
    """Extrai o IP real do cliente considerando proxies reversos."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


@dataclass
class AuditContext:
    """Contexto completo da requisição atual para alimentar o motor de logs."""

    request_id: str
    ip_address: str
    user_agent: str
    http_method: str
    http_route: str
    actor_id: Optional[str] = None
    actor_email: str = "anonimo@nexo.local"
    actor_name: str = "Visitante / Não Autenticado"


def _ensure_serverless_user(
    db: Session,
    email: str,
    name: str,
    user_id: Optional[str] = None,
    role_hint: str = "user",
) -> User:
    """
    Garante que o usuário autenticado exista no banco SQLite atual (mesmo após
    reinicialização de container serverless na nuvem).
    """
    email_clean = email.strip().lower()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        if email_clean in settings.admin_emails_set and existing.role != "admin":
            existing.role = "admin"
            db.commit()
            db.refresh(existing)
        return existing

    effective_role = (
        "admin"
        if (email_clean in settings.admin_emails_set or role_hint == "admin")
        else "user"
    )
    ts = now_utc_iso()
    uid = user_id or deterministic_user_id(email_clean)
    # Evita colisão de primary key caso outro registro use o mesmo ID
    if db.query(User).filter(User.id == uid).first():
        uid = deterministic_user_id(email_clean)

    display_name = (name or email_clean.split("@")[0] or "Usuário Nexo").strip()
    user = User(
        id=uid,
        nome=display_name,
        email=email_clean,
        senha_hash=hash_password(uid),
        role=effective_role,
        ativo=1,
        termos_aceitos=1,
        termos_aceitos_em=ts,
        ultimo_login_em=ts,
        criado_em=ts,
        atualizado_em=ts,
    )
    db.add(user)
    db.flush()

    prof = UserProfilePreference(
        usuario_id=user.id,
        telefone="",
        data_nascimento="",
        endereco="",
        moeda_preferida="BRL",
        dois_fatores_ativo=0,
        atualizado_em=ts,
    )
    db.add(prof)
    db.commit()
    db.refresh(user)
    return user


def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Tenta resolver o usuário logado a partir do header `Authorization: Bearer <token>`.
    Se o container serverless tiver reiniciado, recria automaticamente o registro do
    usuário no SQLite a partir do token JWT válido ou dos cabeçalhos de sessão.
    """
    header_email = (request.headers.get("x-nexo-user-email") or "").strip().lower()
    header_name = (request.headers.get("x-nexo-user-name") or "").strip()

    if not credentials or not credentials.credentials:
        return None

    raw_token = credentials.credentials.strip()

    # Suporte para sessões iniciadas em modo offline que reconectaram ao backend
    if raw_token.startswith("offline-") and header_email:
        role_for_email = "admin" if header_email in settings.admin_emails_set else "user"
        user = _ensure_serverless_user(
            db,
            email=header_email,
            name=header_name or header_email.split("@")[0],
            role_hint=role_for_email,
        )
        request.state.user_id = user.id
        request.state.user_email = user.email
        request.state.user_name = user.nome
        return user

    payload = decode_access_token(raw_token)
    if not payload:
        return None

    user_id = payload.get("sub")
    jti = payload.get("jti")
    jwt_email = (payload.get("email") or header_email or "").strip().lower()
    jwt_name = (payload.get("name") or header_name or "").strip()
    jwt_role = payload.get("role", "user")

    if not user_id and not jwt_email:
        return None

    # Verifica se a sessão foi revogada no banco
    if jti:
        session_record = (
            db.query(SessionToken)
            .filter(SessionToken.token_jti == jti, SessionToken.revogado == 1)
            .first()
        )
        if session_record:
            return None

    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id, User.ativo == 1).first()
    if not user and jwt_email:
        user = _ensure_serverless_user(
            db,
            email=jwt_email,
            name=jwt_name,
            user_id=user_id,
            role_hint=jwt_role,
        )

    if user:
        if header_name and user.nome != header_name and user.nome == user.email.split("@")[0]:
            user.nome = header_name
            db.commit()
        request.state.user_id = user.id
        request.state.user_email = user.email
        request.state.user_name = user.nome
    return user


def get_current_user(
    user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Exige um usuário autenticado válido, retornando 401 caso contrário."""
    if not user:
        raise NexoException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada. Faça login novamente.",
            error_code="UNAUTHORIZED",
        )
    return user


def get_audit_context(
    request: Request,
    user: Optional[User] = Depends(get_current_user_optional),
) -> AuditContext:
    """Constrói o contexto de auditoria enriquecido com os dados do usuário e da requisição."""
    req_id = getattr(request.state, "request_id", "req-internal")
    ip_addr = extract_client_ip(request)
    ua = request.headers.get("user-agent", "Unknown-Client")
    return AuditContext(
        request_id=req_id,
        ip_address=ip_addr,
        user_agent=ua,
        http_method=request.method,
        http_route=request.url.path,
        actor_id=user.id if user else None,
        actor_email=user.email if user else "anonimo@nexo.local",
        actor_name=user.nome if user else "Visitante / Não Autenticado",
    )
