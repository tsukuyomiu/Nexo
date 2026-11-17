import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Lock, FileText, UserCheck, EyeOff, Mail } from "lucide-react";
import { NexoLayout } from "@/components/NexoLayout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Nexo" },
      {
        name: "description",
        content: "Política de Privacidade e Termos de Uso do Projeto Nexo - Sistema de Gestão Financeira.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <NexoLayout>
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Início
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Política de Privacidade e Termos de Uso</h1>
                <p className="text-slate-400 text-sm mt-1">Última atualização: Novembro de 2026 • Projeto Nexo</p>
              </div>
            </div>
          </div>

          {/* Card com o Conteúdo Completo */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-10 space-y-8 shadow-xl">
            {/* Seção 1 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-lg">
                <FileText className="w-5 h-5" />
                <h2>1. Apresentação e Identificação</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                O <strong>Projeto Nexo</strong> é uma aplicação web de gestão financeira pessoal e empresarial desenvolvida para simplificar o controle de receitas, despesas, auditoria de lançamentos e planejamento orçamentário. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos os seus dados ao acessar nossa plataforma.
              </p>
            </section>

            {/* Seção 2 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-lg">
                <UserCheck className="w-5 h-5" />
                <h2>2. Informações Coletadas e Uso do Google OAuth</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Para oferecer uma experiência de autenticação rápida, prática e segura, o Projeto Nexo disponibiliza o recurso <strong>Entrar com Google (Google Identity Services)</strong>.
              </p>
              <ul className="list-disc list-inside text-slate-300 text-sm space-y-1.5 pl-2">
                <li><strong>Dados acessados via Google:</strong> Apenas o seu nome completo, endereço de e-mail e foto pública de perfil.</li>
                <li><strong>Finalidade estrita:</strong> Identificação unívoca do usuário na plataforma, criação de perfil personalizado e controle de acesso aos seus próprios lançamentos financeiros.</li>
                <li><strong>Não solicitamos nem acessamos:</strong> Seus contatos, arquivos do Google Drive, mensagens do Gmail, agenda ou qualquer informação confidencial externa à autenticação básica de identidade.</li>
              </ul>
            </section>

            {/* Seção 3 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-lg">
                <Lock className="w-5 h-5" />
                <h2>3. Armazenamento, Segurança e Integridade dos Dados</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Todas as comunicações com nossa infraestrutura utilizam conexões criptografadas com protocolo seguro HTTPS (SSL/TLS). As senhas locais são devidamente protegidas por hash irreversível, e os dados de transações financeiras são estritamente isolados por usuário no banco de dados.
              </p>
            </section>

            {/* Seção 4 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-lg">
                <EyeOff className="w-5 h-5" />
                <h2>4. Não Compartilhamento com Terceiros</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                O Projeto Nexo <strong>não comercializa, não aluga e não compartilha</strong> informações pessoais, e-mails ou dados financeiros com terceiros para fins publicitários ou comerciais. Qualquer processamento interno tem a finalidade exclusiva de prestar o serviço de controle orçamentário solicitado pelo próprio usuário.
              </p>
            </section>

            {/* Seção 5 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-lg">
                <ShieldCheck className="w-5 h-5" />
                <h2>5. Direitos do Titular (LGPD) e Exclusão de Dados</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD), você possui o direito de consultar seus lançamentos, solicitar a retificação de suas informações cadastrais ou requerer a exclusão completa da sua conta e de todo o seu histórico financeiro armazenado no sistema.
              </p>
            </section>

            {/* Seção 6 */}
            <section className="space-y-3 border-t border-slate-800 pt-6">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-lg">
                <Mail className="w-5 h-5" />
                <h2>6. Informações de Contato do Desenvolvedor</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Caso você tenha dúvidas sobre esta política, sobre como tratamos os dados ou deseje exercer seus direitos de privacidade, entre em contato diretamente com o responsável técnico do projeto:
              </p>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-sm space-y-1">
                <p className="text-white font-medium">Gabriel Nonato (Desenvolvedor e Administrador Nexo)</p>
                <p className="text-slate-400">E-mail de suporte e privacidade: <span className="text-cyan-400 font-mono">ggnonato@gmail.com</span></p>
                <p className="text-slate-400">Website: <a href="https://project-nexo-one.vercel.app" className="text-cyan-400 hover:underline">https://project-nexo-one.vercel.app</a></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </NexoLayout>
  );
}
