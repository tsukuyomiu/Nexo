import { beforeEach, describe, expect, it } from "vitest";
import {
  applyAccessibility,
  decreaseFontSize,
  getStoredAccessibilityState,
  increaseFontSize,
  resetAccessibility,
  resetFontSize,
  toggleHighContrast,
} from "../lib/accessibility";

describe("Acessibilidade Nexo", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.fontSize = "";
    document.documentElement.removeAttribute("data-high-contrast");
  });

  it("inicia com estado padrão (normal, sem alto contraste)", () => {
    const state = getStoredAccessibilityState();
    expect(state.fontSize).toBe("normal");
    expect(state.highContrast).toBe(false);
  });

  it("aumenta o tamanho da fonte progressivamente", () => {
    increaseFontSize();
    expect(getStoredAccessibilityState().fontSize).toBe("large");
    expect(document.documentElement.style.fontSize).toBe("115%");

    increaseFontSize();
    expect(getStoredAccessibilityState().fontSize).toBe("larger");
    expect(document.documentElement.style.fontSize).toBe("130%");
  });

  it("diminui o tamanho da fonte progressivamente", () => {
    increaseFontSize();
    increaseFontSize();
    expect(getStoredAccessibilityState().fontSize).toBe("larger");

    decreaseFontSize();
    expect(getStoredAccessibilityState().fontSize).toBe("large");
    expect(document.documentElement.style.fontSize).toBe("115%");

    decreaseFontSize();
    expect(getStoredAccessibilityState().fontSize).toBe("normal");
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("redefine a fonte para o tamanho padrão", () => {
    increaseFontSize();
    increaseFontSize();
    resetFontSize();
    expect(getStoredAccessibilityState().fontSize).toBe("normal");
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("alterna modo de alto contraste e aplica classes", () => {
    const contrastOn = toggleHighContrast();
    expect(contrastOn).toBe(true);
    expect(getStoredAccessibilityState().highContrast).toBe(true);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(true);
    expect(document.documentElement.getAttribute("data-high-contrast")).toBe("true");

    const contrastOff = toggleHighContrast();
    expect(contrastOff).toBe(false);
    expect(getStoredAccessibilityState().highContrast).toBe(false);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(false);
    expect(document.documentElement.hasAttribute("data-high-contrast")).toBe(false);
  });

  it("restaura todas as preferências de acessibilidade com resetAccessibility", () => {
    increaseFontSize();
    toggleHighContrast();
    expect(getStoredAccessibilityState().fontSize).toBe("large");
    expect(getStoredAccessibilityState().highContrast).toBe(true);

    resetAccessibility();
    expect(getStoredAccessibilityState().fontSize).toBe("normal");
    expect(getStoredAccessibilityState().highContrast).toBe(false);
    expect(document.documentElement.style.fontSize).toBe("");
    expect(document.documentElement.classList.contains("high-contrast")).toBe(false);
  });
});
