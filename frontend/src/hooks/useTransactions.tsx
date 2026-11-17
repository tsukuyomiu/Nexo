import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { emptyProfile, prepareProfile, type Profile } from "@/lib/profile";
import { loadCurrency, saveCurrency, type Currency } from "@/lib/preferences";
import { endLocalScope, loadLocalScope, startLocalScope } from "@/lib/local-identity";
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
    const savedScope = loadLocalScope();
    if (savedScope) setScope(savedScope);

    if (storedUser) {
      setRole(storedUser.role || "user");
      setProfile((prev) => ({
        ...prev,
        name: storedUser.name || prev.name,
        email: storedUser.email || prev.email,
      }));
      if (storedUser.currency) setCurrencyState(storedUser.currency);
      if (typeof storedUser.twoFactorEnabled === "boolean") {
        setTwoFactorState(storedUser.twoFactorEnabled);
      }
    }

    if (!isOnlineToken(token)) {
      setTransactions(loadTransactions(savedScope));
      if (!storedUser?.currency) setCurrencyState(loadCurrency());
      setLoaded(true);
      return;
    }

    try {
      const [remoteProfile, remoteTx] = await Promise.all([
        apiGetMyProfile(),
        apiListTransactions(),
      ]);
      setProfile({
        name: remoteProfile.name || "",
        email: remoteProfile.email || "",
        phone: remoteProfile.phone || "",
        birthDate: remoteProfile.birthDate || "",
        address: remoteProfile.address || "",
      });
      setRole(remoteProfile.role || "user");
      setCurrencyState(remoteProfile.currency || "BRL");
      setTwoFactorState(Boolean(remoteProfile.twoFactorEnabled));
      setTransactions(remoteTx);
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
      setTransactions(loadTransactions(savedScope));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void syncFromBackend();
  }, []);

  useEffect(() => {
    if (loaded && scope && !isOnlineToken(getAuthToken())) {
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
        if (saved) setCurrencyState(next);
        if (isOnlineToken(getAuthToken())) {
          void apiUpdateMyPreferences({ currency: next, twoFactorEnabled }).catch(() => {});
        }
        return saved;
      },
      setTwoFactorEnabled: async (enabled) => {
        if (!getAuthToken()) return false;
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
        if (isOnlineToken(getAuthToken())) {
          try {
            const updated = await apiUpdateMyProfile(prepared);
            setProfile({
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              birthDate: updated.birthDate,
              address: updated.address,
            });
            setRole(updated.role);
            return;
          } catch {
            // fallback local
          }
        }
        setProfile(prepared);
      },
      resetProfile: () => setProfile({ ...emptyProfile }),
      authenticateSession: async (token, user) => {
        setAuthSession(token, user);
        const nextScope = await startLocalScope(user.email);
        setScope(nextScope);
        setRole(user.role || "user");
        setProfile({
          name: user.name,
          email: user.email,
          phone: "",
          birthDate: "",
          address: "",
        });
        setCurrencyState(user.currency || "BRL");
        setTwoFactorState(Boolean(user.twoFactorEnabled));
        await syncFromBackend();
      },
      startLocalSession: async (email) => {
        const nextScope = await startLocalScope(email);
        setScope(nextScope);
        setTransactions(loadTransactions(nextScope));
        setProfile({ ...emptyProfile, email });
        setLastAddedId(null);
        setLoaded(true);
      },
      endLocalSession: () => {
        if (isOnlineToken(getAuthToken())) void apiLogout();
        else clearAuthSession();
        if (scope && !isOnlineToken(getAuthToken())) saveTransactions(transactions, scope);
        endLocalScope();
        setScope(null);
        setTransactions([]);
        setProfile({ ...emptyProfile });
        setRole("user");
        setTwoFactorState(false);
        setLastAddedId(null);
      },
      add: (data) => {
        if (isOnlineToken(getAuthToken())) {
          void apiCreateTransaction(data)
            .then((created) => {
              setLastAddedId(created.id);
              setTransactions((cur) => [created, ...cur]);
            })
            .catch(() => {
              const transaction = createTransaction(data);
              setLastAddedId(transaction.id);
              setTransactions((cur) => [transaction, ...cur]);
            });
        } else {
          const transaction = createTransaction(data);
          setLastAddedId(transaction.id);
          setTransactions((cur) => [transaction, ...cur]);
        }
      },
      update: (id, data) => {
        if (isOnlineToken(getAuthToken())) {
          void apiUpdateTransaction(id, data)
            .then((updated) => {
              setTransactions((cur) => cur.map((t) => (t.id === id ? updated : t)));
            })
            .catch(() => {
              setTransactions((cur) => cur.map((t) => (t.id === id ? { ...data, id } : t)));
            });
        } else {
          setTransactions((cur) => cur.map((t) => (t.id === id ? { ...data, id } : t)));
        }
      },
      toggleStatus: (id) => {
        const target = transactions.find((t) => t.id === id);
        if (!target) return;
        const nextStatus = target.status === "confirmado" ? "pendente" : "confirmado";
        if (isOnlineToken(getAuthToken())) {
          void apiPatchTransactionStatus(id, nextStatus)
            .then((updated) => {
              setTransactions((cur) => cur.map((t) => (t.id === id ? updated : t)));
            })
            .catch(() => {
              setTransactions((cur) =>
                cur.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)),
              );
            });
        } else {
          setTransactions((cur) =>
            cur.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)),
          );
        }
      },
      remove: (id) => {
        if (isOnlineToken(getAuthToken())) {
          void apiDeleteTransaction(id)
            .then(() => {
              setTransactions((cur) => cur.filter((t) => t.id !== id));
            })
            .catch(() => {
              setTransactions((cur) => cur.filter((t) => t.id !== id));
            });
        } else {
          setTransactions((cur) => cur.filter((t) => t.id !== id));
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
