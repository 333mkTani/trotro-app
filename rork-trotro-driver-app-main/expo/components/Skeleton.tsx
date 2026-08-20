import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Colors from "@/constants/colors";

type SkeletonProps = { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> };

export function Skeleton({ width = "100%", height = 16, radius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View accessible accessibilityLabel="Loading" style={[{ width, height, borderRadius: radius, backgroundColor: Colors.borderLight, opacity }, style]} />;
}

export function SkeletonText({ width = "70%", height = 14, style }: Omit<SkeletonProps, "radius">) {
  return <Skeleton width={width} height={height} radius={5} style={style} />;
}

export function DriverDashboardSkeleton() {
  return <View style={styles.page} accessibilityLabel="Loading dashboard">
    <Skeleton width="42%" height={28} radius={7} />
    <Skeleton width="100%" height={96} radius={16} />
    <View style={styles.row}><Skeleton width="47%" height={76} radius={14} /><Skeleton width="47%" height={76} radius={14} /></View>
    <Skeleton width="35%" height={18} radius={5} />
    {[1, 2, 3].map((item) => <View key={item} style={styles.listRow}><View style={styles.copy}><SkeletonText width="62%" /><SkeletonText width="42%" height={12} /></View><Skeleton width={64} height={28} radius={8} /> </View>)}
  </View>;
}

export function DriverListSkeleton() {
  return <View style={styles.page} accessibilityLabel="Loading list">
    <Skeleton width="44%" height={26} radius={7} />
    <Skeleton width="100%" height={54} radius={12} />
    {[1, 2, 3, 4].map((item) => <View key={item} style={styles.card}><Skeleton width={42} height={42} radius={21} /><View style={styles.copy}><SkeletonText width="68%" /><SkeletonText width="48%" height={12} /></View><Skeleton width={54} height={20} radius={6} /></View>)}
  </View>;
}

const styles = StyleSheet.create({ page: { flex: 1, padding: 20, gap: 14 }, row: { flexDirection: "row", justifyContent: "space-between" }, listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: "#FFFFFF" }, copy: { flex: 1, gap: 8 } });
