import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/store/authStore";
import { useNotifications } from "@/hooks/useNotifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="demand-map" options={{ title: "Demand Map", presentation: "modal" }} />
      <Stack.Screen name="pro-subscription" options={{ title: "Trotro Pro", presentation: "modal" }} />
      <Stack.Screen name="navigate" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="notification-settings" options={{ title: "Notifications", presentation: "modal" }} />
      <Stack.Screen name="withdraw" options={{ title: "Withdraw Funds", presentation: "modal" }} />
      <Stack.Screen name="fund-wallet" options={{ title: "Fund Wallet", presentation: "modal" }} />
      <Stack.Screen name="change-route" options={{ title: "Change Route", presentation: "modal" }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit Profile", presentation: "modal" }} />
      <Stack.Screen name="change-password" options={{ title: "Change Password", presentation: "modal" }} />
    </Stack>
  );
}

function AppWithNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useNotifications(isAuthenticated);
  return <RootLayoutNav />;
}

export default function RootLayout() {
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth().finally(() => {
      SplashScreen.hideAsync();
    });
  }, [loadStoredAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <AppWithNotifications />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
