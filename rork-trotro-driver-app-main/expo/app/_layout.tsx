import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/store/authStore";
import { useNotifications } from "@/hooks/useNotifications";
import { useDriverSocket } from "@/hooks/useDriverSocket";
import { useConnectivity } from "@/hooks/useConnectivity";
import { OfflineBanner } from "@/components/OfflineBanner";
import { stopGpsService } from "@/services/gpsService";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="otp-verification" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
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
        <Stack.Screen name="future-requests" options={{ title: "Future Requests" }} />
      </Stack.Protected>
    </Stack>
  );
}

function AppWithNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  useNotifications(isAuthenticated);
  useDriverSocket(isAuthenticated);
  const { isConnected, syncStatus } = useConnectivity();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) stopGpsService();
  }, [isAuthenticated, isAuthLoading]);

  if (isAuthLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F9F9" }}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner visible={!isConnected} syncStatus={syncStatus} />
      <RootLayoutNav isAuthenticated={isAuthenticated} />
    </View>
  );
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppWithNotifications />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
