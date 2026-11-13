import { describe, expect, it } from "vitest";
import {
  buildCashflowHistory,
  buildTransactionsCSV,
  calcEntrepreneurMetrics,
  calcTotals,
  expensesByCategory,
  formatBRL,
  formatDate,
  isOverdue,
  loadLocalGoal,
  parseBRValue,
  saveLocalGoal,
  sortTransactions,
  type Transaction,
} from "@/lib/transactions";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? "1",
  description: "Teste",
  amount: 100,
  date: "2026-11-01",
  category: "Outros",
  type: "expense",
  status: "confirmado",
  ...over,
});

describe("calcTotals", () => {
  it("soma entradas, saídas e calcula o saldo", () => {
    const list = [
      tx({ type: "income", amount: 3450 }),
      tx({ type: "income", amount: 320 }),
      tx({ type: "expense", amount: 1980 }),
      tx({ type: "expense", amount: 99.9 }),
    ];
    const totals = calcTotals(list);
    expect(totals.income).toBeCloseTo(3770);
    expect(totals.expense).toBeCloseTo(2079.9);
    expect(totals.balance).toBeCloseTo(1690.1);
  });

  it("retorna zeros para lista vazia", () => {
    expect(calcTotals([])).toEqual({ income: 0, expense: 0, balance: 0 });
  });
});

describe("sortTransactions", () => {
  it("ordena por data decrescente e mantém estável o desempate por inserção", () => {
    const list = [
      tx({ id: "a", date: "2026-11-01" }),
      tx({ id: "b", date: "2026-11-03" }),
      tx({ id: "c", date: "2026-11-03" }),
      tx({ id: "d", date: "2026-10-30" }),
    ];
    expect(sortTransactions(list).map((t) => t.id)).toEqual(["b", "c", "a", "d"]);
  });
});

describe("expensesByCategory", () => {
  it("agrupa só despesas e calcula o percentual do total de despesas", () => {
    const list = [
      tx({ category: "Moradia", amount: 1200 }),
      tx({ category: "Lazer", amount: 400 }),
      tx({ category: "Moradia", amount: 400 }),
      tx({ type: "income", category: "Salário", amount: 5000 }),
    ];
    const result = expensesByCategory(list);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ category: "Moradia", total: 1600 });
    expect(result[0]!.percent).toBeCloseTo(80);
    expect(result[1]!.percent).toBeCloseTo(20);
  });
});

describe("parseBRValue", () => {
  it("aceita formato brasileiro com vírgula e ponto de milhar", () => {
    expect(parseBRValue("1.234,56")).toBeCloseTo(1234.56);
    expect(parseBRValue("R$ 45,90")).toBeCloseTo(45.9);
    expect(parseBRValue("100")).toBe(100);
  });

  it("rejeita vazio, zero, negativo e não numérico", () => {
    expect(parseBRValue("")).toBeNull();
    expect(parseBRValue("0")).toBeNull();
    expect(parseBRValue("-5,00")).toBeNull();
    expect(parseBRValue("abc")).toBeNull();
  });
});

describe("formatDate", () => {
  it("converte ISO para dd/MM/yyyy sem problema de fuso", () => {
    expect(formatDate("2026-11-02")).toBe("02/11/2026");
  });
});

describe("formatBRL", () => {
  it("formata em real no padrão pt-BR", () => {
    expect(formatBRL(1470)).toBe("R$ 1.470,00");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});

describe("métricas empresariais e fluxo de caixa (empreendedor)", () => {
  it("separa realizado vs pendente, custos fixos vs variáveis, vencidos e margem líquida", () => {
    const list: Transaction[] = [
      tx({
        id: "1",
        type: "income",
        amount: 10000,
        status: "confirmado",
        date: "2026-11-05",
        recurring: true,
      }),
      tx({
        id: "2",
        type: "income",
        amount: 2000,
        status: "pendente",
        date: "2026-11-20",
      }),
      tx({
        id: "3",
        type: "expense",
        amount: 3000,
        status: "confirmado",
        date: "2026-11-02",
        recurring: true,
      }),
      tx({
        id: "4",
        type: "expense",
        amount: 1000,
        status: "pendente",
        date: "2026-11-01",
        recurring: false,
      }),
    ];

    const m = calcEntrepreneurMetrics(list, "2026-11-10");
    expect(m.realizedIncome).toBe(10000);
    expect(m.pendingIncome).toBe(2000);
    expect(m.realizedExpense).toBe(3000);
    expect(m.pendingExpense).toBe(1000);
    expect(m.realizedBalance).toBe(7000);
    expect(m.projectedBalance).toBe(8000);
    expect(m.fixedExpense).toBe(3000);
    expect(m.variableExpense).toBe(1000);
    expect(m.overdueCount).toBe(1);
    expect(m.overdueExpense).toBe(1000);
    expect(m.profitMargin).toBeCloseTo(66.666, 2);
  });

  it("identifica lançamentos vencidos corretamente", () => {
    const overdueTx = tx({ status: "pendente", date: "2026-11-01" });
    const futureTx = tx({ status: "pendente", date: "2026-11-25" });
    const paidTx = tx({ status: "confirmado", date: "2026-11-01" });

    expect(isOverdue(overdueTx, "2026-11-10")).toBe(true);
    expect(isOverdue(futureTx, "2026-11-10")).toBe(false);
    expect(isOverdue(paidTx, "2026-11-10")).toBe(false);
  });

  it("gera série histórica de 6 meses e exporta CSV contábil", () => {
    const list = [
      tx({ type: "income", amount: 5000, date: "2026-11-05", contact: "TechCorp", paymentMethod: "Pix" }),
      tx({ type: "expense", amount: 1500, date: "2026-10-12", contact: "AWS", recurring: true }),
    ];
    const history = buildCashflowHistory(list, "2026-11", 6);
    expect(history).toHaveLength(6);
    expect(history.at(-1)?.month).toBe("2026-11");
    expect(history.at(-1)?.income).toBe(5000);
    expect(history.at(-2)?.month).toBe("2026-10");
    expect(history.at(-2)?.expense).toBe(1500);

    const csv = buildTransactionsCSV(list);
    expect(csv).toContain("TechCorp");
    expect(csv).toContain("5000,00");
  });

  it("persiste e carrega metas financeiras mensais localmente", () => {
    localStorage.clear();
    saveLocalGoal({ month: "2026-11", revenueTarget: 25000, expenseLimit: 9000 }, "user@nexo.com");
    const loaded = loadLocalGoal("2026-11", "user@nexo.com");
    expect(loaded).toEqual({ month: "2026-11", revenueTarget: 25000, expenseLimit: 9000 });
  });
});
