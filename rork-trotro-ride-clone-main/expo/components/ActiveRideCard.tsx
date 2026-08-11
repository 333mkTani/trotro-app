import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bus, Clock, Navigation2, Radio } from 'lucide-react-native';
import { Booking, ApproachingBus, BusStop } from '@/types';
import { useTheme, type ThemePalette } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import {
  connectSocket,
  getSocket,
  subscribeToBus,
  unsubscribeFromBus,
  type BusLocationEvent,
} from '@/services/socket';
import { useDirections } from '@/hooks/useDirections';

type Props = {
  booking: Booking;
  bus?: ApproachingBus;
  targetStop?: BusStop;
};

const validCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && (lat !== 0 || lng !== 0);

export default function ActiveRideCard({ booking, bus, targetStop }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const initialPosition = validCoordinate(bus?.lat ?? 0, bus?.lng ?? 0)
    ? { latitude: bus!.lat, longitude: bus!.lng }
    : null;
  const [position, setPosition] = useState(initialPosition);
  const [socketLive, setSocketLive] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'waiting' | 'live' | 'stale' | 'offline'>(
    initialPosition ? 'live' : 'waiting',
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(initialPosition ? Date.now() : null);
  const initialDistanceRef = useRef<number | null>(null);
  const lastGpsFixAtRef = useRef(0);

  const destination = targetStop
    ? { latitude: targetStop.lat, longitude: targetStop.lng }
    : null;
  const directions = useDirections({
    origin: position,
    destination,
    profile: 'driving',
    movementThresholdMeters: 50,
    staleTimeMs: 30_000,
    enabled: Boolean(position && destination),
  });

  const distanceMeters = directions.data?.distanceMeters ?? null;
  if (distanceMeters != null && initialDistanceRef.current == null) initialDistanceRef.current = distanceMeters;
  const progress = distanceMeters != null && initialDistanceRef.current
    ? Math.max(0, Math.min(1, 1 - distanceMeters / initialDistanceRef.current))
    : 0;
  const etaMinutes = directions.data?.durationSeconds != null
    ? Math.max(1, Math.ceil(directions.data.durationSeconds / 60))
    : null;

  const applyPosition = useCallback((lat: number, lng: number) => {
    if (!validCoordinate(lat, lng)) return;
    lastGpsFixAtRef.current = Date.now();
    setPosition({ latitude: lat, longitude: lng });
    setGpsStatus('live');
    setLastUpdatedAt(lastGpsFixAtRef.current);
  }, []);

  const applyServerGpsStatus = useCallback((data: Record<string, unknown>) => {
    if (data.location_status === 'stale') setGpsStatus('stale');
    else if (data.location_status === 'offline') setGpsStatus('offline');
  }, []);

  useEffect(() => {
    if (!booking.driver_id) return;
    let disposed = false;
    let busId: string | null = null;

    const onLocation = (event: BusLocationEvent) => {
      if (event.busId === busId) applyPosition(event.lat, event.lng);
    };
    const onConnect = () => {
      setSocketLive(true);
      if (busId) subscribeToBus(busId);
    };
    const onDisconnect = () => setSocketLive(false);

    const connect = async () => {
      try {
        const { data } = await api.get(`/buses/driver/${booking.driver_id}/location`);
        if (disposed) return;
        busId = data?.bus_id ?? null;
        applyPosition(Number(data?.lat), Number(data?.lng));
        applyServerGpsStatus(data as Record<string, unknown>);
        if (!busId) return;
        const socket = await connectSocket();
        if (disposed) return;
        subscribeToBus(busId);
        socket.on('bus:location', onLocation);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        setSocketLive(socket.connected);
      } catch {
        setSocketLive(false);
        setGpsStatus((current) => current === 'live' ? 'stale' : 'offline');
      }
    };
    void connect();

    const poll = setInterval(async () => {
      if (!booking.driver_id || Date.now() - lastGpsFixAtRef.current < 20_000) return;
      try {
        const { data } = await api.get(`/buses/driver/${booking.driver_id}/location`);
        applyPosition(Number(data?.lat), Number(data?.lng));
        applyServerGpsStatus(data as Record<string, unknown>);
      } catch {
        setGpsStatus((current) => current === 'live' ? 'stale' : 'offline');
      }
    }, 10_000);

    return () => {
      disposed = true;
      clearInterval(poll);
      const socket = getSocket();
      socket?.off('bus:location', onLocation);
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      if (busId) unsubscribeFromBus(busId);
    };
  }, [applyPosition, applyServerGpsStatus, booking.driver_id]);

  const targetName = booking.boarded_at ? booking.destination_stop_name : booking.pickup_stop_name;
  const phaseLabel = booking.boarded_at ? 'Trip in progress' : 'Bus approaching pickup';
  const trackingAvailable = Boolean(position && targetStop && booking.driver_id);

  const openTracking = () => {
    if (!trackingAvailable || !position || !targetStop) return;
    router.push({
      pathname: '/tracking',
      params: {
        driverId: booking.driver_id!,
        driverName: booking.driver_name ?? bus?.driver_name ?? 'Driver',
        busReg: booking.bus_registration ?? bus?.bus_registration ?? '',
        routeName: booking.route_name ?? bus?.route_name ?? '',
        seats: String(bus?.seats_available ?? 0),
        eta: String(etaMinutes ?? bus?.eta_minutes ?? 0),
        lat: String(position.latitude),
        lng: String(position.longitude),
        stopLat: String(targetStop.lat),
        stopLng: String(targetStop.lng),
        stopName: targetName,
      },
    });
  };

  return (
    <View style={styles.card} testID="active-ride-card">
      <View style={styles.header}>
        <View style={styles.titleRow}><Bus size={18} color={colors.primary} /><Text style={styles.title}>{phaseLabel}</Text></View>
        <View style={[styles.liveBadge, gpsStatus !== 'live' && styles.pollingBadge]}>
          <Radio size={11} color={gpsStatus === 'live' ? colors.success : colors.warning} />
          <Text style={[styles.liveText, { color: gpsStatus === 'live' ? colors.success : colors.warning }]}>
            {gpsStatus === 'live' ? (socketLive ? 'LIVE' : 'LIVE · POLLING') : gpsStatus === 'stale' ? 'STALE GPS' : gpsStatus === 'offline' ? 'GPS OFFLINE' : 'WAITING FOR GPS'}
          </Text>
        </View>
      </View>

      <Text style={styles.route}>{booking.bus_registration ?? bus?.bus_registration ?? 'Assigned bus'} · {targetName}</Text>
      {position ? (
        <View style={styles.metrics}>
          <View><Text style={styles.metricLabel}>ETA</Text><Text style={styles.metricValue}>{etaMinutes ? `${etaMinutes} min` : 'Calculating…'}</Text></View>
          <View><Text style={styles.metricLabel}>DISTANCE</Text><Text style={styles.metricValue}>{distanceMeters == null ? 'Calculating…' : distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`}</Text></View>
        </View>
      ) : (
        <Text style={styles.waiting}>Waiting for the driver’s first GPS update…</Text>
      )}

      <View style={styles.track}><View style={[styles.trackFill, { width: `${Math.max(3, progress * 100)}%` }]} /></View>
      <View style={styles.footer}>
        <View style={styles.updated}><Clock size={12} color={colors.textMuted} /><Text style={styles.updatedText}>{gpsStatus === 'stale' ? 'Last location is stale' : gpsStatus === 'offline' ? 'Driver location unavailable' : lastUpdatedAt ? 'Location received' : 'Waiting for driver GPS'}</Text></View>
        <TouchableOpacity style={[styles.button, !trackingAvailable && styles.buttonDisabled]} disabled={!trackingAvailable} onPress={openTracking}>
          <Navigation2 size={14} color={colors.white} /><Text style={styles.buttonText}>Track live</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemePalette) => StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primaryFaded },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { color: colors.gray800, fontSize: 16, fontWeight: '800' },
  liveBadge: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.successLight },
  pollingBadge: { backgroundColor: colors.warningLight },
  liveText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  route: { color: colors.gray500, fontSize: 13, marginTop: 8 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  metricLabel: { color: colors.gray400, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { color: colors.gray800, fontSize: 20, fontWeight: '900', marginTop: 2 },
  waiting: { color: colors.warning, fontSize: 13, fontWeight: '600', marginTop: 16 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.gray100, overflow: 'hidden', marginTop: 14 },
  trackFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 },
  updated: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  updatedText: { color: colors.textMuted, fontSize: 11 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
