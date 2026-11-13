import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownUp,
  Calendar,
  CheckCircle2,
  Download,
  FilterX,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { MonthSelect } from "@/components/MonthSelect";
import { SummaryCards } from "@/components/SummaryCards";
import { TransactionModal } from "@/components/TransactionModal";
import { TransactionTable } from "@/components/TransactionTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions } from "@/hooks/useTransactions";
import { apiLogFrontendEvent, getAuthToken } from "@/lib/api";
import {
  buildTransactionsCSV,
  calcEntrepreneurMetrics,
  EXPENSE_CATEGORIES,
  formatBRL,
  INCOME_CATEGORIES,
  isOverdue,
  monthKey,
  monthOptions,
  type Transaction,
  type TransactionType,
} from "@/lib/transactions";

export const Route = createFileRoute("/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos | Nexo" },
      {
        name: "description",
        content: "Registre, visualize e gerencie suas movimentações financeiras.",
      },
      { property: "og:title", content: "Lançamentos | Nexo" },
      {
        property: "og:description",
        content: "Registre, visualize e gerencie suas movimentações financeiras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const ALL_CATEGORIES = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];

function TransactionsPage() {
  const { transactions, remove, loaded, currency } = useTransactions();
  const [month, setMonth] = useState("all");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmado" | "pendente" | "vencido">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    type: TransactionType;
    editing: Transaction | null;
  }>({
    open: false,
    type: "income",
    editing: null,
  });
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const searchNormalized = search.trim().toLowerCase();

  // Filtros combináveis (AND): atualizam lista e resumo imediatamente.
  const filtered = transactions.filter((t) => {
    const matchMonth = month === "all" || monthKey(t.date) === month;
    const matchType = type === "all" || t.type === type;
    const matchCategory = category === "all" || t.category === category;
    const matchStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "vencido"
          ? isOverdue(t)
          : t.status === statusFilter;
    const matchSearch =
      !searchNormalized ||
      t.description.toLowerCase().includes(searchNormalized) ||
      (t.contact || "").toLowerCase().includes(searchNormalized) ||
      (t.documentRef || "").toLowerCase().includes(searchNormalized) ||
      (t.paymentMethod || "").toLowerCase().includes(searchNormalized);

    return matchMonth && matchType && matchCategory && matchStatus && matchSearch;
  });

  const globalMetrics = calcEntrepreneurMetrics(transactions);

  function clearFilters() {
    setMonth("all");
    setType("all");
    setCategory("all");
    setStatusFilter("all");
    setSearch("");
  }

  function handleExportCSV() {
    if (filtered.length === 0) {
      toast.error("Não há lançamentos na lista atual para exportar.");
      return;
    }
    const csvContent = buildTransactionsCSV(filtered);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexo_lancamentos_${month === "all" ? "completo" : month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Planilha contábil exportada com ${filtered.length} lançamento(s)!`);
    if (getAuthToken()) {
      void apiLogFrontendEvent(
        "TRANSACTIONS_CSV_EXPORTED",
        `Exportou planilha CSV de lançamentos (${filtered.length} registros).`,
        { month, count: filtered.length },
      );
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    remove(deleting.id);
    toast.success("Lançamento excluído com sucesso!");
    setDeleting(null);
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
        <div className="nexo-enter flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-secondary">
              Gestão de Lançamentos & Contas
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
              Lançamentos!
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Registre, visualize e gerencie todas as suas movimentações financeiras.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="nexo-btn-fluid flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted/70"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => setModal({ open: true, type: "income", editing: null })}
              className="nexo-btn-fluid flex h-9 items-center gap-1.5 rounded-lg bg-income px-3.5 text-xs font-bold text-income-foreground shadow-btn hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Receita
            </button>
            <button
              type="button"
              onClick={() => setModal({ open: true, type: "expense", editing: null })}
              className="nexo-btn-fluid flex h-9 items-center gap-1.5 rounded-lg bg-expense px-3.5 text-xs font-bold text-expense-foreground shadow-btn hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Despesa
            </button>
          </div>
        </div>

        {/* Alerta pró-ativo de contas vencidas para o empreendedor */}
        {globalMetrics.overdueCount > 0 && (
          <div className="nexo-enter flex flex-wrap items-center justify-between gap-3 rounded-xl border border-expense/30 bg-expense-soft px-4 py-3 text-xs text-expense">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Você possui <strong>{globalMetrics.overdueCount}</strong> lançamento(s) pendente(s)
                com vencimento ultrapassado (
                <strong className="tabular-nums">
                  {formatBRL(globalMetrics.overdueTotal, currency)}
                </strong>
                ).
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMonth("all");
                setStatusFilter("vencido");
              }}
              className="nexo-btn-fluid rounded-lg bg-expense px-3 py-1.5 font-semibold text-expense-foreground shadow-xs hover:brightness-110"
            >
              Ver vencidos ({globalMetrics.overdueCount})
            </button>
          </div>
        )}

        <section className="nexo-card nexo-stagger-1 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="tx-search"
              className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground"
            >
              <Search className="h-3 w-3" /> Buscar
            </label>
            <input
              id="tx-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Descrição, cliente/fornecedor, NF ou pagamento..."
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none transition-shadow focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div>
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Calendar className="h-3 w-3" /> Mês
            </span>
            <MonthSelect
              value={month}
              onChange={setMonth}
              options={monthOptions(transactions)}
              allowAll
            />
          </div>
          <div>
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <ArrowDownUp className="h-3 w-3" /> Tipo
            </span>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-[135px] bg-background" aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Tag className="h-3 w-3" /> Categoria
            </span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[155px] bg-background" aria-label="Filtrar por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ALL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> Status
            </span>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-[150px] bg-background" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmado">Confirmados</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="nexo-btn-fluid flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <FilterX className="h-3.5 w-3.5" /> Limpar Filtros
          </button>
        </section>

        {/* O resumo reflete os filtros aplicados, com a mesma função de cálculo do Dashboard */}
        <SummaryCards current={filtered} />

        <TransactionTable
          transactions={filtered}
          onEdit={(t) => setModal({ open: true, type: t.type, editing: t })}
          onDelete={setDeleting}
          emptyMessage={
            transactions.length === 0
              ? "Você ainda não possui lançamentos. Adicione sua primeira movimentação em Nova Receita ou Nova Despesa."
              : "Nenhum resultado encontrado para os filtros aplicados."
          }
        />
      </div>

      <TransactionModal
        open={modal.open}
        onOpenChange={(open) => setModal((cur) => ({ ...cur, open }))}
        type={modal.type}
        editing={modal.editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lançamento &quot;{deleting?.description}&quot; será
              removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-expense text-expense-foreground hover:bg-expense/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
