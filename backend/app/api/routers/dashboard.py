"""
Rotas de Dashboard e Relatórios Financeiros (`/api/v1/dashboard`):
- GET  `/summary`: Consolida Receitas, Despesas, Saldo, Comparativo com Mês Anterior,
                   Despesas por Categoria e Últimos Lançamentos.
- POST `/reports`: Gera e registra na tabela `relatorios_exportados` um relatório
                   oficial consolidado do período.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import AuditContext, get_audit_context, get_current_user
from app.api.routers.transactions import _to_response
from app.core.audit_logger import record_audit_event
from app.core.security import generate_uuid, now_utc_iso
from app.db.models import ExportedReport, FinancialGoal, TransactionModel, User
from app.db.session import get_db
from app.schemas.transaction import (
    CashflowHistoryItem,
    CategoryExpenseSummary,
    DashboardSummaryResponse,
    EntrepreneurKPIs,
    FinancialGoalPayload,
    FinancialGoalResponse,
    TotalsSummary,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Relatórios"])


def _prev_month_key(month_key: str) -> str:
    try:
        y_str, m_str = month_key.split("-")
        y, m = int(y_str), int(m_str)
        if m == 1:
            return f"{y - 1}-12"
        return f"{y:04d}-{m - 1:02d}"
    except Exception:
        today = date.today()
        return f"{today.year:04d}-{today.month:02d}"


def _calc_totals(items: List[TransactionModel]) -> TotalsSummary:
    inc = round(sum(float(t.valor) for t in items if t.tipo == "income"), 2)
    exp = round(sum(float(t.valor) for t in items if t.tipo == "expense"), 2)
    return TotalsSummary(income=inc, expense=exp, balance=round(inc - exp, 2))


def _calc_kpis(items: List[TransactionModel]) -> EntrepreneurKPIs:
    today_iso = date.today().isoformat()
    incomes = [t for t in items if t.tipo == "income"]
    expenses = [t for t in items if t.tipo == "expense"]

    realized_inc = round(sum(float(t.valor) for t in incomes if t.status == "confirmado"), 2)
    pending_inc = round(sum(float(t.valor) for t in incomes if t.status == "pendente"), 2)
    realized_exp = round(sum(float(t.valor) for t in expenses if t.status == "confirmado"), 2)
    pending_exp = round(sum(float(t.valor) for t in expenses if t.status == "pendente"), 2)

    overdue_txs = [t for t in items if t.status == "pendente" and t.data_lancamento < today_iso]
    overdue_count = len(overdue_txs)
    overdue_amount = round(sum(float(t.valor) for t in overdue_txs), 2)

    fixed_exp = round(sum(float(t.valor) for t in expenses if t.recorrente), 2)
    var_exp = round(sum(float(t.valor) for t in expenses if not t.recorrente), 2)

    total_inc = realized_inc + pending_inc
    total_exp = realized_exp + pending_exp
    profit_margin = round(((total_inc - total_exp) / total_inc) * 100.0, 1) if total_inc > 0 else 0.0
    burn_rate = round((total_exp / total_inc) * 100.0, 1) if total_inc > 0 else 0.0

    avg_inc = round(total_inc / len(incomes), 2) if incomes else 0.0
    avg_exp = round(total_exp / len(expenses), 2) if expenses else 0.0

    return EntrepreneurKPIs(
        realizedIncome=realized_inc,
        pendingIncome=pending_inc,
        realizedExpense=realized_exp,
        pendingExpense=pending_exp,
        overdueCount=overdue_count,
        overdueAmount=overdue_amount,
        fixedExpenses=fixed_exp,
        variableExpenses=var_exp,
        profitMarginPercent=profit_margin,
        burnRatePercent=burn_rate,
        averageIncomeTicket=avg_inc,
        averageExpenseTicket=avg_exp,
    )


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    month: Optional[str] = Query(default=None, description="Mês no formato YYYY-MM"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    """Retorna todas as métricas necessárias para a tela `/dashboard` e `/perfil`."""
    current_month = month or date.today().strftime("%Y-%m")
    previous_month = _prev_month_key(current_month)

    all_tx = (
        db.query(TransactionModel)
        .filter(TransactionModel.usuario_id == user.id)
        .order_by(TransactionModel.data_lancamento.desc(), TransactionModel.criado_em.desc())
        .all()
    )

    current_tx = [t for t in all_tx if t.data_lancamento.startswith(current_month)]
    prev_tx = [t for t in all_tx if t.data_lancamento.startswith(previous_month)]

    current_totals = _calc_totals(current_tx)
    prev_totals = _calc_totals(prev_tx)
    kpis = _calc_kpis(current_tx)

    # Agrupamento de despesas por categoria (mesma regra de `expensesByCategory` do Front-End)
    cat_map: Dict[str, Dict[str, float | int]] = {}
    for t in current_tx:
        if t.tipo == "expense":
            entry = cat_map.setdefault(t.categoria, {"total": 0.0, "count": 0})
            entry["total"] = float(entry["total"]) + float(t.valor)
            entry["count"] = int(entry["count"]) + 1

    total_exp = current_totals.expense
    by_category = [
        CategoryExpenseSummary(
            category=cat,
            total=round(float(vals["total"]), 2),
            percent=round((float(vals["total"]) / total_exp) * 100.0, 2) if total_exp > 0 else 0.0,
            count=int(vals["count"]),
        )
        for cat, vals in cat_map.items()
    ]
    by_category.sort(key=lambda c: c.total, reverse=True)

    months_set = {t.data_lancamento[:7] for t in all_tx if len(t.data_lancamento) >= 7}
    months_set.add(date.today().strftime("%Y-%m"))
    available_months = sorted(months_set, reverse=True)

    # Histórico dos últimos 6 meses para o gráfico de Evolução de Fluxo de Caixa
    history_keys: List[str] = []
    cursor_m = current_month
    for _ in range(6):
        history_keys.append(cursor_m)
        cursor_m = _prev_month_key(cursor_m)
    history_keys.reverse()

    cashflow_history = []
    for m_key in history_keys:
        m_items = [t for t in all_tx if t.data_lancamento.startswith(m_key)]
        m_tot = _calc_totals(m_items)
        cashflow_history.append(
            CashflowHistoryItem(
                month=m_key,
                income=m_tot.income,
                expense=m_tot.expense,
                balance=m_tot.balance,
            )
        )

    goal_row = (
        db.query(FinancialGoal)
        .filter(FinancialGoal.usuario_id == user.id, FinancialGoal.mes_referencia == current_month)
        .first()
    )
    goal_resp = FinancialGoalResponse(
        month=current_month,
        revenueTarget=round(float(goal_row.meta_receita), 2) if goal_row else 0.0,
        expenseLimit=round(float(goal_row.teto_despesa), 2) if goal_row else 0.0,
    )

    return DashboardSummaryResponse(
        month=current_month,
        previousMonth=previous_month,
        currentTotals=current_totals,
        previousTotals=prev_totals,
        expensesByCategory=by_category,
        recentTransactions=[_to_response(t) for t in current_tx[:6]],
        availableMonths=available_months,
        kpis=kpis,
        cashflowHistory=cashflow_history,
        goal=goal_resp,
    )


@router.get("/goals", response_model=FinancialGoalResponse)
def get_financial_goal(
    month: Optional[str] = Query(default=None, description="Mês YYYY-MM"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FinancialGoalResponse:
    """Retorna a Meta de Faturamento e o Teto de Gastos do mês para o empreendedor."""
    target_month = month or date.today().strftime("%Y-%m")
    row = (
        db.query(FinancialGoal)
        .filter(FinancialGoal.usuario_id == user.id, FinancialGoal.mes_referencia == target_month)
        .first()
    )
    return FinancialGoalResponse(
        month=target_month,
        revenueTarget=round(float(row.meta_receita), 2) if row else 0.0,
        expenseLimit=round(float(row.teto_despesa), 2) if row else 0.0,
    )


@router.put("/goals", response_model=FinancialGoalResponse)
def upsert_financial_goal(
    payload: FinancialGoalPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    audit: AuditContext = Depends(get_audit_context),
) -> FinancialGoalResponse:
    """Define ou atualiza a Meta de Faturamento e o Teto de Gastos do mês no banco SQL."""
    ts = now_utc_iso()
    row = (
        db.query(FinancialGoal)
        .filter(
            FinancialGoal.usuario_id == user.id,
            FinancialGoal.mes_referencia == payload.month,
        )
        .first()
    )
    before_data = (
        {
            "month": row.mes_referencia,
            "revenueTarget": round(float(row.meta_receita), 2),
            "expenseLimit": round(float(row.teto_despesa), 2),
        }
        if row
        else None
    )

    if row:
        row.meta_receita = round(float(payload.revenueTarget), 2)
        row.teto_despesa = round(float(payload.expenseLimit), 2)
        row.atualizado_em = ts
    else:
        row = FinancialGoal(
            id=generate_uuid(),
            usuario_id=user.id,
            mes_referencia=payload.month,
            meta_receita=round(float(payload.revenueTarget), 2),
            teto_despesa=round(float(payload.expenseLimit), 2),
            criado_em=ts,
            atualizado_em=ts,
        )
        db.add(row)

    db.commit()
    db.refresh(row)

    after_data = {
        "month": row.mes_referencia,
        "revenueTarget": round(float(row.meta_receita), 2),
        "expenseLimit": round(float(row.teto_despesa), 2),
    }

    record_audit_event(
        db,
        action="FINANCIAL_GOAL_UPDATED",
        category="PREFERENCES",
        severity="INFO",
        entity_affected="metas_financeiras",
        entity_id=row.id,
        actor_id=user.id,
        actor_email=user.email,
        actor_name=user.nome,
        ip_address=audit.ip_address,
        user_agent=audit.user_agent,
        http_method=audit.http_method,
        http_route=audit.http_route,
        request_id=audit.request_id,
        summary=(
            f"{user.nome} ({user.email}) definiu metas para {row.mes_referencia}: "
            f"Meta de Receita R$ {row.meta_receita:.2f} | Teto de Gastos R$ {row.teto_despesa:.2f}."
        ),
        before_data=before_data,
        after_data=after_data,
    )

    return FinancialGoalResponse(
        month=row.mes_referencia,
        revenueTarget=round(float(row.meta_receita), 2),
        expenseLimit=round(float(row.teto_despesa), 2),
    )


@router.post("/reports")
def generate_financial_report(
    month: Optional[str] = Query(default=None, description="Mês de referência YYYY-MM ou 'ALL'"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    audit: AuditContext = Depends(get_audit_context),
) -> Dict[str, Any]:
    """
    Gera um relatório consolidado das movimentações financeiras do usuário,
    armazena na tabela `relatorios_exportados` e registra o evento de auditoria.
    """
    period = month or date.today().strftime("%Y-%m")
    summary_data = get_dashboard_summary(month=period if period != "ALL" else None, user=user, db=db)

    metrics_dict = summary_data.model_dump()
    metrics_json = json.dumps(metrics_dict, ensure_ascii=False)

    report_row = ExportedReport(
        id=generate_uuid(),
        usuario_id=user.id,
        titulo=f"Relatório Financeiro Nexo - {period}",
        tipo_relatorio="FINANCEIRO_MENSAL",
        periodo_referencia=period,
        formato="JSON",
        filtros_json=json.dumps({"month": period}),
        resumo_metricas=metrics_json,
        ip_solicitante=audit.ip_address,
        criado_em=now_utc_iso(),
    )
    db.add(report_row)
    db.commit()

    record_audit_event(
        db,
        action="FINANCIAL_REPORT_GENERATED",
        category="REPORT",
        severity="INFO",
        entity_affected="relatorios_exportados",
        entity_id=report_row.id,
        actor_id=user.id,
        actor_email=user.email,
        actor_name=user.nome,
        ip_address=audit.ip_address,
        user_agent=audit.user_agent,
        http_method=audit.http_method,
        http_route=audit.http_route,
        request_id=audit.request_id,
        summary=f"{user.nome} ({user.email}) gerou o Relatório Financeiro do período {period}.",
        after_data={
            "report_id": report_row.id,
            "period": period,
            "totals": summary_data.currentTotals.model_dump(),
        },
    )

    return {
        "ok": True,
        "report_id": report_row.id,
        "title": report_row.titulo,
        "period": period,
        "created_at": report_row.criado_em,
        "data": metrics_dict,
    }
