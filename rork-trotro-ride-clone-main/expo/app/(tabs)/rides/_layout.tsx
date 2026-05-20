import { Stack } from "expo-router";
import React, { memo } from "react";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
const Colors = StaticColors;

export default function RidesLayout() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.screenBg },
        headerTitleStyle: { color: Colors.gray800, fontWeight: "700" as const, fontSize: 18 },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.screenBg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "My Rides" }} />
    </Stack>
  );
}
