import { Stack } from "expo-router";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
const Colors = StaticColors;

export default function WalletLayout() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.screenBg },
        headerTintColor: Colors.gray800,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Wallet",
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
        }}
      />
    </Stack>
  );
}
