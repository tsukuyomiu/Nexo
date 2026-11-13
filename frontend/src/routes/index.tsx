import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  IconField,
  isEmail,
  NexoLayout,
  SocialButtons,
  WelcomePanel,
} from "@/components/NexoLayout";
import { useTransactions } from "@/hooks/useTransactions";
import { apiConnectGmailAndResend2FA, apiLogin, apiVerify2FA } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Login | Nexo" },
      { name: "description", content: "Entre na sua conta Nexo." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { authenticateSession } = useTransactions();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});

  // Estado da Autenticação em Duas Etapas (2FA)
  const [step2FA, setStep2FA] = useState(false);
  const [code2FA, setCode2FA] = useState("");
  const [devHintCode, setDevHintCode] = useState<string | null>(null);
  const [sentViaSmtp, setSentViaSmtp] = useState(false);
  const [showSmtpSetup, setShowSmtpSetup] = useState(false);
  const [showFallbackCode, setShowFallbackCode] = useState(false);
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [sendingGmail, setSendingGmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const next: typeof errors = {};
    if (!isEmail(email)) next.email = "Informe um email válido.";
    if (!password) next.password = "Informe sua senha.";
    setErrors(next);

    if (Object.keys(next).length === 0) {
      setSubmitting(true);
      try {
        const res = await apiLogin({ email: email.trim(), password });
        if (res.requires_2fa) {
          setStep2FA(true);
          setSentViaSmtp(Boolean(res.email_sent_smtp));
          setDevHintCode(res.dev_code ?? null);
          setShowFallbackCode(false);
          toast.info(
            res.email_sent_smtp
              ? `Código de 2 etapas enviado para o seu Gmail (${email})!`
              : `Verificação em 2 etapas solicitada para ${email}.`,
          );
          return;
        }
        if (res.access_token && res.user) {
          await authenticateSession(res.access_token, res.user);
          toast.success(`Bem-vindo(a), ${res.user.name}!`);
          navigate({ to: "/dashboard" });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function handleConnectGmailAndSend() {
    if (sendingGmail) return;
    setSendingGmail(true);
    try {
      const res = await apiConnectGmailAndResend2FA({
        email: email.trim(),
        smtp_user: email.trim(),
        smtp_app_password: gmailAppPassword.trim() || undefined,
      });
      setSentViaSmtp(Boolean(res.email_sent_smtp));
      setDevHintCode(res.dev_code ?? null);
      if (res.email_sent_smtp) {
        setShowSmtpSetup(false);
        setShowFallbackCode(false);
        toast.success(`E-mail enviado com sucesso para a Caixa de Entrada de ${email}!`);
      } else {
        toast.info("Novo código de verificação gerado.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao conectar ao Gmail SMTP.",
      );
    } finally {
      setSendingGmail(false);
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!code2FA.trim()) {
      setErrors({ code: "Informe o código de 6 dígitos." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiVerify2FA({ email: email.trim(), code: code2FA.trim() });
      if (res.access_token && res.user) {
        await authenticateSession(res.access_token, res.user);
        toast.success(`Verificação em 2 etapas concluída! Bem-vindo(a), ${res.user.name}!`);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código 2FA inválido ou expirado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <NexoLayout useLogoImage hideFooter>
      <div className="nexo-card grid w-full max-w-4xl min-h-[480px] overflow-hidden shadow-lg md:grid-cols-2">
        {!step2FA ? (
          <form
            method="post"
            onSubmit={handleSubmit}
            noValidate
            className="nexo-enter flex flex-col justify-center gap-4 bg-card p-8 sm:p-10"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Login
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Entre com suas credenciais para acessar o painel financeiro.
              </p>
            </div>
            <IconField
              autoComplete="username"
              id="email"
              label="Email"
              type="email"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={setEmail}
              error={errors.email}
            />
            <IconField
              autoComplete="current-password"
              id="password"
              label="Senha"
              type={show ? "text" : "password"}
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={setPassword}
              error={errors.password}
              trailing={
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  className="text-muted-foreground hover:text-primary"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Link
              to="/redefinir-senha"
              className="-mt-1.5 self-end text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Esqueceu sua senha?
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="nexo-btn-fluid h-10 w-full rounded-lg bg-[#1D63DC] text-xs font-bold text-white shadow-btn hover:bg-[#1854BD] disabled:opacity-50 sm:text-sm"
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
            <SocialButtons appleIcon />
            <Link
              to="/cadastro"
              className="mt-1 text-center text-xs font-semibold text-link hover:underline"
            >
              Criar uma conta!
            </Link>
          </form>
        ) : (
          <form
            onSubmit={handleVerify2FA}
            noValidate
            className="nexo-enter flex flex-col justify-center gap-4 bg-card p-8 sm:p-10"
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-secondary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-center text-xl font-bold text-foreground">
              Autenticação em Duas Etapas
            </h1>
            <p className="text-center text-xs text-muted-foreground">
              Enviamos um código de segurança de 6 dígitos para <strong>{email}</strong>. Digite-o
              abaixo para liberar o seu acesso:
            </p>

            {!sentViaSmtp && devHintCode && (
              <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2 text-center text-xs">
                Código de verificação:{" "}
                <button
                  type="button"
                  onClick={() => setCode2FA(devHintCode)}
                  className="font-mono font-bold text-secondary underline"
                >
                  {devHintCode}
                </button>{" "}
                <span className="text-[10px] text-muted-foreground">(clique para preencher)</span>
              </div>
            )}

            <IconField
              id="code-2fa"
              label="Código de 6 dígitos"
              icon={<KeyRound className="h-4 w-4" />}
              value={code2FA}
              onChange={setCode2FA}
              error={errors.code}
            />

            <div className="mt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep2FA(false);
                  setCode2FA("");
                }}
                className="h-9 rounded-lg border border-border px-4 text-xs font-bold text-foreground hover:bg-muted"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-9 rounded-lg bg-[#1D63DC] px-5 text-xs font-bold text-white shadow-btn hover:bg-[#1854BD] disabled:opacity-50"
              >
                {submitting ? "Verificando..." : "Confirmar Código"}
              </button>
            </div>
          </form>
        )}
        <WelcomePanel useLogoImage>
          <p className="max-w-[260px] text-xs leading-relaxed text-white/80">
            Para desfrutar de nossos serviços entre com sua conta já cadastrada ou cadastre sua
            conta.
          </p>
        </WelcomePanel>
      </div>
    </NexoLayout>
  );
}
