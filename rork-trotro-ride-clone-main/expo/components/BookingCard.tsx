import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { MapPin, Clock, Bus, ArrowRight, AlertTriangle, Navigation2, LogOut, Banknote } from "lucide-react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { Booking } from "@/types";
import StatusBadge from "./StatusBadge";
const Colors = StaticColors;

interface BookingCardProps {
  booking: Booking;
  onPress: () => void;
  onCancel?: () => void;
  onNavigate?: () => void;
  onEndRide?: () => void;
  endingRide?: boolean;
}

export default React.memo(function BookingCard({ booking, onPress, onCancel, onNavigate, onEndRide, endingRide }: BookingCardProps) {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  styles = React.useMemo(() => make_styles(themeColors), [themeColors]);

  const arrivalDate = new Date(booking.desired_arrival_time);
  const timeStr = arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = arrivalDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const canCancel = booking.status === "pending" || booking.status === "confirmed";
  const isWithin30Min = arrivalDate.getTime() - Date.now() < 30 * 60 * 1000;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7} testID={`booking-${booking.id}`}>
      <View style={styles.top}>
        <View style={styles.routeRow}>
          <View style={styles.routePill}>
            <Bus size={12} color={Colors.primary} />
            <Text style={styles.routeText}>{booking.route_name ?? "Trotro"}</Text>
          </View>
          <StatusBadge status={booking.status} />
        </View>

        <View style={styles.stopsRow}>
          <View style={styles.stopCol}>
            <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.stopLabel}>Pickup</Text>
            <Text style={styles.stopName} numberOfLines={1}>{booking.pickup_stop_name}</Text>
          </View>
          <ArrowRight size={16} color={Colors.gray300} style={styles.arrow} />
          <View style={[styles.stopCol, { alignItems: "flex-end" }]}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <Text style={styles.stopLabel}>Destination</Text>
            <Text style={styles.stopName} numberOfLines={1}>{booking.destination_stop_name}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Clock size={12} color={Colors.gray500} />
            <Text style={styles.detailText} numberOfLines={1}>{dateStr} · {timeStr}</Text>
          </View>
          <View style={styles.detailItem}>
            <MapPin size={12} color={Colors.gray500} />
            <Text style={styles.detailText} numberOfLines={1}>{booking.buffer_minutes}m buffer</Text>
          </View>
          {booking.ride_fare != null && (
            <View style={styles.fareBadge}>
              <Banknote size={12} color={Colors.success} />
              <Text style={styles.fareText} numberOfLines={1}>GH₵{booking.ride_fare.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {booking.driver_name && (
          <View style={styles.driverRow}>
            <Text style={styles.driverLabel}>Driver:</Text>
            <Text style={styles.driverName} numberOfLines={1}>{booking.driver_name}</Text>
            {booking.bus_registration && (
              <Text style={styles.busReg} numberOfLines={1}> · {booking.bus_registration}</Text>
            )}
          </View>
        )}

        {(booking.status === "pending" || booking.status === "confirmed") && (
          <View style={styles.noWaitRow}>
            <AlertTriangle size={11} color={Colors.warning} />
            <Text style={styles.noWaitTxt}>Bus will not wait at the stop upon arrival</Text>
          </View>
        )}
      </View>

      <View style={styles.actionsRow}>
        {booking.status === "confirmed" && onNavigate && (
          <TouchableOpacity
            style={styles.navigateBtn}
            onPress={onNavigate}
            activeOpacity={0.7}
            testID={`navigate-${booking.id}`}
          >
            <Navigation2 size={14} color={Colors.white} />
            <Text style={styles.navigateText}>Navigate to Stop</Text>
          </TouchableOpacity>
        )}
        {booking.status === "confirmed" && onEndRide && (
          <TouchableOpacity
            style={[styles.endRideBtn, endingRide && styles.endRideBtnDisabled]}
            onPress={endingRide ? undefined : onEndRide}
            activeOpacity={endingRide ? 1 : 0.7}
            testID={`end-ride-${booking.id}`}
          >
            <LogOut size={14} color={endingRide ? Colors.gray400 : Colors.success} />
            <Text style={[styles.endRideText, endingRide && styles.endRideTextDisabled]}>
              {endingRide ? "Ending..." : "End Ride"}
            </Text>
          </TouchableOpacity>
        )}
        {canCancel && onCancel && (
          <TouchableOpacity
            style={[styles.cancelBtn, isWithin30Min && styles.cancelBtnDisabled]}
            onPress={isWithin30Min ? undefined : onCancel}
            activeOpacity={isWithin30Min ? 1 : 0.6}
          >
            <Text style={[styles.cancelText, isWithin30Min && styles.cancelTextDisabled]}>
              {isWithin30Min ? "Can't cancel < 30 min" : "Cancel Ride"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});



const make_styles = (Colors: ThemePalette) => StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  top: {
    padding: 14,
  },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  routeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  stopsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stopCol: {
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  stopLabel: {
    fontSize: 10,
    color: Colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stopName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.gray800,
  },
  arrow: {
    marginHorizontal: 8,
    marginTop: 12,
  },
  detailsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  detailText: {
    fontSize: 12,
    color: Colors.gray500,
    flexShrink: 1,
  },
  fareBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fareText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.success,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    flexWrap: "wrap" as const,
  },
  driverLabel: {
    fontSize: 12,
    color: Colors.gray500,
  },
  driverName: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.gray700,
    marginLeft: 4,
    flexShrink: 1,
  },
  busReg: {
    fontSize: 12,
    color: Colors.gray400,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    flexWrap: "wrap" as const,
  },
  navigateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    backgroundColor: Colors.primary,
  },
  navigateText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
  },
  noWaitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  noWaitTxt: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: "500" as const,
  },
  endRideBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 11,
    backgroundColor: Colors.successLight,
  },
  endRideBtnDisabled: {
    backgroundColor: Colors.gray100,
  },
  endRideText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  endRideTextDisabled: {
    color: Colors.gray400,
  },
  cancelBtnDisabled: {
    backgroundColor: Colors.gray50,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.danger,
  },
  cancelTextDisabled: {
    color: Colors.gray400,
  },
});

let styles: ReturnType<typeof make_styles> = make_styles(StaticColors as unknown as ThemePalette);
