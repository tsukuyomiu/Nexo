import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  calcEntrepreneurMetrics,
  calcTotals,
  formatBRL,
  type Transaction,
} from "@/lib/transactions";
import { useTransactions } from "@/hooks/useTransactions";

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/* Cards executivos de resumo (Entrada / Saídas / Total).
   Visual minimalista, limpo e consistente, com animação fluida e gentil ao passar o mouse. */
export function SummaryCards({
  current,
  previous,
}: {
  current: Transaction[];
  previous?: Transaction[];
}) {
  const { currency } = useTransactions();
  const totals = calcTotals(current);
  const metrics = calcEntrepreneurMetrics(current);
  const prev = previous ? calcTotals(previous) : null;

  const incomePct = prev ? pctChange(totals.income, prev.income) : null;
  const expensePct = prev ? pctChange(totals.expense, prev.expense) : null;
  const balancePct = prev ? pctChange(totals.balance, prev.balance) : null;

  const cards = [
    {
      title: "Entradas",
      subtitle: "Receitas do período",
      value: totals.income,
      pct: incomePct,
      dotColor: "bg-emerald-500",
      subLeftLabel: "Em caixa",
      subLeftValue: formatBRL(metrics.realizedIncome, currency),
      subRightLabel: "A receber",
      subRightValue:
        metrics.pendingIncome > 0
          ? formatBRL(metrics.pendingIncome, currency)
          : "100% recebido",
      isPositiveGood: true,
    },
    {
      title: "Saídas",
      subtitle: "Despesas do período",
      value: totals.expense,
      pct: expensePct,
      dotColor: "bg-rose-500",
      subLeftLabel: "Pago",
      subLeftValue: formatBRL(metrics.realizedExpense, currency),
      subRightLabel: "A pagar",
      subRightValue:
        metrics.pendingExpense > 0
          ? formatBRL(metrics.pendingExpense, currency)
          : "Tudo quitado",
      isPositiveGood: false,
    },
    {
      title: "Resultado Líquido",
      subtitle: "Saldo em caixa no período",
      value: totals.balance,
      pct: balancePct,
      dotColor: totals.balance >= 0 ? "bg-emerald-500" : "bg-rose-500",
      subLeftLabel: "Saldo real",
      subLeftValue: formatBRL(metrics.realizedBalance, currency),
      subRightLabel: "Margem líquida",
      subRightValue: totals.income > 0 ? `${metrics.profitMargin.toFixed(1)}%` : "—",
      isPositiveGood: true,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card, idx) => (
        <section
          key={card.title}
          className={`nexo-card nexo-card-hover group relative flex flex-col justify-between overflow-hidden p-5 sm:p-6 ${
            idx === 0 ? "nexo-stagger-1" : idx === 1 ? "nexo-stagger-2" : "nexo-stagger-3"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${card.dotColor}`} />
                <h3 className="text-xs font-semibold text-muted-foreground">{card.title}</h3>
              </div>
              {card.pct !== null && (
                <span
                  className={`font-mono-num inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-transform duration-200 group-hover:scale-105 ${
                    (card.isPositiveGood && card.pct >= 0) ||
                    (!card.isPositiveGood && card.pct <= 0)
                      ? "border border-emerald-200/60 bg-emerald-50 text-emerald-700"
                      : "border border-rose-200/60 bg-rose-50 text-rose-700"
                  }`}
                  title="Comparativo com mês anterior"
                >
                  {card.pct >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(card.pct)}%
                </span>
              )}
            </div>

            <p className="font-mono-num mt-3 break-words text-2xl font-bold tracking-tight text-foreground transition-colors duration-200 sm:text-[28px]">
              {formatBRL(card.value, currency)}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-[11px]">
            <div>
              <span className="block text-[10px] font-medium text-muted-foreground">
                {card.subLeftLabel}
              </span>
              <span className="font-mono-num font-semibold text-foreground">
                {card.subLeftValue}
              </span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-medium text-muted-foreground">
                {card.subRightLabel}
              </span>
              <span className="font-mono-num font-semibold text-muted-foreground">
                {card.subRightValue}
              </span>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
