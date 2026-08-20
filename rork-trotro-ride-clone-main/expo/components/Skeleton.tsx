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
  return <Animated.View accessible accessibilityLabel="Loading" style={[{ width, height, borderRadius: radius, backgroundColor: Colors.gray200, opacity }, style]} />;
}

export function SkeletonText({ width = "70%", height = 14, style }: Omit<SkeletonProps, "radius">) {
  return <Skeleton width={width} height={height} radius={5} style={style} />;
}

export function PassengerPageSkeleton() {
  return <View style={styles.page} accessibilityLabel="Loading page">
    <Skeleton width="48%" height={28} radius={7} />
    <Skeleton width="100%" height={112} radius={18} style={styles.block} />
    <View style={styles.row}><Skeleton width="47%" height={82} radius={14} /><Skeleton width="47%" height={82} radius={14} /></View>
    <Skeleton width="36%" height={18} radius={5} style={styles.heading} />
    {[1, 2, 3].map((item) => <View key={item} style={styles.listRow}><Skeleton width={48} height={48} radius={24} /><View style={styles.copy}><SkeletonText width="65%" /><SkeletonText width="42%" height={12} /></View></View>)}
  </View>;
}

const styles = StyleSheet.create({ page: { flex: 1, padding: 20, gap: 14 }, block: { marginTop: 4 }, row: { flexDirection: "row", justifyContent: "space-between" }, heading: { marginTop: 8 }, listRow: { flexDirection: "row", alignItems: "center", gap: 12 }, copy: { flex: 1, gap: 8 } });
