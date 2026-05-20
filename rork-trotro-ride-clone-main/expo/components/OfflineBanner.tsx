import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Animated } from "react-native";
import { WifiOff } from "lucide-react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
const Colors = StaticColors;

interface OfflineBannerProps {
  isOffline: boolean;
  lastUpdated?: string;
}

export default React.memo(function OfflineBanner({ isOffline, lastUpdated }: OfflineBannerProps) {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  styles = React.useMemo(() => make_styles(themeColors), [themeColors]);

  const translateY = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOffline ? 0 : -50,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <WifiOff size={14} color={Colors.white} />
      <Text style={styles.text}>You're offline</Text>
      {lastUpdated && (
        <Text style={styles.subtext}>Last updated {lastUpdated}</Text>
      )}
    </Animated.View>
  );
});



const make_styles = (Colors: ThemePalette) => StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gray700,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  subtext: {
    color: Colors.gray300,
    fontSize: 11,
  },
});

let styles: ReturnType<typeof make_styles> = make_styles(StaticColors as unknown as ThemePalette);
