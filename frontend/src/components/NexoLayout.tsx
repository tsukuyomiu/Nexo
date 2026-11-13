import { Link, useNavigate } from "@tanstack/react-router";
import {
  Facebook,
  Instagram,
  KeyRound,
  Linkedin,
  Lock,
  Mail,
  MessageCircle,
  Music2,
  ShieldCheck,
  Twitter,
  User,
  Youtube,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FieldLabel } from "@/components/FieldLabel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTransactions } from "@/hooks/useTransactions";
import { apiOAuthLogin } from "@/lib/api";
import { evaluatePasswordStrength } from "@/lib/signup-validation";

/* Logo "N" da Nexo */
export function NexoLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M4 36V6l14 18V6h6v30L10 18v18z" fill="currentColor" />
      <path d="M26 30V10l4-6v26z" fill="currentColor" />
      <path d="M32 26V4l4-2v20z" className="fill-secondary" />
    </svg>
  );
}

const navItems = [
  { to: "/", label: "Início" },
  { to: "/", label: "Entrar" },
  { to: "/sobre", label: "Sobre nós" },
] as const;

const socials = [
  { icon: Instagram, label: "Instagram" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: Twitter, label: "X" },
  { icon: MessageCircle, label: "WhatsApp" },
  { icon: Youtube, label: "YouTube" },
  { icon: Music2, label: "TikTok" },
  { icon: Facebook, label: "Facebook" },
];

export function NexoLayout({
  children,
  useLogoImage = true,
  hideFooter = true,
}: {
  children: ReactNode;
  useLogoImage?: boolean;
  hideFooter?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D213A] text-white shadow-xs">
        <nav
          className="mx-auto flex h-13 max-w-6xl items-center justify-between px-4 sm:px-6"
          aria-label="Principal"
        >
          <Link
            to="/"
            className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            {useLogoImage ? (
              <img src="/imagens/logo.png" alt="Logo Nexo" className="h-5 w-5 object-contain" />
            ) : (
              <NexoLogo />
            )}{" "}
            <span>Nexo</span>
          </Link>
          <ul className="flex items-center gap-4 text-xs sm:gap-7">
            {navItems.map((item) => (
              <li key={item.label} className="hidden sm:block">
                <Link
                  to={item.to}
                  className="font-medium text-white/80 transition-colors hover:text-white focus-visible:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/cadastro"
                className="nexo-btn-fluid inline-flex h-8 items-center rounded-full bg-[#1D63DC] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#1854BD]"
                activeProps={{ className: "ring-1 ring-white/60" }}
              >
                Cadastre-se
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">{children}</main>

      {!hideFooter && (
        <footer className="border-t border-border bg-card/80 px-4 py-6 text-xs backdrop-blur-xs sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-bold text-foreground">Siga a Nexo</span>
                {socials.map(({ icon: Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="grid h-6 w-6 place-items-center rounded-full bg-[#0D213A] text-white transition-colors hover:bg-[#1D63DC]"
                  >
                    <Icon className="h-3 w-3" />
                  </a>
                ))}
              </div>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                Garantir a estabilidade do poder de compra da moeda, zelar por um sistema financeiro
                sólido, eficiente e competitivo, e fomentar o bem-estar econômico.
              </p>
            </div>
            <div className="text-muted-foreground sm:text-right">
              <p className="font-mono-num text-[11px]">Atendimento: 145 (custo de ligação local)</p>
              <div className="mt-1 flex flex-wrap gap-4 font-medium text-link sm:justify-end">
                <Link to="/sobre" className="hover:underline">
                  Sobre nós
                </Link>
                <a href="#" className="hover:underline">
                  Política de privacidade
                </a>
                <a href="#" className="hover:underline">
                  Política de acessibilidade
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

/* Painel azul-marinho característico da Nexo (Login e Cadastro) */
export function WelcomePanel({
  children,
  useLogoImage = true,
}: {
  children?: ReactNode;
  useLogoImage?: boolean;
}) {
  return (
    <section className="relative flex flex-col items-center justify-center bg-[#0D213A] p-10 text-center text-white">
      <div className="relative z-10 flex flex-col items-center">
        {useLogoImage ? (
          <img
            src="/imagens/logo.png"
            alt="Logo Nexo"
            className="h-16 w-16 object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <NexoLogo className="h-16 w-16" />
        )}
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Bem Vindo!
        </h2>
        <div className="mt-3 flex flex-col items-center gap-3 text-white/80">{children}</div>
      </div>
    </section>
  );
}

/* Campo com ícone, com proporção executiva e foco limpo */
export function IconField({
  id,
  label,
  icon,
  type = "text",
  value,
  onChange,
  error,
  trailing,
  required = false,
  autoComplete,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  trailing?: ReactNode;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      {required ? (
        <FieldLabel htmlFor={id} required>
          {label}
        </FieldLabel>
      ) : (
        <label htmlFor={id} className="mb-1 block text-xs font-semibold text-foreground/85">
          {label}
        </label>
      )}
      <div
        className={`nexo-feedback flex h-10 items-center gap-2.5 rounded-lg border bg-card px-3 transition-all focus-within:border-[#1D63DC] focus-within:ring-3 focus-within:ring-[#1D63DC]/15 ${
          error ? "border-destructive ring-1 ring-destructive/20" : "border-border"
        }`}
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <input
          id={id}
          name={id}
          autoComplete={autoComplete}
          type={type}
          value={value}
          placeholder={label}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-required={required || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-sm"
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} className="nexo-enter mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const AppleIcon = () => (
  <svg viewBox="0 0 384 512" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

export function PasswordStrengthMeter({ password }: { password: string }) {
  const info = evaluatePasswordStrength(password);
  if (info.level === "empty") return null;

  const barColors = {
    weak: "bg-destructive",
    medium: "bg-amber-500",
    strong: "bg-green-500",
  } as const;

  const textColors = {
    weak: "text-destructive",
    medium: "text-amber-500",
    strong: "text-green-500",
  } as const;

  const activeColor = barColors[info.level];

  return (
    <div className="mt-1 flex flex-col gap-1.5" aria-live="polite">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Força da senha:</span>
        <span className={`font-bold ${textColors[info.level]}`}>Senha {info.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <span className={`h-1.5 rounded-full transition-colors ${info.score >= 1 ? activeColor : "bg-muted"}`} />
        <span className={`h-1.5 rounded-full transition-colors ${info.score >= 2 ? activeColor : "bg-muted"}`} />
        <span className={`h-1.5 rounded-full transition-colors ${info.score >= 3 ? activeColor : "bg-muted"}`} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className={info.hasMinLength ? "font-semibold text-green-500" : ""}>
          {info.hasMinLength ? "✓" : "•"} 6+ caracteres
        </span>
        <span className={info.hasUpperAndLower ? "font-semibold text-green-500" : ""}>
          {info.hasUpperAndLower ? "✓" : "•"} Maiúscula/minúscula
        </span>
        <span className={info.hasNumber ? "font-semibold text-green-500" : ""}>
          {info.hasNumber ? "✓" : "•"} Número
        </span>
        <span className={info.hasSpecial ? "font-semibold text-green-500" : ""}>
          {info.hasSpecial ? "✓" : "•"} Símbolo (@#$%)
        </span>
      </div>
    </div>
  );
}

export function SocialButtons({ appleIcon = true }: { appleIcon?: boolean }) {
  const navigate = useNavigate();
  const { authenticateSession } = useTransactions();
  const [providerModal, setProviderModal] = useState<"google" | "apple" | null>(null);
  const [name, setName] = useState("Gabriel Nonato");
  const [email, setEmail] = useState("ggnonato@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const defaultAccounts = [
    { name: "Gabriel Nonato", email: "ggnonato@gmail.com" },
    { name: "sasq", email: "sasqnegro@gmail.com" },
    { name: "Thaylle", email: "tylex.dev@gmail.com" },
  ];

  const [savedAccounts, setSavedAccounts] = useState<Array<{ name: string; email: string }>>(() => {
    if (typeof window === "undefined") return defaultAccounts;
    try {
      const raw = window.localStorage.getItem("nexo:oauth-accounts");
      if (!raw) return defaultAccounts;
      const parsed = JSON.parse(raw) as Array<{ name: string; email: string }>;
      const merged = [...defaultAccounts];
      for (const item of parsed) {
        if (item.email && !merged.some((m) => m.email.toLowerCase() === item.email.toLowerCase())) {
          merged.push(item);
        }
      }
      return merged;
    } catch {
      return defaultAccounts;
    }
  });

  function rememberAccount(accName: string, accEmail: string) {
    const cleanEmail = accEmail.trim().toLowerCase();
    const cleanName = accName.trim();
    const next = [
      { name: cleanName, email: cleanEmail },
      ...savedAccounts.filter((a) => a.email.toLowerCase() !== cleanEmail),
    ];
    setSavedAccounts(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("nexo:oauth-accounts", JSON.stringify(next));
      } catch {
        // Ignora erro de quota
      }
    }
  }

  function openModal(provider: "google" | "apple") {
    setProviderModal(provider);
    setName("Gabriel Nonato");
    setEmail(provider === "google" ? "ggnonato@gmail.com" : "gabriel.nonato@icloud.com");
    setPassword("");
  }

  async function quickLoginAccount(accName: string, accEmail: string) {
    if (!providerModal || loading) return;
    setLoading(true);
    try {
      const res = await apiOAuthLogin({
        provider: providerModal,
        email: accEmail.trim(),
        name: accName.trim(),
      });
      if (res.access_token && res.user) {
        rememberAccount(res.user.name, res.user.email);
        await authenticateSession(res.access_token, res.user);
        toast.success(`Bem-vindo(a), ${res.user.name}!`);
        setProviderModal(null);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível autenticar via Google.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!providerModal || loading) return;
    if (!name.trim()) {
      toast.error("Informe o nome da conta.");
      return;
    }
    if (!isEmail(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (password && password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiOAuthLogin({
        provider: providerModal,
        email: email.trim(),
        name: name.trim(),
        password: password.trim() || undefined,
      });
      if (res.access_token && res.user) {
        rememberAccount(res.user.name, res.user.email);
        await authenticateSession(res.access_token, res.user);
        toast.success(`Bem-vindo(a), ${res.user.name}!`);
        setProviderModal(null);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível autenticar via OAuth.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>Ou continue com</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => openModal("google")}
          aria-label="Continuar com Google"
          title="Entrar com conta Google (Gmail)"
          className="nexo-btn-fluid inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted/70"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Google</span>
        </button>
        <button
          type="button"
          onClick={() => openModal("apple")}
          aria-label="Continuar com Apple"
          title="Entrar com ID Apple"
          className="nexo-btn-fluid inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-2xs hover:bg-muted/70"
        >
          {appleIcon && <AppleIcon />}
          <span>Apple</span>
        </button>
      </div>

      <Dialog open={!!providerModal} onOpenChange={(v) => !v && setProviderModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {providerModal === "google" ? (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                  G
                </span>
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                  <AppleIcon />
                </span>
              )}
              Escolha uma conta {providerModal === "google" ? "Google" : "Apple"}
            </DialogTitle>
            <DialogDescription>
              Clique na sua conta conectada para entrar imediatamente ou cadastre uma nova conta
              abaixo.
            </DialogDescription>
          </DialogHeader>

          {/* Contas salvas para login em 1 clique */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground">
              Contas conectadas neste dispositivo:
            </span>
            {savedAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => void quickLoginAccount(acc.name, acc.email)}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-left transition hover:border-secondary hover:bg-secondary/10"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {acc.name[0]?.toUpperCase()}
                  </span>
                  <div className="leading-tight">
                    <p className="text-xs font-bold text-foreground">{acc.name}</p>
                    <p className="text-[11px] text-muted-foreground">{acc.email}</p>
                  </div>
                </div>
                <span className="rounded-md bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">
                  Entrar
                </span>
              </button>
            ))}
          </div>

          <div className="my-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou usar / cadastrar outra conta{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleOAuthSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">
                Nome completo
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="h-9 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">
                E-mail ({providerModal === "google" ? "Gmail" : "iCloud / Apple ID"})
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@gmail.com"
                  className="h-9 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">
                Senha (opcional para contas existentes)
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Defina uma senha se for conta nova"
                  className="h-9 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProviderModal(null)}
                className="h-9 rounded-lg border border-border px-4 text-xs font-bold text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-5 text-xs font-bold text-secondary-foreground shadow-btn hover:brightness-110 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {loading ? "Autenticando..." : "Confirmar e Entrar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
