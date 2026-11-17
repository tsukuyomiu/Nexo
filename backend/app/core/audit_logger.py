"""
Serviço de Registro de Auditoria e Logs de Acesso do Projeto Nexo.

Responsável por:
1. Mascarar automaticamente dados sensíveis (senhas, tokens, códigos).
2. Gravar eventos de negócio na tabela `audit_logs` via SQLAlchemy ORM.
3. Gravar o histórico de requisições HTTP na tabela `access_logs`.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.core.security import generate_uuid, now_brazil_iso, now_utc_iso
from app.db.models import AccessLog, AuditLog

logger = logging.getLogger("nexo.audit")

# Chaves que nunca devem ser gravadas em texto puro nos logs
SENSITIVE_KEYS = {
    "password",
    "senha",
    "senha_hash",
    "current_password",
    "new_password",
    "confirm",
    "confirm_password",
    "current",
    "next",
    "pass",
    "token",
    "access_token",
    "authorization",
    "code",
    "codigo",
    "codigo_hash",
    "secret",
}


def sanitize_payload(data: Any) -> Any:
    """
    Percorre dicionários e listas recursivamente mascarando qualquer chave sensível
    com `[REDACTED]` para proteger credenciais nos logs.
    """
    if data is None:
        return None
    if isinstance(data, dict):
        cleaned: Dict[str, Any] = {}
        for key, value in data.items():
            key_lower = str(key).strip().lower()
            if key_lower in SENSITIVE_KEYS or "password" in key_lower or "senha" in key_lower:
                cleaned[key] = "[REDACTED]"
            else:
                cleaned[key] = sanitize_payload(value)
        return cleaned
    if isinstance(data, list):
        return [sanitize_payload(item) for item in data]
    return data


def _to_json_str(data: Any) -> Optional[str]:
    """Serializa o dicionário sanitizado para string JSON."""
    if data is None:
        return None
    sanitized = sanitize_payload(data)
    return json.dumps(sanitized, ensure_ascii=False, default=str)


def record_audit_event(
    db: Session,
    *,
    action: str,
    category: str,
    entity_affected: str,
    summary: str,
    entity_id: Optional[str] = None,
    severity: str = "INFO",
    actor_id: Optional[str] = None,
    actor_email: str = "anonimo@nexo.local",
    actor_name: str = "Visitante / Sistema",
    ip_address: str = "127.0.0.1",
    user_agent: str = "Unknown",
    http_method: Optional[str] = None,
    http_route: Optional[str] = None,
    request_id: Optional[str] = None,
    before_data: Optional[Dict[str, Any]] = None,
    after_data: Optional[Dict[str, Any]] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
    origin: str = "API_PYTHON",
) -> Dict[str, Any]:
    """
    Registra um evento de auditoria na tabela `audit_logs` do banco de dados
    e retorna o dicionário com os dados gravados.
    """
    log_id = generate_uuid()
    ts_utc = now_utc_iso()
    ts_local = now_brazil_iso()

    before_json = _to_json_str(before_data)
    after_json = _to_json_str(after_data)
    meta_json = _to_json_str(extra_metadata)

    event_record = {
        "id": log_id,
        "data_hora_utc": ts_utc,
        "data_hora_local": ts_local,
        "usuario_id": actor_id,
        "usuario_email": actor_email or "anonimo@nexo.local",
        "usuario_nome": actor_name or "Visitante / Sistema",
        "ip_origem": ip_address or "127.0.0.1",
        "user_agent": user_agent or "Unknown",
        "metodo_http": http_method,
        "rota_http": http_route,
        "request_id": request_id,
        "acao": action,
        "categoria_evento": category,
        "severidade": severity,
        "entidade_afetada": entity_affected,
        "entidade_id": entity_id,
        "resumo_humano": summary,
        "dados_anteriores": sanitize_payload(before_data),
        "dados_novos": sanitize_payload(after_data),
        "metadados_extras": sanitize_payload(extra_metadata),
        "origem_registro": origin,
    }

    try:
        audit_row = AuditLog(
            id=log_id,
            data_hora_utc=ts_utc,
            data_hora_local=ts_local,
            usuario_id=actor_id,
            usuario_email=actor_email or "anonimo@nexo.local",
            usuario_nome=actor_name or "Visitante / Sistema",
            ip_origem=ip_address or "127.0.0.1",
            user_agent=user_agent or "Unknown",
            metodo_http=http_method,
            rota_http=http_route,
            request_id=request_id,
            acao=action,
            categoria_evento=category,
            severidade=severity,
            entidade_afetada=entity_affected,
            entidade_id=entity_id,
            resumo_humano=summary,
            dados_anteriores=before_json,
            dados_novos=after_json,
            metadados_extras=meta_json,
            origem_registro=origin,
        )
        db.add(audit_row)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Falha ao gravar audit_log no banco: %s", exc)

    return event_record


def record_access_log(
    db: Session,
    *,
    request_id: str,
    http_method: str,
    route: str,
    status_code: int,
    response_time_ms: float,
    ip_address: str,
    user_agent: str,
    query_params: Optional[str] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    error_detail: Optional[str] = None,
) -> None:
    """Registra os metadados de cada requisição HTTP na tabela `access_logs`."""
    try:
        access_row = AccessLog(
            id=generate_uuid(),
            data_hora_utc=now_utc_iso(),
            data_hora_local=now_brazil_iso(),
            request_id=request_id,
            usuario_id=user_id,
            usuario_email=user_email,
            metodo_http=http_method,
            rota=route,
            query_params=query_params,
            status_code=status_code,
            tempo_resposta_ms=round(response_time_ms, 2),
            ip_origem=ip_address,
            user_agent=user_agent,
            erro_detalhe=error_detail,
        )
        db.add(access_row)
        db.commit()
    except Exception:
        db.rollback()
