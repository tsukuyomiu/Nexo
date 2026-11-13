import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate, isOverdue, type Transaction } from "@/lib/transactions";
import { useTransactions } from "@/hooks/useTransactions";

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  emptyMessage?: string;
}

/* Tabela de lançamentos compartilhada pelo Dashboard (recentes) e pela tela
   de Lançamentos (com ações de dar baixa rápida, editar e excluir). */
export function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  emptyMessage = "Nenhum lançamento encontrado.",
}: TransactionTableProps) {
  const { lastAddedId, currency, toggleStatus } = useTransactions();
  if (transactions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const hasActions = !!onEdit || !!onDelete;

  function handleQuickSettle(t: Transaction) {
    toggleStatus(t.id);
    if (t.status === "pendente") {
      toast.success(
        t.type === "income"
          ? `Recebimento confirmado: "${t.description}"!`
          : `Pagamento confirmado: "${t.description}"!`,
      );
    } else {
      toast.info(`"${t.description}" marcado novamente como pendente.`);
    }
  }

  return (
    <div className="max-h-[460px] overflow-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-muted/65 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur-xs">
          <tr>
            <th className="px-3.5 py-2.5 font-semibold">Data</th>
            <th className="px-3.5 py-2.5 font-semibold">Descrição</th>
            <th className="px-3.5 py-2.5 font-semibold">Categoria</th>
            <th className="px-3.5 py-2.5 font-semibold">Tipo</th>
            <th className="px-3.5 py-2.5 text-right font-semibold">Valor</th>
            <th className="px-3.5 py-2.5 font-semibold">Status</th>
            {hasActions && <th className="px-3.5 py-2.5 text-right font-semibold">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {transactions.map((t) => {
            const overdue = isOverdue(t);
            const subDetails = [
              t.contact,
              t.paymentMethod,
              t.documentRef,
              t.recurring ? "Fixo" : null,
            ].filter(Boolean);

            return (
              <tr
                key={t.id}
                className={`nexo-row-hover ${
                  lastAddedId === t.id ? "nexo-enter" : ""
                }`}
              >
                <td className="font-mono-num whitespace-nowrap px-3.5 py-3 align-middle text-xs text-muted-foreground">
                  <span className={overdue ? "font-bold text-expense" : ""}>
                    {formatDate(t.date)}
                  </span>
                </td>
                <td className="max-w-[240px] px-3.5 py-3 align-middle">
                  <div className="truncate font-semibold text-foreground" title={t.description}>
                    {t.description}
                  </div>
                  {subDetails.length > 0 && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {subDetails.join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-3.5 py-3 align-middle text-xs font-medium text-muted-foreground">
                  {t.category}
                </td>
                <td className="px-3.5 py-3 align-middle">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold ${
                      t.type === "income"
                        ? "bg-income-soft text-income"
                        : "bg-expense-soft text-expense"
                    }`}
                  >
                    {t.type === "income" ? "Entrada" : "Saída"}
                  </span>
                </td>
                <td
                  className={`font-mono-num whitespace-nowrap px-3.5 py-3 text-right align-middle text-xs font-bold sm:text-sm ${
                    t.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"} {formatBRL(t.amount, currency)}
                </td>
                <td className="px-3.5 py-3 align-middle">
                  {overdue ? (
                    <span
                      title="Data de vencimento ultrapassada"
                      className="inline-flex items-center gap-1.5 rounded bg-expense-soft px-2 py-0.5 text-[11px] font-semibold text-expense"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-expense" />
                      Vencido
                    </span>
                  ) : t.status === "confirmado" ? (
                    <span className="inline-flex items-center gap-1.5 rounded bg-income-soft px-2 py-0.5 text-[11px] font-semibold text-income">
                      <span className="h-1.5 w-1.5 rounded-full bg-income" />
                      Confirmado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                      Pendente
                    </span>
                  )}
                </td>
                {hasActions && (
                  <td className="px-3.5 py-3 align-middle">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleQuickSettle(t)}
                        title={
                          t.status === "pendente"
                            ? "Confirmar recebimento/pagamento"
                            : "Marcar como pendente"
                        }
                        aria-label={
                          t.status === "pendente"
                            ? `Confirmar ${t.description}`
                            : `Marcar ${t.description} como pendente`
                        }
                        className={`rounded-md p-1.5 transition-colors ${
                          t.status === "pendente"
                            ? "text-income hover:bg-income-soft"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(t)}
                          aria-label={`Editar ${t.description}`}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(t)}
                          aria-label={`Excluir ${t.description}`}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-expense-soft hover:text-expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
