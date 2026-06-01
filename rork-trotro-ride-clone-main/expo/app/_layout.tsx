import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View, StyleSheet, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BusAlertProvider } from "@/contexts/BusAlertContext";
import { BookingProvider } from "@/contexts/BookingContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { initPassengerNotifications, registerPushToken, addNotificationListeners } from "@/services/notificationService";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const notifInitialized = useRef(false);

  const headerOpts = {
    headerStyle: { backgroundColor: colors.screenBg },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text },
    headerShadowVisible: false,
  } as const;

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "login" || segments[0] === "register";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, segments]);

  // Set up push notifications once authenticated
  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web' || notifInitialized.current) return;
    notifInitialized.current = true;

    let cleanup: (() => void) | undefined;

    (async () => {
      const token = await initPassengerNotifications();
      if (token) await registerPushToken(token);

      cleanup = addNotificationListeners(
        (_data) => {
          // Notification received while app is open — no special handling needed
        },
        (data) => {
          // User tapped a notification
          if (data?.type === 'bus_approaching' && data?.bookingId) {
            router.push("/ride-notification");
          }
        },
      );
    })();

    return () => cleanup?.();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={[loadStyles.container, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back", contentStyle: { backgroundColor: colors.screenBg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="book-bus" options={{ title: "Book a Seat", ...headerOpts }} />
      <Stack.Screen name="tracking" options={{ title: "Live Tracking", ...headerOpts }} />
      <Stack.Screen name="find-route" options={{ title: "Find Route", ...headerOpts }} />
      <Stack.Screen name="set-bus-alert" options={{ title: "Set Bus Alert", ...headerOpts }} />
      <Stack.Screen name="ride-notification" options={{ title: "Notifications", ...headerOpts }} />
      <Stack.Screen name="verification" options={{ title: "Verification Code", ...headerOpts }} />
      <Stack.Screen name="alert-buses" options={{ title: "Alert Buses", ...headerOpts }} />
      <Stack.Screen name="my-alerts" options={{ title: "My Alerts", ...headerOpts }} />
      <Stack.Screen name="navigate-to-pickup" options={{ title: "Navigate to Stop", ...headerOpts }} />
      <Stack.Screen name="pick-destination-map" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="wallet-topup" options={{ title: "Top Up Wallet", ...headerOpts }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit Profile", ...headerOpts }} />
      <Stack.Screen name="change-password" options={{ title: "Change Password", ...headerOpts }} />
      <Stack.Screen name="pay-driver" options={{ title: "Pay Driver", ...headerOpts }} />
      <Stack.Screen name="rate-driver" options={{ title: "Rate Your Ride", ...headerOpts }} />
    </Stack>
  );
}

const loadStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.screenBg },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AuthProvider>
            <LocationProvider>
              <BusAlertProvider>
                <BookingProvider>
                  <WalletProvider>
                    <RootLayoutNav />
                  </WalletProvider>
                </BookingProvider>
              </BusAlertProvider>
            </LocationProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
