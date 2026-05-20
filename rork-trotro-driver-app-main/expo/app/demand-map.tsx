import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigation, RefreshCw, MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getDemandHeatmap } from '@/services/driverApi';
import { DemandStop } from '@/types';
import { formatDistance } from '@/utils/helpers';
import { useDriverStore } from '@/store/driverStore';
import { router } from 'expo-router';

function dColor(n: number) { return n >= 5 ? Colors.error : n >= 2 ? Colors.warning : Colors.success; }

export default function TrotroDemandHeatmap() {
  const isProSubscriber = useDriverStore((s) => s.isProSubscriber);

  useEffect(() => {
    if (!isProSubscriber) {
      router.replace('/pro-subscription');
    }
  }, [isProSubscriber]);

  const qc = useQueryClient();
  const hQ = useQuery({ queryKey: ['demand-full'], queryFn: () => getDemandHeatmap(5000), refetchInterval: 120000 });
  const sorted = useMemo(() => hQ.data ? [...hQ.data].sort((a, b) => b.demand_count - a.demand_count) : [], [hQ.data]);

  const goNav = useCallback((s: DemandStop) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/navigate', params: { lat: String(s.lat), lng: String(s.lng), name: s.stop_name } });
  }, []);

  const doRefresh = useCallback(() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); qc.invalidateQueries({ queryKey: ['demand-full'] }); }, [qc]);

  const renderItem = useCallback(({ item }: { item: DemandStop }) => (
    <View style={dm.row} testID={`ds-${item.id}`}>
      <View style={[dm.dot, { backgroundColor: dColor(item.demand_count) }]}><Text style={dm.dotT}>{item.demand_count}</Text></View>
      <View style={dm.info}><Text style={dm.name}>{item.stop_name}</Text><Text style={dm.dist}>{formatDistance(item.distance_km)} away</Text></View>
      <Pressable style={({ pressed }) => [dm.navBtn, pressed && { opacity: 0.7 }]} onPress={() => goNav(item)}><Navigation size={14} color={Colors.white} /><Text style={dm.navT}>Go</Text></Pressable>
    </View>
  ), [goNav]);

  return (
    <View style={dm.c}>
      <View style={dm.mapArea}>
        <View style={dm.mapInner}><MapPin size={32} color={Colors.primary} /><Text style={dm.mapTitle}>Map View</Text><Text style={dm.mapSub}>{sorted.length} stops with demand</Text><Text style={dm.eta}>Estimated arrival based on traffic conditions</Text></View>
        <View style={dm.legend}>{[{ c: Colors.error, l: '5+ High' }, { c: Colors.warning, l: '2-4 Med' }, { c: Colors.success, l: '1 Low' }].map((x) => <View key={x.l} style={dm.legI}><View style={[dm.legD, { backgroundColor: x.c }]} /><Text style={dm.legT}>{x.l}</Text></View>)}</View>
      </View>
      <View style={dm.listArea}>
        <Text style={dm.listTitle}>Stops by Demand</Text>
        {hQ.isLoading ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} /> :
          <FlatList data={sorted} renderItem={renderItem} keyExtractor={(i) => i.id} contentContainerStyle={dm.listPad} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={dm.emptyW}><Text style={dm.emptyT}>No data</Text></View>} />}
      </View>
      <Pressable style={({ pressed }) => [dm.fab, pressed && dm.fabP]} onPress={doRefresh} testID="refresh-btn"><RefreshCw size={22} color={Colors.white} /></Pressable>
    </View>
  );
}

const dm = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.background },
  mapArea: { height: '40%', backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  mapInner: { alignItems: 'center', gap: 8 }, mapTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.primary }, mapSub: { fontSize: 14, color: Colors.textSecondary }, eta: { fontSize: 11, color: Colors.disabled, fontStyle: 'italic' as const, marginTop: 8 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 20 }, legI: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legD: { width: 12, height: 12, borderRadius: 6 }, legT: { fontSize: 12, color: Colors.textSecondary },
  listArea: { flex: 1, padding: 16 }, listTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.textPrimary, marginBottom: 12 }, listPad: { paddingBottom: 80 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  dot: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, dotT: { fontSize: 14, fontWeight: '700' as const, color: Colors.white },
  info: { flex: 1 }, name: { fontSize: 15, fontWeight: '600' as const, color: Colors.textPrimary, marginBottom: 2 }, dist: { fontSize: 13, color: Colors.textSecondary },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }, navT: { fontSize: 13, fontWeight: '600' as const, color: Colors.white },
  emptyW: { alignItems: 'center', paddingTop: 24 }, emptyT: { fontSize: 14, color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  fabP: { opacity: 0.85, transform: [{ scale: 0.95 }] },
});
