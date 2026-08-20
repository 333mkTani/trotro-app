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
      primary: "#C27A58",
      primaryDark: "#9A4D2B",
      primaryLight: "#D29A7D",
      primaryFaded: "#3A2922",
      secondary: "#6F9A91",
      secondaryLight: "#243633",
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
      success: "#78A98A",
      successLight: "#243A2D",
      warning: "#C49A62",
      warningLight: "#3A3023",
      danger: "#C47A7A",
      dangerLight: "#3A2626",
      info: "#8DA6B1",
      infoLight: "#263238",
      text: "#F4F4F5",
      textMuted: "#A0A0A4",
      border: "#2E2E30",
    };
  }
  return {
    primary: "#9A4D2B",
    primaryDark: "#7D3F25",
    primaryLight: "#C27A58",
    primaryFaded: "#F4E9E3",
    secondary: "#3F6B63",
    secondaryLight: "#E5EEEC",
    white: "#FFFFFF",
    black: "#000000",
    screenBg: "#F7F6F3",
    cardBg: "#FFFFFF",
    gray50: "#FBFAF8",
    gray100: "#F0EFEC",

    gray200: "#E1DFDA",
    gray300: "#CBC8C2",
    gray400: "#96928B",
    gray500: "#6E6A63",
    gray600: "#514E49",
    gray700: "#3B3935",
    gray800: "#252422",
    success: "#3F7A5A",
    successLight: "#E4F0E8",
    warning: "#A66A24",
    warningLight: "#F5EBDD",
    danger: "#B54B4B",
    dangerLight: "#F5E3E3",
    info: "#536D7A",
    infoLight: "#E7EDF0",
    text: "#252422",
    textMuted: "#6E6A63",
    border: "#E1DFDA",
  };
}
