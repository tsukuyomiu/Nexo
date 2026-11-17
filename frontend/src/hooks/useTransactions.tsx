import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { emptyProfile, loadLocalProfile, prepareProfile, saveLocalProfile, type Profile } from "@/lib/profile";
import { loadCurrency, saveCurrency, type Currency } from "@/lib/preferences";
import { endLocalScope, loadLocalScope, startLocalScope } from "@/lib/local-identity";
import { recordAuditEvent } from "@/lib/audit-store";
import {
  createTransaction,
  loadTransactions,
  saveTransactions,
  sortTransactions,
  type Transaction,
} from "@/lib/transactions";
import {
  apiCreateTransaction,
  apiDeleteTransaction,
  apiGetMyProfile,
  apiListTransactions,
  apiLogFrontendEvent,
  apiLogout,
  apiPatchTransactionStatus,
  apiUpdateMyPreferences,
  apiUpdateMyProfile,
  apiUpdateTransaction,
  clearAuthSession,
  getAuthToken,
  getStoredAuthUser,
  setAuthSession,
  type StoredAuthUser,
} from "@/lib/api";

interface TransactionsContextValue {
  transactions: Transaction[];
  loaded: boolean;
  lastAddedId: string | null;
  profile: Profile;
  avatarUrl: string | null;
  setAvatarUrl: (dataUrl: string | null) => void;
  role: "user" | "admin" | "auditor";
  twoFactorEnabled: boolean;
  currency: Currency;
  setCurrency: (currency: Currency) => boolean;
  setTwoFactorEnabled: (enabled: boolean) => Promise<boolean>;
  updateProfile: (profile: Profile) => Promise<void>;
  resetProfile: () => void;
  authenticateSession: (token: string, user: StoredAuthUser) => Promise<void>;
  startLocalSession: (email: string) => Promise<void>;
  endLocalSession: () => void;
  add: (data: Omit<Transaction, "id">) => void;
  update: (id: string, data: Omit<Transaction, "id">) => void;
  toggleStatus: (id: string) => void;
  remove: (id: string) => void;
}

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

function getAvatarStorageKey(email?: string): string {
  return `nexo:avatar:v2:${(email || "default").trim().toLowerCase()}`;
}

function isOnlineToken(token: string | null): boolean {
  return Boolean(token && !token.startsWith("offline-"));
}

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ ...emptyProfile });
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
  const [role, setRole] = useState<"user" | "admin" | "auditor">("user");
  const [twoFactorEnabled, setTwoFactorState] = useState<boolean>(false);
  const [currency, setCurrencyState] = useState<Currency>("BRL");
  const [scope, setScope] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedAvatar = localStorage.getItem(getAvatarStorageKey(profile.email));
      setAvatarUrlState(savedAvatar || null);
    } catch {
      setAvatarUrlState(null);
    }
  }, [profile.email]);

  useEffect(() => {
    if (!lastAddedId) return;
    const timer = window.setTimeout(() => setLastAddedId(null), 350);
    return () => window.clearTimeout(timer);
  }, [lastAddedId]);

  async function syncFromBackend() {
    const token = getAuthToken();
    const storedUser = getStoredAuthUser();
    let savedScope = loadLocalScope();
    if (!savedScope && storedUser?.email) {
      savedScope = await startLocalScope(storedUser.email);
    }
    if (savedScope) setScope(savedScope);

    if (storedUser) {
      setRole(storedUser.role || "user");
      const local = loadLocalProfile(storedUser.email);
      setProfile((prev) => ({
        ...prev,
        name: local?.name || storedUser.name || prev.name,
        email: local?.email || storedUser.email || prev.email,
        phone: local?.phone || prev.phone,
        birthDate: local?.birthDate || prev.birthDate,
        address: local?.address || prev.address,
      }));
      if (storedUser.currency) setCurrencyState(storedUser.currency);
      if (typeof storedUser.twoFactorEnabled === "boolean") {
        setTwoFactorState(storedUser.twoFactorEnabled);
      }
    }

    const localTx = loadTransactions(savedScope);

    if (!isOnlineToken(token)) {
      setTransactions(localTx);
      if (!storedUser?.currency) setCurrencyState(loadCurrency());
      setLoaded(true);
      return;
    }

    try {
      const [remoteProfile, remoteTx] = await Promise.all([
        apiGetMyProfile(),
        apiListTransactions(),
      ]);
      const freshProfile = {
        name: remoteProfile.name || "",
        email: remoteProfile.email || "",
        phone: remoteProfile.phone || "",
        birthDate: remoteProfile.birthDate || "",
        address: remoteProfile.address || "",
      };
      setProfile(freshProfile);
      saveLocalProfile(freshProfile);
      setRole(remoteProfile.role || "user");
      setCurrencyState(remoteProfile.currency || "BRL");
      setTwoFactorState(Boolean(remoteProfile.twoFactorEnabled));

      // FUSÃO INTELIGENTE: Nunca descarta lançamentos do usuário
      const txMap = new Map<string, Transaction>();
      for (const t of localTx) txMap.set(t.id, t);
      for (const t of (remoteTx || [])) txMap.set(t.id, t);
      const unifiedTx = Array.from(txMap.values());

      setTransactions(unifiedTx);
      if (savedScope) {
        saveTransactions(unifiedTx, savedScope);
      }

      // Sincroniza lançamentos locais de volta para o pod atual caso ele não os tenha
      if (remoteTx) {
        for (const t of localTx) {
          if (!remoteTx.some((r) => r.id === t.id)) {
            void apiCreateTransaction({
              id: t.id,
              description: t.description,
              amount: t.amount,
              date: t.date,
              category: t.category,
              type: t.type,
              status: t.status,
              paymentMethod: t.paymentMethod,
              contact: t.contact,
              documentRef: t.documentRef,
              recurring: t.recurring,
              notes: t.notes,
            }).catch(() => {});
          }
        }
      }

      if (token) {
        setAuthSession(token, {
          id: remoteProfile.id,
          name: remoteProfile.name,
          email: remoteProfile.email,
          role: remoteProfile.role,
          currency: remoteProfile.currency,
          twoFactorEnabled: remoteProfile.twoFactorEnabled,
        });
      }
    } catch {
      setTransactions(localTx);
      if (storedUser) {
        const local = loadLocalProfile(storedUser.email);
        if (local) setProfile((prev) => ({ ...prev, ...local }));
      }
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void syncFromBackend();
  }, []);

  useEffect(() => {
    if (loaded && scope) {
      saveTransactions(transactions, scope);
    }
  }, [transactions, loaded, scope]);

  const value = useMemo<TransactionsContextValue>(
    () => ({
      transactions: sortTransactions(transactions),
      loaded,
      lastAddedId,
      profile,
      avatarUrl,
      setAvatarUrl: (dataUrl) => {
        setAvatarUrlState(dataUrl);
        try {
          const key = getAvatarStorageKey(profile.email);
          if (dataUrl) {
            localStorage.setItem(key, dataUrl);
          } else {
            localStorage.removeItem(key);
          }
        } catch {
          // ignore storage quota errors
        }
        if (isOnlineToken(getAuthToken())) {
          void apiLogFrontendEvent(
            "PROFILE_PHOTO_UPDATED",
            dataUrl
              ? `Usuário '${profile.name || profile.email}' alterou a foto de perfil.`
              : `Usuário '${profile.name || profile.email}' removeu a foto de perfil.`,
          );
        }
      },
      role,
      twoFactorEnabled,
      currency,
      setCurrency: (next) => {
        const saved = saveCurrency(next);
        if (saved) {
          setCurrencyState(next);
          recordAuditEvent({
            acao: "PREFERENCES_UPDATED",
            modulo: "PREFERENCES",
            o_que_fez: `Alterou a moeda padrão do sistema para ${next}.`,
            quem_nome: profile.name,
            quem_email: profile.email,
            depois: { currency: next },
          });
        }
        if (isOnlineToken(getAuthToken())) {
          void apiUpdateMyPreferences({ currency: next, twoFactorEnabled }).catch(() => {});
        }
        return saved;
      },
      setTwoFactorEnabled: async (enabled) => {
        if (!getAuthToken()) return false;
        recordAuditEvent({
          acao: "2FA_TOGGLED",
          modulo: "SECURITY",
          o_que_fez: `${enabled ? "Ativou" : "Desativou"} a autenticação em duas etapas (2FA).`,
          quem_nome: profile.name,
          quem_email: profile.email,
          depois: { twoFactorEnabled: enabled },
        });
        if (!isOnlineToken(getAuthToken())) {
          setTwoFactorState(enabled);
          return true;
        }
        try {
          const updated = await apiUpdateMyPreferences({
            currency,
            twoFactorEnabled: enabled,
          });
          setTwoFactorState(Boolean(updated.twoFactorEnabled));
          return true;
        } catch {
          setTwoFactorState(enabled);
          return true;
        }
      },
      updateProfile: async (next) => {
        const prepared = prepareProfile(next);
        const before = {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          birthDate: profile.birthDate,
          address: profile.address,
        };

        // 1. Sempre salva localmente no navegador (garante que persista mesmo offline ou no Vercel)
        saveLocalProfile(prepared);
        const currentStored = getStoredAuthUser();
        if (currentStored) {
          setAuthSession(getAuthToken() || "offline-demo-token", {
            ...currentStored,
            name: prepared.name,
            email: prepared.email,
          });
        }

        // 2. Grava evento de auditoria completo com antes e depois
        recordAuditEvent({
          acao: "PROFILE_UPDATED",
          modulo: "PROFILE",
          o_que_fez: `Usuário '${prepared.name}' atualizou suas informações pessoais de perfil.`,
          quem_nome: prepared.name,
          quem_email: prepared.email,
          antes: before,
          depois: {
            name: prepared.name,
            email: prepared.email,
            phone: prepared.phone,
            birthDate: prepared.birthDate,
            address: prepared.address,
          },
        });

        // 3. Se houver conexão com o backend FastAPI, persiste no banco de dados SQL
        if (isOnlineToken(getAuthToken())) {
          try {
            const updated = await apiUpdateMyProfile(prepared);
            const fresh = {
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              birthDate: updated.birthDate,
              address: updated.address,
            };
            setProfile(fresh);
            saveLocalProfile(fresh);
            setRole(updated.role);
            return;
          } catch {
            // fallback local preservado
          }
        }
        setProfile(prepared);
      },
      resetProfile: () => setProfile({ ...emptyProfile }),
      authenticateSession: async (token, user) => {
        setAuthSession(token, user);
        try {
          recordAuditEvent({
            acao: "USER_LOGIN_SUCCESS",
            modulo: "AUTH",
            o_que_fez: `Login realizado com sucesso por '${user.name}' (${user.email}) [Perfil: ${user.role?.toUpperCase() || "USER"}].`,
            quem_nome: user.name,
            quem_email: user.email,
            depois: { id: user.id, name: user.name, email: user.email, role: user.role },
          });
        } catch {
          // ignore
        }
        const nextScope = await startLocalScope(user.email);
        setScope(nextScope);
        setRole(user.role || "user");
        const local = loadLocalProfile(user.email);
        const initial = {
          name: local?.name || user.name,
          email: local?.email || user.email,
          phone: local?.phone || "",
          birthDate: local?.birthDate || "",
          address: local?.address || "",
        };
        setProfile(initial);
        saveLocalProfile(initial);
        setCurrencyState(user.currency || "BRL");
        setTwoFactorState(Boolean(user.twoFactorEnabled));
        await syncFromBackend();
      },
      startLocalSession: async (email) => {
        const nextScope = await startLocalScope(email);
        setScope(nextScope);
        setTransactions(loadTransactions(nextScope));
        const local = loadLocalProfile(email);
        const initial = local || { ...emptyProfile, email };
        setProfile(initial);
        try {
          recordAuditEvent({
            acao: "USER_LOGIN_SUCCESS",
            modulo: "AUTH",
            o_que_fez: `Sessão local iniciada por '${initial.name}' (${initial.email}).`,
            quem_nome: initial.name,
            quem_email: initial.email,
          });
        } catch {
          // ignore
        }
        setLastAddedId(null);
        setLoaded(true);
      },
      endLocalSession: () => {
        try {
          if (profile.email) {
            recordAuditEvent({
              acao: "USER_LOGOUT",
              modulo: "AUTH",
              o_que_fez: `Usuário '${profile.name || "Usuário"}' (${profile.email}) encerrou a sessão (Logout).`,
              quem_nome: profile.name,
              quem_email: profile.email,
            });
          }
        } catch {
          // ignore
        }
        if (scope) {
          saveTransactions(transactions, scope);
        }
        if (isOnlineToken(getAuthToken())) void apiLogout();
        else clearAuthSession();
        endLocalScope();
        setScope(null);
        setTransactions([]);
        setProfile({ ...emptyProfile });
        setRole("user");
        setTwoFactorState(false);
        setLastAddedId(null);
      },
      add: (data) => {
        const localItem = createTransaction(data);
        setLastAddedId(localItem.id);
        setTransactions((cur) => {
          const next = [localItem, ...cur];
          if (scope) saveTransactions(next, scope);
          return next;
        });

        recordAuditEvent({
          acao: "TRANSACTION_CREATED",
          modulo: "TRANSACTION",
          o_que_fez: `Registrou ${data.type === "income" ? "Receita" : "Despesa"}: '${data.description}' (R$ ${Number(data.amount).toFixed(2)}).`,
          quem_nome: profile.name,
          quem_email: profile.email,
          depois: { ...data },
        });

        if (isOnlineToken(getAuthToken())) {
          void apiCreateTransaction({ ...data, id: localItem.id })
            .then((created) => {
              setTransactions((cur) => {
                const updated = cur.map((t) => (t.id === localItem.id ? created : t));
                if (scope) saveTransactions(updated, scope);
                return updated;
              });
            })
            .catch(() => {
              // Já está salvo localmente
            });
        }
      },
      update: (id, data) => {
        const old = transactions.find((t) => t.id === id);
        recordAuditEvent({
          acao: "TRANSACTION_UPDATED",
          modulo: "TRANSACTION",
          o_que_fez: `Editou lançamento '${data.description}' (${data.type === "income" ? "Receita" : "Despesa"}).`,
          quem_nome: profile.name,
          quem_email: profile.email,
          antes: old ? { ...old } : null,
          depois: { id, ...data },
        });
        setTransactions((cur) => {
          const next = cur.map((t) => (t.id === id ? { ...data, id } : t));
          if (scope) saveTransactions(next, scope);
          return next;
        });
        if (isOnlineToken(getAuthToken())) {
          void apiUpdateTransaction(id, data).catch(() => {});
        }
      },
      toggleStatus: (id) => {
        const target = transactions.find((t) => t.id === id);
        if (!target) return;
        const nextStatus = target.status === "confirmado" ? "pendente" : "confirmado";
        recordAuditEvent({
          acao: "TRANSACTION_STATUS_TOGGLED",
          modulo: "TRANSACTION",
          o_que_fez: `Alterou status do lançamento '${target.description}' para '${nextStatus}'.`,
          quem_nome: profile.name,
          quem_email: profile.email,
          antes: { id, status: target.status },
          depois: { id, status: nextStatus },
        });
        setTransactions((cur) => {
          const next = cur.map((t) => (t.id === id ? { ...t, status: nextStatus } : t));
          if (scope) saveTransactions(next, scope);
          return next;
        });
        if (isOnlineToken(getAuthToken())) {
          void apiPatchTransactionStatus(id, nextStatus).catch(() => {});
        }
      },
      remove: (id) => {
        const target = transactions.find((t) => t.id === id);
        recordAuditEvent({
          acao: "TRANSACTION_DELETED",
          modulo: "TRANSACTION",
          o_que_fez: `Excluiu o lançamento '${target?.description || id}'.`,
          quem_nome: profile.name,
          quem_email: profile.email,
          antes: target ? { ...target } : null,
        });
        setTransactions((cur) => {
          const next = cur.filter((t) => t.id !== id);
          if (scope) saveTransactions(next, scope);
          return next;
        });
        if (isOnlineToken(getAuthToken())) {
          void apiDeleteTransaction(id).catch(() => {});
        }
      },
    }),
    [transactions, loaded, lastAddedId, profile, avatarUrl, role, twoFactorEnabled, currency, scope],
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

export function useTransactions(): TransactionsContextValue {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error("useTransactions deve ser usado dentro de TransactionsProvider");
  return ctx;
}
