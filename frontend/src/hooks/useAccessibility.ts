import { useEffect, useState } from "react";
import {
  applyAccessibility,
  decreaseFontSize,
  getStoredAccessibilityState,
  increaseFontSize,
  resetAccessibility,
  resetFontSize,
  setFontSize,
  subscribeAccessibility,
  toggleHighContrast,
  type AccessibilityState,
  type FontSize,
} from "@/lib/accessibility";

export function useAccessibility() {
  const [state, setState] = useState<AccessibilityState>(() => getStoredAccessibilityState());

  useEffect(() => {
    // Sincroniza estado inicial e ouve alterações
    setState(getStoredAccessibilityState());
    const unsubscribe = subscribeAccessibility((nextState) => {
      setState(nextState);
    });
    return unsubscribe;
  }, []);

  return {
    fontSize: state.fontSize,
    highContrast: state.highContrast,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    setFontSize,
    toggleHighContrast,
    resetAccessibility,
  };
}
