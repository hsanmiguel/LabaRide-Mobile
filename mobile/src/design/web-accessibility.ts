import { useEffect } from "react";
import { Platform } from "react-native";

export function useWebAccessibility(primary: string) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const style = document.createElement("style");
    style.textContent = `
      :root { color-scheme: light; accent-color: ${primary}; }
      :focus-visible { outline: 3px solid ${primary} !important; outline-offset: 3px; }
      input, textarea, select { font: inherit; }
      a { color: inherit; text-decoration: none; }
      [role="button"], [role="tab"], a { touch-action: manipulation; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [primary]);
}
