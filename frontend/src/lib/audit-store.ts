import { apiLogFrontendEvent } from "./api";

export interface AuditLogEntry {
  log_id: string;
  quando_fez: string;
  quando_iso: string;
  quem_fez: string;
  quem_nome: string;
  quem_email: string;
  o_que_fez: string;
  acao: string;
  modulo: "AUTH" | "TRANSACTION" | "PROFILE" | "PREFERENCES" | "SECURITY" | "REPORT" | "FRONTEND";
  severidade: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  ip: string;
  origem: string;
  rota: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

const STORAGE_KEY = "nexo:audit_history_v2";

export function getLocalAuditEntries(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditLogEntry[];
  } catch {
    return [];
  }
}

export function saveLocalAuditEntries(entries: AuditLogEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    // Mantém no máximo 150 registros locais
    const capped = entries.slice(0, 150);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Ignore storage errors
  }
}

export function recordAuditEvent(
  entry: {
    acao: string;
    modulo: "AUTH" | "TRANSACTION" | "PROFILE" | "PREFERENCES" | "SECURITY" | "REPORT" | "FRONTEND";
    o_que_fez: string;
    quem_nome?: string;
    quem_email?: string;
    severidade?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    rota?: string;
    antes?: Record<string, unknown> | null;
    depois?: Record<string, unknown> | null;
  }
): AuditLogEntry {
  const now = new Date();
  const quandoFez = now.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const quandoIso = now.toISOString();

  const nome = entry.quem_nome?.trim() || "Usuário Nexo";
  const email = entry.quem_email?.trim() || "usuario@nexo.com";

  const newLog: AuditLogEntry = {
    log_id: `local-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    quando_fez: quandoFez,
    quando_iso: quandoIso,
    quem_fez: `${nome} (${email})`,
    quem_nome: nome,
    quem_email: email,
    o_que_fez: entry.o_que_fez,
    acao: entry.acao.toUpperCase(),
    modulo: entry.modulo,
    severidade: entry.severidade || "INFO",
    ip: "127.0.0.1",
    origem: "FRONTEND_REACT",
    rota: entry.rota || "/perfil",
    antes: entry.antes ?? null,
    depois: entry.depois ?? null,
  };

  // 1. Grava no histórico local persistente
  const current = getLocalAuditEntries();
  saveLocalAuditEntries([newLog, ...current]);

  // 2. Dispara assincronamente para a API FastAPI gravar no banco SQL caso online
  void apiLogFrontendEvent(
    newLog.acao,
    newLog.o_que_fez,
    newLog.depois || undefined
  ).catch(() => {
    // Silencia se offline — o log já está seguro no navegador
  });

  return newLog;
}
