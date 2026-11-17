"""
Schemas de Lançamentos Financeiros (Transactions) e Dashboard.
Alinhados 1:1 com `frontend/src/lib/transactions.ts`.
"""

from __future__ import annotations

from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

TransactionType = Literal["income", "expense"]
TransactionStatus = Literal["confirmado", "pendente"]


class TransactionCreate(BaseModel):
    id: Optional[str] = Field(default=None, description="ID único para persistência e integridade")
    description: str = Field(..., min_length=1, max_length=100, description="Descrição do lançamento")
    amount: float = Field(..., gt=0, description="Valor positivo maior que zero")
    date: str = Field(..., min_length=10, max_length=10, description="Data ISO YYYY-MM-DD")
    category: str = Field(..., min_length=1, max_length=60, description="Categoria do lançamento")
    type: TransactionType = Field(..., description="'income' (Receita) ou 'expense' (Despesa)")
    status: TransactionStatus = Field(default="confirmado", description="'confirmado' ou 'pendente'")
    paymentMethod: Optional[str] = Field(default="Pix", max_length=40, description="Forma de pagamento")
    contact: Optional[str] = Field(default="", max_length=100, description="Cliente ou Fornecedor")
    documentRef: Optional[str] = Field(default="", max_length=60, description="Nº NF-e, Recibo ou Pedido")
    recurring: Optional[bool] = Field(default=False, description="Se é receita/despesa fixa mensal")
    notes: Optional[str] = Field(default="", max_length=500, description="Observações gerenciais")

    @field_validator("description", "category")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("O campo não pode estar vazio.")
        return cleaned

    @field_validator("date")
    @classmethod
    def validate_iso_date(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
            return v
        except ValueError as exc:
            raise ValueError("Informe uma data válida no formato YYYY-MM-DD.") from exc


class TransactionUpdate(TransactionCreate):
    """Mesmo contrato para atualização completa do lançamento."""
    pass


class TransactionStatusPatch(BaseModel):
    status: TransactionStatus


class TransactionResponse(BaseModel):
    id: str
    description: str
    amount: float
    date: str
    category: str
    type: TransactionType
    status: TransactionStatus
    paymentMethod: str = "Pix"
    contact: str = ""
    documentRef: str = ""
    recurring: bool = False
    notes: str = ""
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class TotalsSummary(BaseModel):
    income: float
    expense: float
    balance: float


class CategoryExpenseSummary(BaseModel):
    category: str
    total: float
    percent: float
    count: int


class FinancialGoalPayload(BaseModel):
    month: str = Field(..., min_length=7, max_length=7, description="Mês YYYY-MM")
    revenueTarget: float = Field(default=0.0, ge=0.0, description="Meta de faturamento mensal")
    expenseLimit: float = Field(default=0.0, ge=0.0, description="Teto máximo de despesas no mês")


class FinancialGoalResponse(BaseModel):
    month: str
    revenueTarget: float
    expenseLimit: float


class CashflowHistoryItem(BaseModel):
    month: str
    income: float
    expense: float
    balance: float


class EntrepreneurKPIs(BaseModel):
    realizedIncome: float
    pendingIncome: float
    realizedExpense: float
    pendingExpense: float
    overdueCount: int
    overdueAmount: float
    fixedExpenses: float
    variableExpenses: float
    profitMarginPercent: float
    burnRatePercent: float
    averageIncomeTicket: float
    averageExpenseTicket: float


class DashboardSummaryResponse(BaseModel):
    month: str
    previousMonth: str
    currentTotals: TotalsSummary
    previousTotals: TotalsSummary
    expensesByCategory: List[CategoryExpenseSummary]
    recentTransactions: List[TransactionResponse]
    availableMonths: List[str]
    kpis: Optional[EntrepreneurKPIs] = None
    cashflowHistory: Optional[List[CashflowHistoryItem]] = None
    goal: Optional[FinancialGoalResponse] = None
