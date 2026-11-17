export type FontSize = "normal" | "large" | "larger";

export interface AccessibilityState {
  fontSize: FontSize;
  highContrast: boolean;
}

const STORAGE_KEY_FONT = "nexo:font-size";
const STORAGE_KEY_CONTRAST = "nexo:high-contrast";
const EVENT_NAME = "nexo:accessibility-change";

export function getStoredAccessibilityState(): AccessibilityState {
  if (typeof window === "undefined") {
    return { fontSize: "normal", highContrast: false };
  }
  try {
    const rawFont = window.localStorage.getItem(STORAGE_KEY_FONT);
    const fontSize: FontSize =
      rawFont === "large" || rawFont === "larger" ? rawFont : "normal";
    const highContrast = window.localStorage.getItem(STORAGE_KEY_CONTRAST) === "true";
    return { fontSize, highContrast };
  } catch {
    return { fontSize: "normal", highContrast: false };
  }
}

export function applyAccessibility(state: AccessibilityState): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Aplica o tamanho da fonte proporcional
  if (state.fontSize === "large") {
    root.style.fontSize = "115%";
  } else if (state.fontSize === "larger") {
    root.style.fontSize = "130%";
  } else {
    root.style.fontSize = "";
  }

  // Aplica a classe e atributo de alto contraste
  if (state.highContrast) {
    root.classList.add("high-contrast");
    root.setAttribute("data-high-contrast", "true");
  } else {
    root.classList.remove("high-contrast");
    root.removeAttribute("data-high-contrast");
  }

  // Salva no localStorage
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY_FONT, state.fontSize);
      window.localStorage.setItem(STORAGE_KEY_CONTRAST, String(state.highContrast));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }));
    } catch {
      // Ignora erro de quota em navegadores restritos
    }
  }
}

export function setFontSize(size: FontSize): void {
  const current = getStoredAccessibilityState();
  applyAccessibility({ ...current, fontSize: size });
}

export function increaseFontSize(): void {
  const current = getStoredAccessibilityState();
  const next: FontSize =
    current.fontSize === "normal" ? "large" : "larger";
  applyAccessibility({ ...current, fontSize: next });
}

export function decreaseFontSize(): void {
  const current = getStoredAccessibilityState();
  const next: FontSize =
    current.fontSize === "larger" ? "large" : "normal";
  applyAccessibility({ ...current, fontSize: next });
}

export function resetFontSize(): void {
  const current = getStoredAccessibilityState();
  applyAccessibility({ ...current, fontSize: "normal" });
}

export function toggleHighContrast(): boolean {
  const current = getStoredAccessibilityState();
  const nextContrast = !current.highContrast;
  applyAccessibility({ ...current, highContrast: nextContrast });
  return nextContrast;
}

export function resetAccessibility(): void {
  applyAccessibility({ fontSize: "normal", highContrast: false });
}

export function initAccessibility(): void {
  if (typeof window === "undefined") return;
  const state = getStoredAccessibilityState();
  applyAccessibility(state);

  // Registra atalhos de teclado amigáveis (Alt + 1 / Alt + 2 / Alt + 3 / Alt + 0)
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === "1") {
        const target = document.getElementById("main-content") || document.querySelector("main");
        if (target) {
          e.preventDefault();
          target.setAttribute("tabindex", "-1");
          target.focus();
        }
      } else if (e.key === "2") {
        e.preventDefault();
        toggleHighContrast();
      } else if (e.key === "3") {
        e.preventDefault();
        increaseFontSize();
      } else if (e.key === "0") {
        e.preventDefault();
        resetAccessibility();
      }
    }
  });
}

export function subscribeAccessibility(callback: (state: AccessibilityState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const custom = e as CustomEvent<AccessibilityState>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getStoredAccessibilityState());
    }
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
