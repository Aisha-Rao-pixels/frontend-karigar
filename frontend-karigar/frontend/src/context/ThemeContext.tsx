import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme } from "react-native";
import { COLORS, COLORS_DARK } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Mode = "light" | "dark" | "system";

interface ThemeCtx {
  mode: Mode;
  isDark: boolean;
  colors: typeof COLORS;
  setMode: (m: Mode) => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);
const STORAGE_KEY = "theme_mode";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<Mode>("light");

  useEffect(() => {
    storage.getItem(STORAGE_KEY, false).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
    }).catch(() => {});
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    storage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const colors = isDark ? COLORS_DARK : COLORS;

  return <Ctx.Provider value={{ mode, isDark, colors, setMode }}>{children}</Ctx.Provider>;
}

export function useAppTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppTheme must be used within AppThemeProvider");
  return c;
}
