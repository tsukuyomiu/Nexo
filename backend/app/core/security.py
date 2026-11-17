"""
Utilitários de segurança, hash de senhas e geração de tokens JWT para autenticação.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt

from app.core.config import settings

BRAZIL_TZ = timezone(timedelta(hours=-3))


def now_utc() -> datetime:
    """Retorna o datetime atual em UTC."""
    return datetime.now(timezone.utc)


def now_utc_iso() -> str:
    """Retorna timestamp ISO 8601 em UTC."""
    return now_utc().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def now_brazil_iso() -> str:
    """Retorna timestamp ISO 8601 no fuso horário de Brasília (-03:00)."""
    return datetime.now(BRAZIL_TZ).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "-03:00"


def generate_uuid() -> str:
    """Gera um identificador único UUID."""
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    """Gera o hash SHA-256 da senha para proteger a credencial no banco de dados."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Verifica se a senha informada confere com o hash salvo utilizando
    Structural Pattern Matching (PEP 634 - match/case) em vez de if/else.
    """
    match stored_hash.split("$"):
        case ["pbkdf2_sha256", iterations_str, salt, expected_hex]:
            candidate = hashlib.pbkdf2_hmac(
                "sha256",
                plain_password.encode("utf-8"),
                salt.encode("utf-8"),
                int(iterations_str),
            ).hex()
            return hmac.compare_digest(candidate, expected_hex)
        case [salt, expected_hash]:
            candidate = hashlib.sha256(f"{salt}{plain_password}".encode("utf-8")).hexdigest()
            return hmac.compare_digest(candidate, expected_hash)
        case [expected_hash]:
            candidate = hash_password(plain_password)
            return hmac.compare_digest(candidate, expected_hash)
        case _:
            return False


def generate_reset_code() -> str:
    """Gera um código numérico seguro de 6 dígitos para recuperação de senha."""
    return f"{secrets.randbelow(900_000) + 100_000}"


def hash_reset_code(email: str, code: str) -> str:
    """Gera um hash HMAC-SHA256 para o código de segurança vinculado ao e-mail."""
    msg = f"{email.strip().lower()}:{code.strip()}".encode("utf-8")
    return hmac.new(settings.NEXO_SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def create_access_token(
    subject: str,
    email: str,
    role: str = "user",
    jti: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> Dict[str, Any]:
    """Cria um token JWT assinado contendo `sub` (user_id), `email`, `role` e `jti`."""
    token_jti = jti or generate_uuid()
    expire = now_utc() + (
        expires_delta or timedelta(minutes=settings.NEXO_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": subject,
        "email": email,
        "role": role,
        "jti": token_jti,
        "iat": int(now_utc().timestamp()),
        "exp": int(expire.timestamp()),
    }
    encoded_jwt = jwt.encode(
        payload,
        settings.NEXO_SECRET_KEY,
        algorithm=settings.NEXO_JWT_ALGORITHM,
    )
    return {
        "access_token": encoded_jwt,
        "jti": token_jti,
        "expires_at": expire.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
    }


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodifica e valida um token JWT. Retorna None se inválido ou expirado."""
    try:
        payload = jwt.decode(
            token,
            settings.NEXO_SECRET_KEY,
            algorithms=[settings.NEXO_JWT_ALGORITHM],
        )
        return payload
    except Exception:
        return None
