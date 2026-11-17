"""
Script de Inicialização e Orquestração do Banco de Dados do Projeto Nexo.

Executa na ordem correta os arquivos DDL em `database/sql/`:
  1. `schema_usuarios.sql`
  2. `schema_projetos.sql`
  3. `schema_relatorios.sql`
  4. `schema_logs.sql` (incluindo Views e Triggers SQL de Auditoria)

Em seguida, aplica de forma idempotente o seed inicial de Administrador/Demo
definido em `database/json_seeds/admin_seed.json`.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.audit_logger import record_audit_event
from app.core.config import SEEDS_DIR, SQL_DIR, settings
from app.core.security import generate_uuid, hash_password, now_utc_iso
from app.db.models import FinancialGoal, TransactionModel, User, UserProfilePreference
from app.db.session import Base, SessionLocal, engine, is_sqlite

SQL_FILES_ORDER = [
    "schema_usuarios.sql",
    "schema_projetos.sql",
    "schema_relatorios.sql",
    "schema_logs.sql",
]


def _migrate_sqlite_columns(cursor: sqlite3.Cursor) -> None:
    """Garante migração automática e não-destrutiva das colunas empresariais em bancos existentes."""
    cursor.execute("PRAGMA table_info(lancamentos)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    if not existing_cols:
        return

    new_columns = [
        ("forma_pagamento", "TEXT NOT NULL DEFAULT 'Pix'"),
        ("contato", "TEXT NOT NULL DEFAULT ''"),
        ("documento_ref", "TEXT NOT NULL DEFAULT ''"),
        ("recorrente", "INTEGER NOT NULL DEFAULT 0"),
        ("observacoes", "TEXT NOT NULL DEFAULT ''"),
    ]
    for col_name, col_def in new_columns:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE lancamentos ADD COLUMN {col_name} {col_def}")


def apply_sql_schemas() -> None:
    """Executa os scripts SQL padronizados (com CTEs e Views) e garante as tabelas ORM."""
    Base.metadata.create_all(bind=engine)
    if is_sqlite:
        raw_conn = engine.raw_connection()
        try:
            cursor = raw_conn.cursor()
            for filename in ["schema_usuarios.sql", "schema_projetos.sql"]:
                sql_path: Path = SQL_DIR / filename
                if sql_path.exists():
                    cursor.executescript(sql_path.read_text(encoding="utf-8"))
            _migrate_sqlite_columns(cursor)
            for filename in ["schema_relatorios.sql", "schema_logs.sql"]:
                sql_path = SQL_DIR / filename
                if sql_path.exists():
                    cursor.executescript(sql_path.read_text(encoding="utf-8"))
            raw_conn.commit()
        finally:
            raw_conn.close()


def seed_initial_data(db: Session) -> None:
    """Popula o usuário administrador e lançamentos de exemplo se o banco estiver vazio."""
    seed_file = SEEDS_DIR / "admin_seed.json"
    if not seed_file.exists():
        return

    payload = json.loads(seed_file.read_text(encoding="utf-8"))
    users_data = payload.get("users", [])

    for u_item in users_data:
        email = u_item["email"].strip().lower()
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            # Atualiza de forma idempotente os dados empresariais de seed se aplicável
            ts = now_utc_iso()
            for tx_item in u_item.get("sample_transactions", []):
                tx_id = tx_item.get("id")
                existing_tx = db.query(TransactionModel).filter(TransactionModel.id == tx_id).first()
                if existing_tx:
                    if not existing_tx.contato and tx_item.get("contact"):
                        existing_tx.contato = tx_item.get("contact", "")
                        existing_tx.forma_pagamento = tx_item.get("paymentMethod", "Pix")
                        existing_tx.documento_ref = tx_item.get("documentRef", "")
                        existing_tx.recorrente = 1 if tx_item.get("recurring", False) else 0
                else:
                    db.add(
                        TransactionModel(
                            id=tx_id,
                            usuario_id=existing.id,
                            descricao=tx_item["description"],
                            valor=float(tx_item["amount"]),
                            data_lancamento=tx_item["date"],
                            categoria=tx_item["category"],
                            tipo=tx_item["type"],
                            status=tx_item.get("status", "confirmado"),
                            forma_pagamento=tx_item.get("paymentMethod", "Pix"),
                            contato=tx_item.get("contact", ""),
                            documento_ref=tx_item.get("documentRef", ""),
                            recorrente=1 if tx_item.get("recurring", False) else 0,
                            observacoes=tx_item.get("notes", ""),
                            criado_em=ts,
                            atualizado_em=ts,
                        )
                    )
            for goal_item in u_item.get("sample_goals", []):
                existing_goal = (
                    db.query(FinancialGoal)
                    .filter(
                        FinancialGoal.usuario_id == existing.id,
                        FinancialGoal.mes_referencia == goal_item["month"],
                    )
                    .first()
                )
                if not existing_goal:
                    db.add(
                        FinancialGoal(
                            id=generate_uuid(),
                            usuario_id=existing.id,
                            mes_referencia=goal_item["month"],
                            meta_receita=float(goal_item.get("revenueTarget", 0)),
                            teto_despesa=float(goal_item.get("expenseLimit", 0)),
                            criado_em=ts,
                            atualizado_em=ts,
                        )
                    )
            db.commit()
            continue

        ts = now_utc_iso()
        new_user = User(
            id=u_item.get("id"),
            nome=u_item["name"],
            email=email,
            senha_hash=hash_password(u_item["password_plain_for_seed"]),
            role=u_item.get("role", "admin"),
            ativo=1,
            termos_aceitos=1 if u_item.get("terms_accepted", True) else 0,
            termos_aceitos_em=ts,
            criado_em=ts,
            atualizado_em=ts,
        )
        db.add(new_user)
        db.flush()

        prof_data = u_item.get("profile", {})
        profile = UserProfilePreference(
            usuario_id=new_user.id,
            telefone=prof_data.get("phone", ""),
            data_nascimento=prof_data.get("birthDate", ""),
            endereco=prof_data.get("address", ""),
            moeda_preferida=prof_data.get("currency", "BRL"),
            dois_fatores_ativo=1 if prof_data.get("twoFactorEnabled", False) else 0,
            atualizado_em=ts,
        )
        db.add(profile)

        for tx_item in u_item.get("sample_transactions", []):
            tx = TransactionModel(
                id=tx_item.get("id"),
                usuario_id=new_user.id,
                descricao=tx_item["description"],
                valor=float(tx_item["amount"]),
                data_lancamento=tx_item["date"],
                categoria=tx_item["category"],
                tipo=tx_item["type"],
                status=tx_item.get("status", "confirmado"),
                forma_pagamento=tx_item.get("paymentMethod", "Pix"),
                contato=tx_item.get("contact", ""),
                documento_ref=tx_item.get("documentRef", ""),
                recorrente=1 if tx_item.get("recurring", False) else 0,
                observacoes=tx_item.get("notes", ""),
                criado_em=ts,
                atualizado_em=ts,
            )
            db.add(tx)

        for goal_item in u_item.get("sample_goals", []):
            goal = FinancialGoal(
                id=generate_uuid(),
                usuario_id=new_user.id,
                mes_referencia=goal_item["month"],
                meta_receita=float(goal_item.get("revenueTarget", 0)),
                teto_despesa=float(goal_item.get("expenseLimit", 0)),
                criado_em=ts,
                atualizado_em=ts,
            )
            db.add(goal)

        db.commit()

        record_audit_event(
            db,
            action="SYSTEM_SEED_INITIALIZED",
            category="SYSTEM",
            severity="INFO",
            entity_affected="usuarios",
            entity_id=new_user.id,
            actor_id=new_user.id,
            actor_email=new_user.email,
            actor_name=new_user.nome,
            summary=(
                f"Inicialização do banco Nexo: conta '{new_user.nome}' ({new_user.email}) "
                f"e {len(u_item.get('sample_transactions', []))} lançamentos iniciais provisionados."
            ),
            after_data={
                "user_id": new_user.id,
                "email": new_user.email,
                "role": new_user.role,
                "sample_transactions_count": len(u_item.get("sample_transactions", [])),
            },
            origin="SYSTEM",
        )


def initialize_database() -> None:
    """Função principal chamada no boot do servidor FastAPI ou via CLI."""
    apply_sql_schemas()
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()


if __name__ == "__main__":
    initialize_database()
    print(f"[NEXO DB] Banco inicializado com sucesso em: {settings.NEXO_DATABASE_URL}")
