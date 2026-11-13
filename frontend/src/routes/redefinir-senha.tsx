import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isEmail, NexoLayout } from "@/components/NexoLayout";
import { apiForgotPassword, apiResetPassword } from "@/lib/api";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinição de senha | Nexo" },
      { name: "description", content: "Recupere o acesso à sua conta Nexo." },
    ],
  }),
  component: ResetPage,
});

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition focus:border-[#1D63DC] focus:ring-2 focus:ring-[#1D63DC]/20";
const btnClass =
  "nexo-btn-fluid h-10 w-full rounded-lg bg-[#1D63DC] px-4 text-xs font-bold text-white shadow-btn hover:bg-[#1854BD] disabled:opacity-50 sm:text-sm";

function ResetPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) return setError("Informe um email válido.");
    setError("");
    setLoading(true);
    try {
      const res = await apiForgotPassword(email.trim());
      if (res.dev_code) setDevCode(res.dev_code);
      toast.success(
        res.email_sent_smtp
          ? `Código enviado para o seu Gmail (${email})!`
          : `Código de recuperação gerado: ${res.dev_code}`,
      );
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError("Informe o código recebido.");
    if (pass.length < 6) return setError("A nova senha deve ter ao menos 6 caracteres.");
    if (pass !== confirm) return setError("As senhas não coincidem.");
    setError("");
    setLoading(true);
    try {
      await apiResetPassword({
        email: email.trim(),
        code: code.trim(),
        new_password: pass,
        confirm_password: confirm,
      });
      toast.success("Senha redefinida no banco de dados! Faça seu login.");
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <NexoLayout>
      <section className="nexo-card flex w-full max-w-md flex-col items-center gap-4 bg-card p-8 text-center sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Redefinição de senha</h1>
        {step === 1 ? (
          <form onSubmit={sendEmail} noValidate className="flex w-full flex-col items-center gap-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Digite seu email no campo abaixo e<br />
              lhe enviaremos um código de segurança.
            </p>
            <label htmlFor="reset-email" className="sr-only">
              E-mail
            </label>
            <input
              id="reset-email"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className={btnClass}>
              {loading ? "Enviando..." : "Redefinir senha"}
            </button>
            <Link to="/" className="text-xs font-semibold text-link hover:underline">
              Já possui cadastro? Faça seu login
            </Link>
          </form>
        ) : (
          <form
            onSubmit={resetPassword}
            noValidate
            className="flex w-full flex-col items-center gap-3.5"
          >
            <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-xs text-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              Um código foi gerado para {email}
            </div>
            {devCode && (
              <p className="rounded-md bg-muted px-3 py-1.5 text-xs text-foreground">
                Código de segurança: <strong className="font-mono">{devCode}</strong>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Por favor insira o código enviado para seu email e redefina sua senha
            </p>
            <label htmlFor="code" className="sr-only">
              Código
            </label>
            <input
              id="code"
              placeholder="Código"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={fieldClass}
            />
            <label htmlFor="new-pass" className="sr-only">
              Nova senha
            </label>
            <input
              id="new-pass"
              type="password"
              placeholder="Nova senha"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className={fieldClass}
            />
            <label htmlFor="confirm-pass" className="sr-only">
              Confirmar nova senha
            </label>
            <input
              id="confirm-pass"
              type="password"
              placeholder="Confirmar nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
            />
            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className={btnClass}>
              {loading ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </section>
    </NexoLayout>
  );
}
