import { Tabs } from "expo-router";
import { Home, Calendar, BookOpen, Settings, Wallet } from "lucide-react-native";
import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import ArrivalNotificationBanner from "@/components/ArrivalNotificationBanner";
const Colors = StaticColors;

export default function TabLayout() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const insets = useSafeAreaInsets();

  return (
    <View style={st.root}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.gray100,
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600" as const,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "My Rides",
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
    <View style={[st.bannerWrap, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <ArrivalNotificationBanner />
    </View>
    </View>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1 },
  bannerWrap: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
