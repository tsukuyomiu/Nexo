import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ChevronDown,
  Info,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTransactions } from "@/hooks/useTransactions";
import { CURRENCIES, type Currency } from "@/lib/preferences";

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "NX";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/* Layout das telas internas:
   - Mantém a barra superior azul-marinho característica do Nexo com a logo e o nome.
   - Menu suspenso interativo no nome do usuário com opções rápidas, seletor de moeda e logout. */
export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { profile, avatarUrl, setAvatarUrl, role, currency, setCurrency, endLocalSession } =
    useTransactions();
  const isAdmin = role === "admin" || role === "auditor";

  const navItems = [
    { to: "/dashboard", label: "Dashboard", show: true },
    { to: "/lancamentos", label: "Lançamentos", show: true },
    { to: "/logs", label: "Logs", show: isAdmin },
    { to: "/perfil", label: "Perfil", show: true },
    { to: "/sobre", label: "Sobre nós", show: true },
  ] as const;

  const displayName = profile.name?.trim() || profile.email?.split("@")[0] || "Membro Nexo";
  const initials = getInitials(displayName);

  function handleSignOut() {
    endLocalSession();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D213A] text-white shadow-xs">
        <nav
          className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
          aria-label="Principal"
        >
          {/* Marca Nexo original preservada */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            <img src="/imagens/logo.png" alt="Logo Nexo" className="h-5 w-5 object-contain" />
            <span>Nexo</span>
          </Link>

          {/* Navegação Central Minimalista — Sublinhado arquitetônico limpo */}
          <ul className="flex h-full items-center gap-4 text-xs sm:gap-6">
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <li key={item.to} className="flex h-full items-center">
                  <Link
                    to={item.to}
                    className="flex h-full items-center border-b-2 border-transparent px-1 font-medium text-white/75 transition-colors duration-200 hover:text-white focus-visible:outline-none"
                    activeProps={{
                      className: "!border-[#38BDF8] font-bold !text-white",
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            <li className="hidden h-full items-center md:flex">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-full items-center border-b-2 border-transparent px-1 font-medium text-white/70 transition-colors duration-200 hover:text-white"
              >
                Sair
              </button>
            </li>
          </ul>

          {/* Aba suspensa (Dropdown) no nome do usuário */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menu da conta"
                className="group flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-xs text-white transition-opacity duration-200 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#1D63DC] text-[11px] font-bold tracking-tight text-white ring-1 ring-white/30">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`Foto de ${displayName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </span>
                <span className="hidden max-w-48 truncate font-semibold tracking-tight text-white sm:inline">
                  {displayName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-white/75 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-lg"
            >
              {/* Cabeçalho de Identificação */}
              <DropdownMenuLabel className="px-2.5 py-2 font-normal">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0D213A] text-xs font-bold text-white">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={`Foto de ${displayName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{displayName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {profile.email || "Sessão ativa"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-md bg-muted px-2.5 py-1 text-[10px]">
                  <span className="font-mono-num uppercase tracking-wider text-muted-foreground">
                    Acesso
                  </span>
                  <span className="font-semibold text-foreground">
                    {isAdmin ? "Administrador" : "Empreendedor"}
                  </span>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="my-1 bg-border" />

              {/* Atalhos de Navegação */}
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/perfil" })}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                Meu Perfil & Segurança
              </DropdownMenuItem>

              {avatarUrl && (
                <DropdownMenuItem
                  onSelect={() => {
                    setAvatarUrl(null);
                    toast.success("Foto removida — monograma restaurado.");
                  }}
                  className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Usar iniciais no avatar ({initials})
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onSelect={() => navigate({ to: "/dashboard" })}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                Dashboard Executivo
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => navigate({ to: "/lancamentos" })}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
              >
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                Meus Lançamentos
              </DropdownMenuItem>

              {isAdmin && (
                <DropdownMenuItem
                  onSelect={() => navigate({ to: "/logs" })}
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
                >
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Logs & Auditoria
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onSelect={() => navigate({ to: "/sobre" })}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
              >
                <Info className="h-4 w-4 text-muted-foreground" />
                Sobre o Projeto Nexo
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border" />

              {/* Seletor Rápido de Moeda */}
              <div className="px-2.5 py-1.5">
                <p className="mb-1.5 font-mono-num text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Moeda de exibição
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {CURRENCIES.map((opt) => {
                    const active = currency === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (setCurrency(opt.value as Currency)) {
                            toast.success(`Moeda alterada para ${opt.value}`);
                          }
                        }}
                        className={`font-mono-num rounded-md py-1 text-[11px] font-semibold transition-colors ${
                          active
                            ? "bg-[#0D213A] text-white"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              <DropdownMenuSeparator className="my-1 bg-border" />

              <DropdownMenuItem
                onSelect={handleSignOut}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold text-expense focus:bg-expense-soft focus:text-expense"
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
