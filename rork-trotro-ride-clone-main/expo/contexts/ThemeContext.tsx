import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme, Platform } from "react-native";

const THEME_STORAGE_KEY = "trotro_theme_mode";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState<boolean>(false);

  const stored = useQuery({
    queryKey: ["theme-mode"],
    queryFn: async (): Promise<ThemeMode> => {
      const v = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
      return "system";
    },
  });

  useEffect(() => {
    if (stored.data && !hydrated) {
      setMode(stored.data);
      setHydrated(true);
    } else if (!stored.isLoading && !hydrated) {
      setHydrated(true);
    }
  }, [stored.data, stored.isLoading, hydrated]);

  const resolved: ResolvedTheme = useMemo(() => {
    if (mode === "system") return (systemScheme === "dark" ? "dark" : "light");
    return mode;
  }, [mode, systemScheme]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      try {
        Appearance.setColorScheme(mode === "system" ? null : resolved);
      } catch (e) {
        console.log("[Theme] setColorScheme error", e);
      }
    }
  }, [mode, resolved]);

  const setThemeMode = useCallback(async (next: ThemeMode) => {
    console.log("[Theme] setThemeMode", next);
    setMode(next);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {
      console.log("[Theme] persist error", e);
    }
  }, []);

  const colors = useMemo(() => getPalette(resolved), [resolved]);

  return { mode, resolved, colors, setThemeMode, isDark: resolved === "dark" };
});

export interface ThemePalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryFaded: string;
  secondary: string;
  secondaryLight: string;
  white: string;
  black: string;
  screenBg: string;
  cardBg: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  text: string;
  textMuted: string;
  border: string;
}

export function getPalette(scheme: ResolvedTheme): ThemePalette {
  if (scheme === "dark") {
    return {
      primary: "#FF8A3D",
      primaryDark: "#E85D04",
      primaryLight: "#FFA866",
      primaryFaded: "#3A2414",
      secondary: "#4CAF50",
      secondaryLight: "#1B3A1E",
      white: "#1A1A1A",
      black: "#FFFFFF",
      screenBg: "#0F0F10",
      cardBg: "#1A1A1C",
      gray50: "#1C1C1E",
      gray100: "#232325",

      gray200: "#2E2E30",
      gray300: "#3A3A3D",
      gray400: "#8A8A8E",
      gray500: "#A0A0A4",
      gray600: "#C7C7CB",
      gray700: "#E4E4E7",
      gray800: "#F4F4F5",
      success: "#22C55E",
      successLight: "#1B3A1E",
      warning: "#F59E0B",
      warningLight: "#3A2A0A",
      danger: "#EF4444",
      dangerLight: "#3A1515",
      info: "#3B82F6",
      infoLight: "#0F2545",
      text: "#F4F4F5",
      textMuted: "#A0A0A4",
      border: "#2E2E30",
    };
  }
  return {
    primary: "#E85D04",
    primaryDark: "#C44D03",
    primaryLight: "#FF8A3D",
    primaryFaded: "#FFF0E6",
    secondary: "#2E7D32",
    secondaryLight: "#E8F5E9",
    white: "#FFFFFF",
    black: "#000000",
    screenBg: "#F8F7F4",
    cardBg: "#FFFFFF",
    gray50: "#FAFAFA",
    gray100: "#F3F3F3",

    gray200: "#E5E5E5",
    gray300: "#D4D4D4",
    gray400: "#A3A3A3",
    gray500: "#737373",
    gray600: "#525252",
    gray700: "#404040",
    gray800: "#262626",
    success: "#16A34A",
    successLight: "#DCFCE7",
    warning: "#D97706",
    warningLight: "#FEF3C7",
    danger: "#DC2626",
    dangerLight: "#FEE2E2",
    info: "#2563EB",
    infoLight: "#DBEAFE",
    text: "#262626",
    textMuted: "#737373",
    border: "#E5E5E5",
  };
}
