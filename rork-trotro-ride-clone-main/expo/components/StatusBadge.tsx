import React from "react";
import { StyleSheet, Text, View } from "react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { BookingStatus } from "@/types";
const Colors = StaticColors;

const STATUS_CONFIG: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: Colors.warningLight, text: Colors.warning, label: "Pending" },
  confirmed: { bg: Colors.infoLight, text: Colors.info, label: "Confirmed" },
  completed: { bg: Colors.successLight, text: Colors.success, label: "Completed" },
  cancelled: { bg: Colors.dangerLight, text: Colors.danger, label: "Cancelled" },
  expired: { bg: Colors.gray100, text: Colors.gray500, label: "Expired" },
};

export default React.memo(function StatusBadge({ status }: { status: BookingStatus }) {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  styles = React.useMemo(() => make_styles(themeColors), [themeColors]);

  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
});



const make_styles = (Colors: ThemePalette) => StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

let styles: ReturnType<typeof make_styles> = make_styles(StaticColors as unknown as ThemePalette);
