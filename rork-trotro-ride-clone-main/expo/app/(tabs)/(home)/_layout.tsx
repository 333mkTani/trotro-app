import { Stack } from "expo-router";
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
const Colors = StaticColors;

const TrotroHeader = React.memo(function TrotroHeader() {
  return (
    <View style={hdr.row}>
      <View style={hdr.dot} />
      <Text style={hdr.title}>Trotro</Text>
    </View>
  );
});



const make_hdr = (Colors: ThemePalette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  title: { fontSize: 20, fontWeight: "800" as const, color: Colors.gray800, letterSpacing: -0.5 },
});

export default function HomeLayout() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  hdr = React.useMemo(() => make_hdr(themeColors), [themeColors]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.screenBg },
        headerTintColor: Colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.screenBg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

let hdr: ReturnType<typeof make_hdr> = make_hdr(StaticColors as unknown as ThemePalette);
