import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, RefreshControl, ActivityIndicator, Platform, Modal, ScrollView, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Inbox, ChevronUp, ChevronDown, Zap } from 'lucide-react-native';
import { Route, CircleStop, Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDriverStore } from '@/store/driverStore';
import { useBookingStore } from '@/store/bookingStore';
import { getBookings, acceptBooking, declineBooking, updateSchedulingHours } from '@/services/driverApi';
import { BookingCard } from '@/components/BookingCard';
import { Booking } from '@/types';
import { formatScheduleTime } from '@/utils/helpers';

type DateFilter = 'today' | 'tomorrow' | 'week';
type PickerTarget = 'start' | 'end';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseHM(time: string): { h: number; m: number } {
  const [hStr, mStr] = time.split(':');
  return { h: parseInt(hStr, 10) || 0, m: parseInt(mStr, 10) || 0 };
}

function TimePicker({ hour, minute, onHourChange, onMinute }: {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinute: (m: number) => void;
}) {
  const scrollH = (dir: 1 | -1) => {
    const next = (hour + dir + 24) % 24;
    onHourChange(next);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };
  const scrollM = (dir: 1 | -1) => {
    const idx = MINUTES.indexOf(minute);
    const next = (idx + dir + MINUTES.length) % MINUTES.length;
    onMinute(MINUTES[next]);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display12 = hour % 12 || 12;

  return (
    <View style={pk.row}>
      <View style={pk.col}>
        <Pressable onPress={() => scrollH(1)} style={pk.arrow} testID="hour-up"><ChevronUp size={22} color={Colors.primary} /></Pressable>
        <View style={pk.valBox}><Text style={pk.val}>{padTwo(display12)}</Text></View>
        <Pressable onPress={() => scrollH(-1)} style={pk.arrow} testID="hour-down"><ChevronDown size={22} color={Colors.primary} /></Pressable>
        <Text style={pk.label}>Hour</Text>
      </View>
      <Text style={pk.sep}>:</Text>
      <View style={pk.col}>
        <Pressable onPress={() => scrollM(1)} style={pk.arrow} testID="min-up"><ChevronUp size={22} color={Colors.primary} /></Pressable>
        <View style={pk.valBox}><Text style={pk.val}>{padTwo(minute)}</Text></View>
        <Pressable onPress={() => scrollM(-1)} style={pk.arrow} testID="min-down"><ChevronDown size={22} color={Colors.primary} /></Pressable>
        <Text style={pk.label}>Min</Text>
      </View>
      <View style={pk.col}>
        <Pressable onPress={() => { onHourChange(hour >= 12 ? hour - 12 : hour + 12); if (Platform.OS !== 'web') Haptics.selectionAsync(); }} style={pk.arrow} testID="ampm-toggle"><ChevronUp size={22} color={Colors.primary} /></Pressable>
        <View style={pk.valBox}><Text style={pk.val}>{ampm}</Text></View>
        <Pressable onPress={() => { onHourChange(hour >= 12 ? hour - 12 : hour + 12); if (Platform.OS !== 'web') Haptics.selectionAsync(); }} style={pk.arrow}><ChevronDown size={22} color={Colors.primary} /></Pressable>
        <Text style={pk.label}>AM/PM</Text>
      </View>
    </View>
  );
}

export default function TrotroScheduleManager() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<DateFilter>('today');
  const isOnline = useDriverStore((s) => s.isOnline);
  const drivingStatus = useDriverStore((s) => s.drivingStatus);
  const isStationary = drivingStatus === 'STATIONARY';
  const sched = useDriverStore((s) => s.schedulingHours);
  const setDashboard = useDriverStore((s) => s.setDashboardData);
  const setBookings = useBookingStore((s) => s.setBookings);
  const updateStat = useBookingStore((s) => s.updateBookingStatus);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>('start');
  const [tempHour, setTempHour] = useState(3);
  const [tempMinute, setTempMinute] = useState(0);

  const [localStart, setLocalStart] = useState<string>(sched?.start_time ?? '03:00');
  const [localEnd, setLocalEnd] = useState<string>(sched?.end_time ?? '08:00');

  React.useEffect(() => {
    if (sched?.start_time) setLocalStart(sched.start_time);
    if (sched?.end_time) setLocalEnd(sched.end_time);
  }, [sched]);

  const openPicker = useCallback((target: PickerTarget) => {
    const time = target === 'start' ? localStart : localEnd;
    const { h, m } = parseHM(time);
    setTempHour(h);
    setTempMinute(m);
    setPickerTarget(target);
    setPickerVisible(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [localStart, localEnd]);

  const confirmPicker = useCallback(() => {
    const val = `${padTwo(tempHour)}:${padTwo(tempMinute)}`;
    if (pickerTarget === 'start') {
      setLocalStart(val);
    } else {
      setLocalEnd(val);
    }
    setPickerVisible(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [tempHour, tempMinute, pickerTarget]);

  const bQ = useQuery({ queryKey: ['bookings', filter], queryFn: () => getBookings(filter), refetchInterval: 30000 });
  React.useEffect(() => { if (bQ.data) setBookings(bQ.data); }, [bQ.data, setBookings]);

  const acceptMut = useMutation({ mutationFn: acceptBooking, onSuccess: (_d, id) => { updateStat(id, 'CONFIRMED'); qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert('Confirmed', 'Booking confirmed.'); }, onError: () => Alert.alert('Error', 'Failed to accept.') });
  const declineMut = useMutation({ mutationFn: declineBooking, onSuccess: (_d, id) => { updateStat(id, 'DECLINED'); qc.invalidateQueries({ queryKey: ['bookings'] }); Alert.alert('Declined', 'Booking declined.'); }, onError: () => Alert.alert('Error', 'Failed to decline.') });
  const schedMut = useMutation({
    mutationFn: () => updateSchedulingHours(localStart, localEnd),
    onSuccess: () => {
      setDashboard({ schedulingHours: { start_time: localStart, end_time: localEnd } });
      Alert.alert('Saved', 'Scheduling hours updated.');
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => Alert.alert('Error', 'Failed to update scheduling hours.'),
  });

  const onAccept = useCallback((id: string) => acceptMut.mutate(id), [acceptMut]);
  const onDecline = useCallback((id: string) => { Alert.alert('Decline?', 'The passenger will be notified.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Decline', style: 'destructive', onPress: () => declineMut.mutate(id) }]); }, [declineMut]);
  const filters = useMemo<{ key: DateFilter; label: string }[]>(() => [{ key: 'today', label: 'Today' }, { key: 'tomorrow', label: 'Tomorrow' }, { key: 'week', label: 'This Week' }], []);
  const renderItem = useCallback(({ item }: { item: Booking }) => (
    <View>
      <BookingCard booking={item} onAccept={isStationary ? onAccept : undefined} onDecline={isStationary ? onDecline : undefined} isOnline={isOnline} />
      {!isStationary && item.status === 'PENDING' ? (
        <View style={ss.drivingHint}>
          <Lock size={12} color={Colors.textSecondary} />
          <Text style={ss.drivingHintText}>Stop at a station to manage this booking</Text>
        </View>
      ) : null}
    </View>
  ), [onAccept, onDecline, isOnline, isStationary]);
  const displayStart = localStart;
  const displayEnd = localEnd;

  return (
    <View style={ss.c}>
      <View style={ss.card}>
        <View style={ss.cH}><Calendar size={18} color={Colors.primary} /><Text style={ss.cT}>Your Scheduling Window</Text></View>
        <View style={ss.tR}>
          <Pressable style={ss.tB} onPress={() => openPicker('start')} testID="pick-start">
            <Text style={ss.tL}>Start</Text>
            <View style={ss.tP}><Clock size={14} color={Colors.primary} /><Text style={ss.tV}>{formatScheduleTime(displayStart)}</Text></View>
            <Text style={ss.tapHint}>Tap to change</Text>
          </Pressable>
          <Text style={ss.tS}>—</Text>
          <Pressable style={ss.tB} onPress={() => openPicker('end')} testID="pick-end">
            <Text style={ss.tL}>End</Text>
            <View style={ss.tP}><Clock size={14} color={Colors.primary} /><Text style={ss.tV}>{formatScheduleTime(displayEnd)}</Text></View>
            <Text style={ss.tapHint}>Tap to change</Text>
          </Pressable>
        </View>
        <Pressable style={({ pressed }) => [ss.saveBtn, pressed && { opacity: 0.85 }]} onPress={() => schedMut.mutate()} disabled={schedMut.isPending} testID="save-hours-btn">
          {schedMut.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={ss.saveBtnT}>Save Hours</Text>}
        </Pressable>
      </View>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={ss.overlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={ss.sheet} onPress={() => {}}>
            <View style={ss.sheetHandle} />
            <Text style={ss.sheetTitle}>Set {pickerTarget === 'start' ? 'Start' : 'End'} Time</Text>
            <TimePicker hour={tempHour} minute={tempMinute} onHourChange={setTempHour} onMinute={setTempMinute} />
            <View style={ss.sheetBtns}>
              <Pressable style={({ pressed }) => [ss.cancelBtn, pressed && { opacity: 0.8 }]} onPress={() => setPickerVisible(false)}>
                <Text style={ss.cancelBtnT}>Cancel</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [ss.confirmBtn, pressed && { opacity: 0.8 }]} onPress={confirmPicker} testID="confirm-time">
                <Text style={ss.confirmBtnT}>Confirm</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {!isStationary ? (
        <View style={ss.enRouteBanner}>
          <Zap size={16} color={Colors.success} />
          <Text style={ss.enRouteBannerText}>En Route — bookings are auto-handled based on available seats</Text>
        </View>
      ) : null}
      <Text style={ss.lT}>Upcoming Ride Requests</Text>
      <View style={ss.fR}>{filters.map((f) => (<Pressable key={f.key} style={[ss.fB, filter === f.key && ss.fBA]} onPress={() => setFilter(f.key)} testID={`filter-${f.key}`}><Text style={[ss.fBT, filter === f.key && ss.fBTA]}>{f.label}</Text></Pressable>))}</View>
      <FlatList data={bQ.data ?? []} renderItem={renderItem} keyExtractor={(i) => i.id} contentContainerStyle={ss.lC} showsVerticalScrollIndicator={false}
        ListEmptyComponent={bQ.isLoading ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} /> : <View style={ss.e}><View style={ss.eI}><Inbox size={40} color={Colors.disabled} /></View><Text style={ss.eT}>No upcoming bookings</Text><Text style={ss.eS}>Bookings appear when passengers request rides.</Text></View>}
        refreshControl={<RefreshControl refreshing={bQ.isRefetching} onRefresh={() => qc.invalidateQueries({ queryKey: ['bookings'] })} tintColor={Colors.primary} colors={[Colors.primary]} />}
      />
    </View>
  );
}

const pk = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 20 },
  col: { alignItems: 'center', gap: 4 },
  arrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center' },
  valBox: { width: 64, height: 56, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  val: { fontSize: 24, fontWeight: '700' as const, color: Colors.textPrimary },
  sep: { fontSize: 28, fontWeight: '700' as const, color: Colors.textSecondary, marginTop: -20 },
  label: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' as const, marginTop: 2 },
});

const ss = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.background },
  card: { backgroundColor: Colors.surface, margin: 16, marginBottom: 8, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  cH: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }, cT: { fontSize: 16, fontWeight: '700' as const, color: Colors.textPrimary },
  tR: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  tB: { alignItems: 'center', gap: 6 }, tL: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' as const },
  tP: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EBF4FF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 }, tV: { fontSize: 16, fontWeight: '600' as const, color: Colors.primary },
  tS: { fontSize: 20, color: Colors.textSecondary, marginTop: 16 },
  tapHint: { fontSize: 10, color: Colors.primary, fontWeight: '500' as const, marginTop: 2 },
  saveBtn: { height: 44, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }, saveBtnT: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.disabled, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  cancelBtnT: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
  confirmBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  confirmBtnT: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  lT: { fontSize: 17, fontWeight: '700' as const, color: Colors.textPrimary, marginHorizontal: 16, marginTop: 12, marginBottom: 12 },
  fR: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  fB: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight }, fBA: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fBT: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary }, fBTA: { color: Colors.white },
  lC: { paddingHorizontal: 16, paddingBottom: 24 },
  e: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 }, eI: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  eT: { fontSize: 18, fontWeight: '600' as const, color: Colors.textPrimary, marginBottom: 8 }, eS: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  enRouteBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E8F5E9', marginHorizontal: 16, marginTop: 8, marginBottom: 4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#A5D6A7' },
  enRouteBannerText: { fontSize: 13, color: '#2E7D32', fontWeight: '600' as const, flex: 1, lineHeight: 18 },
  drivingHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: -8, marginBottom: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  drivingHintText: { fontSize: 11, color: Colors.textSecondary, flex: 1 },
});
