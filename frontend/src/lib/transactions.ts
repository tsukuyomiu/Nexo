// Camada única de dados dos lançamentos do Nexo.
// PERSISTÊNCIA TEMPORÁRIA: usa localStorage apenas para o protótipo e será
// substituída pela integração com o Back-End. Para trocar, altere apenas
// loadTransactions/saveTransactions — o restante do app não muda.
import { validLocalScope } from "@/lib/local-identity";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "confirmado" | "pendente";

export interface Transaction {
  id: string;
  description: string;
  amount: number; // sempre positivo; o sinal é dado pelo tipo
  date: string; // ISO YYYY-MM-DD
  category: string;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod?: string;
  contact?: string;
  documentRef?: string;
  recurring?: boolean;
  notes?: string;
}

export interface MonthlyGoal {
  month: string; // YYYY-MM
  revenueTarget: number;
  expenseLimit: number;
}

export const PAYMENT_METHODS = [
  "Pix",
  "Boleto",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Transferência",
  "Dinheiro",
] as const;

export const INCOME_CATEGORIES = ["Salário", "Vendas", "Serviços", "Investimentos", "Outros"];
export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Lazer",
  "Educação",
  "Supermercado",
  "Serviços",
  "Fornecedores",
  "Impostos",
  "Marketing",
  "Folha & RH",
  "Outros",
];

const STORAGE_KEY = "nexo:transactions";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function loadTransactions(scope?: string | null): Transaction[] {
  // undefined mantém o adaptador legado para inspeção/testes. O app sempre
  // fornece o escopo explícito; null significa sem identificação, nunca legado.
  if (scope === null || (scope !== undefined && !validLocalScope(scope))) return [];
  try {
    const raw = localStorage.getItem(scope === undefined ? STORAGE_KEY : `${STORAGE_KEY}:${scope}`);
    if (raw === null) return []; // não cria exemplos nem remove registros existentes
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Transaction[]) : [];
  } catch {
    return []; // JSON inválido ou armazenamento indisponível: lista vazia
  }
}

export function saveTransactions(list: Transaction[], scope?: string | null): void {
  if (scope === null || (scope !== undefined && !validLocalScope(scope))) return;
  try {
    localStorage.setItem(
      scope === undefined ? STORAGE_KEY : `${STORAGE_KEY}:${scope}`,
      JSON.stringify(list),
    );
  } catch {
    // armazenamento cheio ou indisponível: ignora sem quebrar o app
  }
}

export function createTransaction(data: Omit<Transaction, "id">): Transaction {
  return { ...data, id: newId() };
}

// Ordenação única do app: data decrescente; o desempate é a ordem de
// inserção (novos entram no início da coleção e o sort é estável).
export function sortTransactions(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

export interface Totals {
  income: number;
  expense: number;
  balance: number;
}

// Regra de cálculo única, usada por Dashboard, Lançamentos e Perfil.
export function calcTotals(list: Transaction[]): Totals {
  const income = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

// Distribuição das despesas por categoria (percentual do total de despesas).
export function expensesByCategory(
  list: Transaction[],
): { category: string; total: number; percent: number }[] {
  const expenses = list.filter((t) => t.type === "expense");
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const map = new Map<string, number>();
  for (const t of expenses) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return [...map.entries()]
    .map(([category, value]) => ({
      category,
      total: value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// Aceita formato monetário brasileiro ("1.234,56") ou ponto decimal;
// rejeita vazio, zero, negativo e não numérico.
export function parseBRValue(v: string): number | null {
  const clean = v.trim().replace(/R\$/g, "").replace(/\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const formatBRL = (v: number, currency: "BRL" | "USD" | "EUR" | "GBP" = "BRL"): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
export const currencySymbol = (currency: "BRL" | "USD" | "EUR" | "GBP"): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value ?? "R$";

// Converte "YYYY-MM-DD" para "dd/MM/yyyy" sem new Date(iso), que pode
// retroceder um dia por causa do fuso horário.
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

export function currentMonthKey(): string {
  return monthKey(todayISO());
}

export function prevMonthKey(key: string): string {
  const [y = 0, m = 1] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_PT[Number(m) - 1]}/${y}`;
}

// Meses disponíveis para o seletor: meses presentes nos dados + mês atual.
export function monthOptions(list: Transaction[]): string[] {
  const keys = new Set(list.map((t) => monthKey(t.date)));
  keys.add(currentMonthKey());
  return [...keys].sort().reverse();
}

export function filterByMonth(list: Transaction[], key: string): Transaction[] {
  return list.filter((t) => monthKey(t.date) === key);
}

const MONTHS_SHORT_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function monthShortLabel(key: string): string {
  const [y, m] = key.split("-");
  const shortMonth = MONTHS_SHORT_PT[Number(m) - 1] ?? m;
  return `${shortMonth}/${(y ?? "").slice(-2)}`;
}

// Verifica se um lançamento pendente está vencido (data anterior a hoje).
export function isOverdue(t: Transaction, refDateISO: string = todayISO()): boolean {
  return t.status === "pendente" && t.date < refDateISO;
}

export interface EntrepreneurMetrics {
  realizedIncome: number;
  pendingIncome: number;
  realizedExpense: number;
  pendingExpense: number;
  realizedBalance: number;
  projectedBalance: number;
  overdueCount: number;
  overdueExpense: number;
  overdueIncome: number;
  overdueTotal: number;
  fixedExpense: number;
  variableExpense: number;
  recurringIncome: number;
  profitMargin: number;
  burnRate: number;
  avgTicketIncome: number;
  avgTicketExpense: number;
}

export function calcEntrepreneurMetrics(
  list: Transaction[],
  refDateISO: string = todayISO(),
): EntrepreneurMetrics {
  const incomes = list.filter((t) => t.type === "income");
  const expenses = list.filter((t) => t.type === "expense");

  const realizedIncome = incomes
    .filter((t) => t.status === "confirmado")
    .reduce((s, t) => s + t.amount, 0);
  const pendingIncome = incomes
    .filter((t) => t.status === "pendente")
    .reduce((s, t) => s + t.amount, 0);

  const realizedExpense = expenses
    .filter((t) => t.status === "confirmado")
    .reduce((s, t) => s + t.amount, 0);
  const pendingExpense = expenses
    .filter((t) => t.status === "pendente")
    .reduce((s, t) => s + t.amount, 0);

  const overdueList = list.filter((t) => isOverdue(t, refDateISO));
  const overdueExpense = overdueList
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const overdueIncome = overdueList
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  const fixedExpense = expenses
    .filter((t) => Boolean(t.recurring))
    .reduce((s, t) => s + t.amount, 0);
  const variableExpense = expenses
    .filter((t) => !t.recurring)
    .reduce((s, t) => s + t.amount, 0);
  const recurringIncome = incomes
    .filter((t) => Boolean(t.recurring))
    .reduce((s, t) => s + t.amount, 0);

  const totalIncome = realizedIncome + pendingIncome;
  const totalExpense = realizedExpense + pendingExpense;
  const projectedBalance = totalIncome - totalExpense;
  const realizedBalance = realizedIncome - realizedExpense;

  const profitMargin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const burnRate = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  const avgTicketIncome = incomes.length > 0 ? totalIncome / incomes.length : 0;
  const avgTicketExpense = expenses.length > 0 ? totalExpense / expenses.length : 0;

  return {
    realizedIncome,
    pendingIncome,
    realizedExpense,
    pendingExpense,
    realizedBalance,
    projectedBalance,
    overdueCount: overdueList.length,
    overdueExpense,
    overdueIncome,
    overdueTotal: overdueExpense + overdueIncome,
    fixedExpense,
    variableExpense,
    recurringIncome,
    profitMargin,
    burnRate,
    avgTicketIncome,
    avgTicketExpense,
  };
}

export interface CashflowHistoryPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export function buildCashflowHistory(
  allTransactions: Transaction[],
  refMonth: string,
  monthsCount = 6,
): CashflowHistoryPoint[] {
  const keys: string[] = [];
  let cursor = refMonth;
  for (let i = 0; i < monthsCount; i++) {
    keys.push(cursor);
    cursor = prevMonthKey(cursor);
  }
  keys.reverse();

  return keys.map((mKey) => {
    const items = filterByMonth(allTransactions, mKey);
    const tot = calcTotals(items);
    return {
      month: mKey,
      label: monthShortLabel(mKey),
      income: tot.income,
      expense: tot.expense,
      balance: tot.balance,
    };
  });
}

export function buildTransactionsCSV(list: Transaction[]): string {
  const header = [
    "Data",
    "Tipo",
    "Status",
    "Descrição",
    "Categoria",
    "Cliente / Fornecedor",
    "Forma de Pagamento",
    "Documento / NF",
    "Recorrente / Fixo",
    "Valor",
  ].join(";");

  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = list.map((t) =>
    [
      formatDate(t.date),
      t.type === "income" ? "Receita" : "Despesa",
      t.status === "confirmado" ? "Confirmado" : "Pendente",
      escapeCell(t.description),
      escapeCell(t.category),
      escapeCell(t.contact || "-"),
      escapeCell(t.paymentMethod || "Pix"),
      escapeCell(t.documentRef || "-"),
      t.recurring ? "Sim" : "Não",
      t.amount.toFixed(2).replace(".", ","),
    ].join(";"),
  );

  return `\ufeff${[header, ...rows].join("\r\n")}`;
}

const GOALS_STORAGE_KEY = "nexo:goals";

export function loadLocalGoal(month: string, scope?: string | null): MonthlyGoal {
  try {
    const storageKey = scope ? `${GOALS_STORAGE_KEY}:${scope}` : GOALS_STORAGE_KEY;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { month, revenueTarget: 0, expenseLimit: 0 };
    const parsed = JSON.parse(raw) as Record<string, MonthlyGoal>;
    return parsed[month] ?? { month, revenueTarget: 0, expenseLimit: 0 };
  } catch {
    return { month, revenueTarget: 0, expenseLimit: 0 };
  }
}

export function saveLocalGoal(goal: MonthlyGoal, scope?: string | null): void {
  try {
    const storageKey = scope ? `${GOALS_STORAGE_KEY}:${scope}` : GOALS_STORAGE_KEY;
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as Record<string, MonthlyGoal>) : {};
    parsed[goal.month] = goal;
    localStorage.setItem(storageKey, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}
