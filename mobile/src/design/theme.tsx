import { createContext, useContext, type ReactNode } from "react";
import { rolePalette, type InterfaceRole } from "./theme-tokens";

const ThemeContext = createContext(rolePalette("customer"));

export function InterfaceTheme({ role, children }: { role: InterfaceRole; children: ReactNode }) {
  return <ThemeContext.Provider value={rolePalette(role)}>{children}</ThemeContext.Provider>;
}

export const usePalette = () => useContext(ThemeContext);
