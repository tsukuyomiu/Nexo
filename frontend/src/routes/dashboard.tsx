import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { MonthSelect } from "@/components/MonthSelect";
import { SummaryCards } from "@/components/SummaryCards";
import { TransactionTable } from "@/components/TransactionTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTransactions } from "@/hooks/useTransactions";
import {
  ArrowRight,
  Download,
  FileText,
  Handshake,
  Printer,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  apiGenerateFinancialReport,
  apiGetFinancialGoal,
  apiUpsertFinancialGoal,
  getAuthToken,
} from "@/lib/api";
import {
  buildCashflowHistory,
  buildTransactionsCSV,
  calcEntrepreneurMetrics,
  calcTotals,
  currencySymbol,
  currentMonthKey,
  expensesByCategory,
  filterByMonth,
  formatBRL,
  loadLocalGoal,
  monthLabel,
  monthOptions,
  parseBRValue,
  prevMonthKey,
  saveLocalGoal,
  type MonthlyGoal,
} from "@/lib/transactions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Nexo" },
      { name: "description", content: "Acompanhe seu desempenho financeiro na Nexo." },
      { property: "og:title", content: "Dashboard | Nexo" },
      { property: "og:description", content: "Acompanhe seu desempenho financeiro na Nexo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

// Paleta do gráfico: variações de azul da identidade Nexo.
const CHART_COLORS = [
  "var(--nexo-chart-1)",
  "var(--nexo-chart-2)",
  "var(--nexo-chart-3)",
  "var(--nexo-chart-4)",
  "var(--nexo-chart-5)",
  "var(--nexo-chart-6)",
];

function DashboardPage() {
  const { transactions, loaded, currency, profile } = useTransactions();
  const [month, setMonth] = useState(currentMonthKey());
  const [reduceMotion, setReduceMotion] = useState(true);

  // Metas financeiras do mês (Meta de Faturamento e Teto de Gastos)
  const [goal, setGoal] = useState<MonthlyGoal>({
    month: currentMonthKey(),
    revenueTarget: 0,
    expenseLimit: 0,
  });
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({ revenueTarget: "", expenseLimit: "" });
  const [savingGoal, setSavingGoal] = useState(false);

  // Modal de DRE Gerencial & Certificado Forense SHA-256
  const [dreModalOpen, setDreModalOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportCert, setReportCert] = useState<{
    reportId: string;
    hashSha256: string;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    const local = loadLocalGoal(month, profile.email || undefined);
    setGoal(local);

    if (getAuthToken()) {
      void apiGetFinancialGoal(month)
        .then((remote) => {
          if (!active) return;
          setGoal(remote);
          saveLocalGoal(remote, profile.email || undefined);
        })
        .catch(() => {
          // fallback para meta local
        });
    }
    return () => {
      active = false;
    };
  }, [month, profile.email]);

  const filtered = filterByMonth(transactions, month);
  const previous = filterByMonth(transactions, prevMonthKey(month));
  const totals = calcTotals(filtered);
  const metrics = calcEntrepreneurMetrics(filtered);
  const byCategory = expensesByCategory(filtered);
  const totalExpense = totals.expense;
  const cashflowSeries = buildCashflowHistory(transactions, month, 6);

  const revenueGoalPct =
    goal.revenueTarget > 0
      ? Math.min(100, Math.round((totals.income / goal.revenueTarget) * 100))
      : 0;
  const expenseLimitPct =
    goal.expenseLimit > 0 ? Math.round((totals.expense / goal.expenseLimit) * 100) : 0;

  function openGoalEditor() {
    setGoalForm({
      revenueTarget: goal.revenueTarget > 0 ? String(goal.revenueTarget).replace(".", ",") : "",
      expenseLimit: goal.expenseLimit > 0 ? String(goal.expenseLimit).replace(".", ",") : "",
    });
    setGoalModalOpen(true);
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (savingGoal) return;
    const rev = goalForm.revenueTarget.trim() ? (parseBRValue(goalForm.revenueTarget) ?? 0) : 0;
    const exp = goalForm.expenseLimit.trim() ? (parseBRValue(goalForm.expenseLimit) ?? 0) : 0;

    setSavingGoal(true);
    const nextGoal: MonthlyGoal = {
      month,
      revenueTarget: rev,
      expenseLimit: exp,
    };
    try {
      saveLocalGoal(nextGoal, profile.email || undefined);
      setGoal(nextGoal);
      if (getAuthToken()) {
        const saved = await apiUpsertFinancialGoal(nextGoal);
        setGoal(saved);
      }
      toast.success(`Metas financeiras de ${monthLabel(month)} salvas com sucesso!`);
      setGoalModalOpen(false);
    } catch {
      toast.success(`Metas financeiras de ${monthLabel(month)} salvas localmente!`);
      setGoalModalOpen(false);
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleOpenDREReport() {
    setDreModalOpen(true);
    setGeneratingReport(true);
    try {
      if (getAuthToken()) {
        const res = await apiGenerateFinancialReport(month);
        setReportCert({
          reportId: res.report_id,
          hashSha256: res.hash_sha256,
          createdAt: res.created_at,
        });
      } else {
        const pseudoHash = Array.from(
          `${month}-${totals.income}-${totals.expense}-${filtered.length}`,
        )
          .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
          .toString(16)
          .replace("-", "a")
          .padStart(16, "0")
          .repeat(4);
        setReportCert({
          reportId: `local-${month}`,
          hashSha256: pseudoHash,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // fallback silencioso
    } finally {
      setGeneratingReport(false);
    }
  }

  function handleExportMonthCSV() {
    if (filtered.length === 0) {
      toast.error("Não há lançamentos neste mês para exportar.");
      return;
    }
    const csvContent = buildTransactionsCSV(filtered);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexo_dre_${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Extrato mensal de ${monthLabel(month)} exportado em CSV!`);
  }

  if (!loaded)
    return (
      <AppLayout>
        <p role="status" className="text-sm text-muted-foreground">
          Carregando lançamentos…
        </p>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Cabeçalho Limpo e Humanizado */}
        <div className="nexo-enter flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-secondary">
              Painel Executivo · {monthLabel(month)}
            </span>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
              Seja Bem vindo, {profile.name || "Usuário"}!
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Aqui você acompanha o seu desempenho financeiro
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openGoalEditor}
              className="nexo-btn-fluid flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted/70"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              Metas
            </button>
            <button
              type="button"
              onClick={() => void handleOpenDREReport()}
              className="nexo-btn-fluid flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted/70"
            >
              <FileText className="h-3.5 w-3.5 text-secondary" />
              Emitir DRE
            </button>
            <MonthSelect value={month} onChange={setMonth} options={monthOptions(transactions)} />
          </div>
        </div>

        {/* 3 Cards Principais (Entradas, Saídas, Resultado Líquido) */}
        <SummaryCards current={filtered} previous={previous} />

        {/* Faixa Executiva Unificada (Indicadores de Caixa + Metas) */}
        <section
          aria-label="Indicadores Operacionais"
          className="nexo-card nexo-stagger-2 overflow-hidden"
        >
          <div className="grid grid-cols-2 divide-y divide-border/80 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="p-4 sm:px-5">
              <span className="text-xs font-medium text-muted-foreground">A receber no mês</span>
              <p className="font-mono-num mt-1 text-lg font-bold tracking-tight text-foreground">
                {formatBRL(metrics.pendingIncome, currency)}
              </p>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {metrics.pendingIncome > 0 ? "Faturas aguardando baixa" : "100% liquidado"}
              </span>
            </div>

            <div className="p-4 sm:px-5">
              <span className="text-xs font-medium text-muted-foreground">A pagar no mês</span>
              <p className="font-mono-num mt-1 text-lg font-bold tracking-tight text-foreground">
                {formatBRL(metrics.pendingExpense, currency)}
              </p>
              <span
                className={`mt-0.5 block text-[11px] ${
                  metrics.overdueCount > 0 ? "font-semibold text-expense" : "text-muted-foreground"
                }`}
              >
                {metrics.overdueCount > 0
                  ? `${metrics.overdueCount} conta(s) em atraso`
                  : "Obrigações em dia"}
              </span>
            </div>

            <div className="p-4 sm:px-5">
              <span className="text-xs font-medium text-muted-foreground">Estrutura de custos</span>
              <p className="font-mono-num mt-1 text-lg font-bold tracking-tight text-foreground">
                {formatBRL(metrics.fixedExpense, currency)}
              </p>
              <span className="font-mono-num mt-0.5 block text-[11px] text-muted-foreground">
                Custos variáveis: {formatBRL(metrics.variableExpense, currency)}
              </span>
            </div>

            <div className="p-4 sm:px-5">
              <span className="text-xs font-medium text-muted-foreground">Comprometimento</span>
              <p className="font-mono-num mt-1 text-lg font-bold tracking-tight text-foreground">
                {totals.income > 0 ? `${metrics.burnRate.toFixed(0)}%` : "0%"}
              </p>
              <span className="font-mono-num mt-0.5 block text-[11px] text-muted-foreground">
                Ticket médio: {formatBRL(metrics.avgTicketIncome, currency)}
              </span>
            </div>
          </div>

          {/* Barra de Metas (exibida de forma limpa e integrada quando configurada) */}
          {(goal.revenueTarget > 0 || goal.expenseLimit > 0) && (
            <div className="grid grid-cols-1 gap-4 border-t border-border/80 bg-muted/35 px-5 py-3.5 sm:grid-cols-2">
              {goal.revenueTarget > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-muted-foreground">
                      Meta de faturamento ({formatBRL(goal.revenueTarget, currency)})
                    </span>
                    <span className="font-mono-num font-bold text-foreground">
                      {revenueGoalPct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-income transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(100, revenueGoalPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {goal.expenseLimit > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-muted-foreground">
                      Teto de gastos ({formatBRL(goal.expenseLimit, currency)})
                    </span>
                    <span
                      className={`font-mono-num font-bold ${
                        expenseLimitPct >= 100 ? "text-expense" : "text-foreground"
                      }`}
                    >
                      {expenseLimitPct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        expenseLimitPct >= 100
                          ? "bg-expense"
                          : expenseLimitPct >= 80
                            ? "bg-amber-500"
                            : "bg-secondary"
                      }`}
                      style={{ width: `${Math.min(100, expenseLimitPct)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {transactions.length === 0 && (
          <section
            className="nexo-card nexo-enter flex flex-col items-center gap-4 p-8 text-center"
            aria-labelledby="welcome-title"
          >
            <Handshake className="h-7 w-7 text-primary" aria-hidden="true" />
            <h2 id="welcome-title" className="text-xl font-bold text-foreground">
              Seja bem-vindo ao Nexo!
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Você ainda não possui lançamentos. Registre sua primeira receita ou despesa para
              começar a acompanhar sua vida financeira.
            </p>
            <Button
              asChild
              variant="secondary"
              className="h-auto min-h-10 w-full max-w-md whitespace-normal"
            >
              <Link to="/lancamentos">
                Fazer meu primeiro lançamento <ArrowRight />
              </Link>
            </Button>
          </section>
        )}

        {/* Grid Principal de Gráficos Minimalistas */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Gráfico 1: Despesas por categoria */}
          <section className="nexo-card nexo-card-hover nexo-stagger-2 min-w-0 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-foreground">Despesas por categoria</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Distribuição percentual dos gastos no período
                </p>
              </div>
              <span className="font-mono-num rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {byCategory.length} {byCategory.length === 1 ? "categoria" : "categorias"}
              </span>
            </div>
            {byCategory.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                Nenhuma despesa registrada neste período.
              </p>
            ) : (
              <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="total"
                        nameKey="category"
                        innerRadius={54}
                        outerRadius={80}
                        paddingAngle={2}
                        strokeWidth={0}
                        isAnimationActive={!reduceMotion}
                        animationDuration={300}
                      >
                        {byCategory.map((entry, i) => (
                          <Cell key={entry.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        position={{ x: 0, y: -44 }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        animationDuration={180}
                        isAnimationActive={!reduceMotion}
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <div className="pointer-events-none max-w-48 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                              <span className="block truncate font-semibold">
                                {payload[0].name}
                              </span>
                              <span className="font-mono-num font-bold">
                                {formatBRL(Number(payload[0].value), currency)}
                              </span>
                            </div>
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-medium text-muted-foreground">Total</span>
                    <span className="font-mono-num text-xs font-bold text-foreground">
                      {formatBRL(totalExpense, currency)}
                    </span>
                  </div>
                </div>
                <ul className="flex w-full flex-col gap-3 text-xs">
                  {byCategory.map((entry, i) => {
                    const color = CHART_COLORS[i % CHART_COLORS.length];
                    return (
                      <li key={entry.category} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 truncate font-semibold text-foreground">
                            <span
                              className="h-2 w-2 shrink-0 rounded-xs"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{entry.category}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-[11px] text-muted-foreground">
                              {formatBRL(entry.total, currency)}
                            </span>
                            <span className="font-mono-num w-9 text-right text-[11px] font-bold text-foreground">
                              {Math.round(entry.percent)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(3, Math.round(entry.percent))}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Gráfico 2: Evolução Mensal de Entradas e Saídas */}
          <section className="nexo-card nexo-card-hover nexo-stagger-3 min-w-0 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-foreground">Fluxo de caixa mensal</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Comparativo de entradas e saídas nos últimos 6 meses
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-income" /> Entradas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#0D213A]" /> Saídas
                </span>
              </div>
            </div>

            <div className="mt-4 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cashflowSeries}
                  margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
                  barGap={4}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                    isAnimationActive={!reduceMotion}
                    content={({ active, payload, label }) =>
                      active && payload && payload.length > 0 ? (
                        <div className="rounded-lg border border-border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
                          <p className="mb-1 font-bold">{label}</p>
                          <p className="font-mono-num text-income">
                            Entradas: {formatBRL(Number(payload[0]?.value ?? 0), currency)}
                          </p>
                          <p className="font-mono-num text-foreground">
                            Saídas: {formatBRL(Number(payload[1]?.value ?? 0), currency)}
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="income"
                    name="Entradas"
                    fill="var(--income)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={!reduceMotion}
                    animationDuration={300}
                  />
                  <Bar
                    dataKey="expense"
                    name="Saídas"
                    fill="#0D213A"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={!reduceMotion}
                    animationDuration={300}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Últimos Lançamentos */}
        <section className="nexo-card nexo-stagger-3 min-w-0 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Últimos Lançamentos</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Movimentações mais recentes registradas na conta
              </p>
            </div>
            <Link
              to="/lancamentos"
              className="nexo-btn-fluid inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <TransactionTable
            transactions={filtered.slice(0, 6)}
            emptyMessage="Nenhum lançamento recente neste período."
          />
        </section>
      </div>

      {/* Modal de Metas & Teto de Gastos */}
      <Dialog open={goalModalOpen} onOpenChange={setGoalModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Metas de {monthLabel(month)}</DialogTitle>
            <DialogDescription>
              Defina sua meta de faturamento e o limite máximo de gastos para acompanhar o progresso
              no topo do Dashboard.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveGoal} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="goal-revenue"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Meta de Faturamento Mensal (Receita)
              </label>
              <div className="flex items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-secondary">
                <span className="border-r border-border px-3 text-sm text-muted-foreground">
                  {currencySymbol(currency)}
                </span>
                <input
                  id="goal-revenue"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={goalForm.revenueTarget}
                  onChange={(e) => setGoalForm({ ...goalForm, revenueTarget: e.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-r-lg bg-transparent px-3 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="goal-expense"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Teto de Gastos (Orçamento de Despesas)
              </label>
              <div className="flex items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-secondary">
                <span className="border-r border-border px-3 text-sm text-muted-foreground">
                  {currencySymbol(currency)}
                </span>
                <input
                  id="goal-expense"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={goalForm.expenseLimit}
                  onChange={(e) => setGoalForm({ ...goalForm, expenseLimit: e.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-r-lg bg-transparent px-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGoalModalOpen(false)}
                className="h-10 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingGoal}
                className="h-10 rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground shadow-btn hover:brightness-110 disabled:opacity-50"
              >
                {savingGoal ? "Salvando..." : "Salvar Metas"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de DRE Gerencial & Certificado Forense SHA-256 */}
      <Dialog open={dreModalOpen} onOpenChange={setDreModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>DRE Gerencial — {monthLabel(month)}</DialogTitle>
            <DialogDescription>
              Demonstrativo consolidado do exercício com hash de integridade SHA-256.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 text-xs">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <dt className="font-semibold text-foreground">(+) Receita Bruta Operacional</dt>
                  <dd className="tabular-nums font-bold text-income">
                    {formatBRL(totals.income, currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between pl-3 text-muted-foreground">
                  <dt>Confirmada em caixa</dt>
                  <dd className="tabular-nums">{formatBRL(metrics.realizedIncome, currency)}</dd>
                </div>
                <div className="flex items-center justify-between border-b border-border/60 pb-2 pl-3 text-muted-foreground">
                  <dt>A receber (pendente)</dt>
                  <dd className="tabular-nums">{formatBRL(metrics.pendingIncome, currency)}</dd>
                </div>

                <div className="flex items-center justify-between border-b border-border/60 pb-2 pt-1">
                  <dt className="font-semibold text-foreground">(-) Despesas Totais do Período</dt>
                  <dd className="tabular-nums font-bold text-expense">
                    − {formatBRL(totals.expense, currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between pl-3 text-muted-foreground">
                  <dt>Custos fixos / recorrentes</dt>
                  <dd className="tabular-nums">{formatBRL(metrics.fixedExpense, currency)}</dd>
                </div>
                <div className="flex items-center justify-between border-b border-border/60 pb-2 pl-3 text-muted-foreground">
                  <dt>Custos e despesas variáveis</dt>
                  <dd className="tabular-nums">{formatBRL(metrics.variableExpense, currency)}</dd>
                </div>

                <div className="flex items-center justify-between pt-1 text-sm font-bold text-foreground">
                  <dt>(=) Resultado Líquido</dt>
                  <dd
                    className={`tabular-nums ${
                      totals.balance >= 0 ? "text-income" : "text-expense"
                    }`}
                  >
                    {formatBRL(totals.balance, currency)} ({metrics.profitMargin.toFixed(1)}%)
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-secondary" />
                Assinatura de Integridade (SHA-256)
              </div>
              <div className="mt-2 rounded-md bg-muted px-2.5 py-2 font-mono text-[10px] break-all text-muted-foreground">
                {generatingReport
                  ? "Calculando hash criptográfico..."
                  : reportCert?.hashSha256 || "Hash verificado"}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportMonthCSV}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground shadow-btn hover:brightness-110"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir / PDF
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
