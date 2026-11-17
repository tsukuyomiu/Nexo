import { Accessibility, Contrast, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccessibility } from "@/hooks/useAccessibility";

export function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    fontSize,
    highContrast,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    toggleHighContrast,
    resetAccessibility,
  } = useAccessibility();

  // Fecha com a tecla Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Carrega e inicializa o VLibras automaticamente para estar sempre ativo na tela
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).VLibras) return;

    const existingScript = document.querySelector('script[src*="vlibras-plugin.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
      script.async = true;
      script.onload = () => {
        try {
          if ((window as any).VLibras) {
            new (window as any).VLibras.Widget("https://vlibras.gov.br/app");
          }
        } catch {
          // Inicialização silenciosa
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      {/* Botão Flutuante de Acessibilidade */}
      <aside aria-label="Acessibilidade" className="fixed bottom-5 right-5 z-50">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title="Abrir menu de acessibilidade"
          aria-label="Abrir painel de acessibilidade"
          aria-expanded={isOpen}
          className="group flex h-11 w-11 items-center justify-center rounded-full bg-[#0D213A] text-white shadow-lg transition-transform hover:scale-110 hover:bg-[#1D63DC] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#38BDF8]"
        >
          <Accessibility className="h-5 w-5 transition-transform group-hover:rotate-12" />
        </button>

        {/* Modal / Menu de Acessibilidade Flutuante */}
        {isOpen && (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Opções de Acessibilidade"
            className="absolute bottom-14 right-0 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1D63DC] text-white">
                  <Accessibility className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-bold text-foreground">Acessibilidade</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Fechar painel"
                aria-label="Fechar painel de acessibilidade"
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4 text-xs">
              {/* Tamanho da Fonte */}
              <div>
                <span className="font-bold text-foreground">Tamanho do Texto</span>
                <p className="text-[11px] text-muted-foreground">
                  Ajuste o tamanho de leitura de todo o site
                </p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={decreaseFontSize}
                    title="Diminuir texto (A-)"
                    className={`flex items-center justify-center gap-1 rounded-lg border py-2 font-semibold transition ${
                      fontSize === "normal"
                        ? "border-border bg-muted/40 text-muted-foreground"
                        : "border-[#1D63DC] bg-[#1D63DC]/10 text-[#1D63DC]"
                    }`}
                  >
                    <ZoomOut className="h-3.5 w-3.5" /> A-
                  </button>
                  <button
                    type="button"
                    onClick={resetFontSize}
                    title="Texto padrão (A)"
                    className={`flex items-center justify-center gap-1 rounded-lg border py-2 font-semibold transition ${
                      fontSize === "normal"
                        ? "border-[#1D63DC] bg-[#1D63DC] text-white"
                        : "border-border bg-card text-foreground hover:bg-muted/30"
                    }`}
                  >
                    Padrão
                  </button>
                  <button
                    type="button"
                    onClick={increaseFontSize}
                    title="Aumentar texto (A+)"
                    className={`flex items-center justify-center gap-1 rounded-lg border py-2 font-semibold transition ${
                      fontSize === "large" || fontSize === "larger"
                        ? "border-[#1D63DC] bg-[#1D63DC] text-white"
                        : "border-border bg-card text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <ZoomIn className="h-3.5 w-3.5" /> A+
                  </button>
                </div>
              </div>

              {/* Alto Contraste */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-2.5">
                <div>
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Contrast className="h-3.5 w-3.5 text-[#1D63DC]" /> Alto Contraste
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Modo escuro de máxima visibilidade
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleHighContrast}
                  aria-pressed={highContrast}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    highContrast ? "bg-[#1D63DC]" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      highContrast ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Restaurar Padrões */}
              <button
                type="button"
                onClick={() => {
                  resetAccessibility();
                  toast.success("Preferências de acessibilidade restauradas.");
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Redefinir preferências
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
