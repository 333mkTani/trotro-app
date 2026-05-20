import React, { useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
const Colors = StaticColors;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface DraggableBottomSheetProps {
  children: React.ReactNode;
  snapPoints: number[];
  initialSnap?: number;
  onSnap?: (index: number) => void;
}

export default React.memo(function DraggableBottomSheet({
  children,
  snapPoints,
  initialSnap = 1,
  onSnap,
}: DraggableBottomSheetProps) {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  styles = React.useMemo(() => make_styles(themeColors), [themeColors]);

  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;
  const tabBarHeight = 60 + bottomInset;

  const sheetPositions = snapPoints.map(
    (pct) => SCREEN_HEIGHT * (1 - pct) - tabBarHeight
  );

  const translateY = useRef(
    new Animated.Value(sheetPositions[initialSnap] ?? sheetPositions[1])
  ).current;
  const lastSnap = useRef(sheetPositions[initialSnap] ?? sheetPositions[1]);

  useEffect(() => {
    translateY.setValue(sheetPositions[initialSnap] ?? sheetPositions[1]);
    lastSnap.current = sheetPositions[initialSnap] ?? sheetPositions[1];
  }, []);

  const clamp = useCallback(
    (val: number) => {
      const minY = Math.min(...sheetPositions);
      const maxY = Math.max(...sheetPositions);
      return Math.max(minY, Math.min(maxY, val));
    },
    [sheetPositions]
  );

  const snapTo = useCallback(
    (toValue: number, velocity?: number) => {
      lastSnap.current = toValue;
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
        velocity: velocity ?? 0,
      }).start();

      if (onSnap) {
        const idx = sheetPositions.indexOf(toValue);
        if (idx !== -1) onSnap(idx);
      }
    },
    [translateY, sheetPositions, onSnap]
  );

  const findClosestSnap = useCallback(
    (currentY: number, vy: number) => {
      const velocityThreshold = 0.5;
      if (Math.abs(vy) > velocityThreshold) {
        const sorted = [...sheetPositions].sort((a, b) => a - b);
        const currentIdx = sorted.indexOf(
          sorted.reduce((prev, curr) =>
            Math.abs(curr - lastSnap.current) < Math.abs(prev - lastSnap.current)
              ? curr
              : prev
          )
        );
        if (vy < 0 && currentIdx > 0) return sorted[currentIdx - 1];
        if (vy > 0 && currentIdx < sorted.length - 1)
          return sorted[currentIdx + 1];
      }
      return sheetPositions.reduce((prev, curr) =>
        Math.abs(curr - currentY) < Math.abs(prev - currentY) ? curr : prev
      );
    },
    [sheetPositions]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onPanResponderGrant: () => {
        translateY.stopAnimation((val) => {
          translateY.setOffset(val);
          translateY.setValue(0);
        });
      },
      onPanResponderMove: (_, gs) => {
        const newVal = clamp(lastSnap.current + gs.dy);
        translateY.setOffset(0);
        translateY.setValue(newVal);
      },
      onPanResponderRelease: (_, gs) => {
        translateY.flattenOffset();
        const currentPos = clamp(lastSnap.current + gs.dy);
        const target = findClosestSnap(currentPos, gs.vy);
        snapTo(target, gs.vy);
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          height: SCREEN_HEIGHT,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
});



const make_styles = (Colors: ThemePalette) => StyleSheet.create({
  container: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    backgroundColor: Colors.screenBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
    ...(Platform.OS === "web" ? { cursor: "grab" as const } : {}),
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.gray300,
  },
  content: {
    flex: 1,
  },
});

let styles: ReturnType<typeof make_styles> = make_styles(StaticColors as unknown as ThemePalette);
