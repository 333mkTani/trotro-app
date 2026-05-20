import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { MapPin, Bus, Users, ChevronRight, AlertTriangle, Ticket } from "lucide-react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { BusStop, ApproachingBus } from "@/types";
import { ACCRA_ROUTES } from "@/mocks/routes";
const Colors = StaticColors;

interface StopCardProps {
  stop: BusStop;
  buses: ApproachingBus[];
  onPress: () => void;
  onBusPress: (bus: ApproachingBus, stop: BusStop) => void;
  onBookBus?: (bus: ApproachingBus, stop: BusStop) => void;
}

export default React.memo(function StopCard({
  stop,
  buses,
  onPress,
  onBusPress,
  onBookBus,
}: StopCardProps) {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  styles = React.useMemo(() => make_styles(themeColors), [themeColors]);

  const activeBuses = buses.filter((b) => b.seats_available > 0);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`stop-card-${stop.id}`}
    >
      <View style={styles.header}>
        <View style={styles.stopInfo}>
          <View
            style={[
              styles.iconBg,
              stop.type === "station" ? styles.stationBg : styles.stopBg,
            ]}
          >
            <MapPin
              size={16}
              color={stop.type === "station" ? Colors.primary : Colors.secondary}
            />
          </View>
          <View style={styles.stopText}>
            <Text style={styles.stopName}>{stop.name}</Text>
            <Text style={styles.stopType}>
              {stop.type === "station" ? "Station" : "Bus Stop"}
              {stop.distance_m
                ? ` · ${stop.distance_m < 1000 ? `${stop.distance_m}m` : `${(stop.distance_m / 1000).toFixed(1)}km`}`
                : ""}
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={Colors.gray400} />
      </View>

      {activeBuses.length > 0 ? (
        <View style={styles.busesContainer}>
          {activeBuses.slice(0, 3).map((bus) => {
            const fare = ACCRA_ROUTES.find((r) => r.name === bus.route_name)?.fare ?? 0;
            return (
              <View key={bus.driver_id} style={styles.busRow}>
                <TouchableOpacity
                  style={styles.busLeft}
                  onPress={() => onBusPress(bus, stop)}
                  activeOpacity={0.6}
                >
                  <Bus size={14} color={Colors.primary} />
                  <View style={styles.busInfo}>
                    <Text style={styles.busRoute} numberOfLines={1}>{bus.route_name}</Text>
                    <View style={styles.busMetaRow}>
                      <Text style={styles.busReg} numberOfLines={1}>{bus.bus_registration}</Text>
                      <Text style={styles.busFareInline} numberOfLines={1}>· GH₵ {fare.toFixed(2)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.busRight}>
                  <View style={styles.pillsCol}>
                    <View style={styles.etaBadge}>
                      <Text style={styles.etaText} numberOfLines={1}>{bus.eta_minutes} min</Text>
                    </View>
                    <View style={styles.seatsBadge}>
                      <Users size={10} color={Colors.success} />
                      <Text style={styles.seatsText} numberOfLines={1}>{bus.seats_available}</Text>
                    </View>
                  </View>
                  {onBookBus && (
                    <TouchableOpacity
                      style={styles.bookBtn}
                      onPress={() => onBookBus(bus, stop)}
                      activeOpacity={0.7}
                      testID={`book-bus-${bus.driver_id}`}
                    >
                      <Ticket size={12} color={Colors.white} />
                      <Text style={styles.bookBtnText}>Book</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
          <Text style={styles.etaDisclaimer}>
            Estimated arrival based on traffic conditions
          </Text>
          <View style={styles.noWaitRow}>
            <AlertTriangle size={10} color={Colors.warning} />
            <Text style={styles.noWaitTxt}>Buses will not wait at the stop upon arrival</Text>
          </View>
        </View>
      ) : (
        <View style={styles.noBuses}>
          <Text style={styles.noBusesText}>No approaching buses</Text>
        </View>
      )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    paddingBottom: 10,
  },
  stopInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stationBg: {
    backgroundColor: Colors.primaryFaded,
  },
  stopBg: {
    backgroundColor: "#E8F5E9",
  },
  stopText: {
    marginLeft: 10,
    flex: 1,
  },
  stopName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  stopType: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 1,
  },
  busesContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  busRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    gap: 8,
  },
  busLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  busInfo: {
    marginLeft: 8,
    flex: 1,
    minWidth: 0,
  },
  busMetaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    marginTop: 1,
    flexWrap: "wrap" as const,
  },
  busFareInline: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.success,
  },
  pillsCol: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    flexWrap: "wrap" as const,
    justifyContent: "flex-end" as const,
  },
  busRoute: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.gray700,
  },
  busReg: {
    fontSize: 11,
    color: Colors.gray400,
    marginTop: 1,
  },
  busRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  etaBadge: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  etaText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  seatsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  seatsText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bookBtnText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  etaDisclaimer: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    marginTop: 6,
    textAlign: "center" as const,
  },
  noWaitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 4,
  },
  noWaitTxt: {
    fontSize: 10,
    color: Colors.warning,
    fontWeight: "500" as const,
  },
  noBuses: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  noBusesText: {
    fontSize: 12,
    color: Colors.gray400,
    fontStyle: "italic" as const,
  },

});

let styles: ReturnType<typeof make_styles> = make_styles(StaticColors as unknown as ThemePalette);
