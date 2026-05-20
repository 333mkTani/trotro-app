import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  TrendingUp,
  Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getWalletBalance, getTransactions } from '@/services/driverApi';
import { WalletTransaction } from '@/types';

function formatCurrency(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  return `${currency} ${abs.toFixed(2)}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

function getTransactionIcon(type: WalletTransaction['type']) {
  switch (type) {
    case 'TRIP_EARNING':
      return <ArrowDownLeft size={18} color="#16A34A" />;
    case 'WITHDRAWAL':
      return <ArrowUpRight size={18} color="#DC2626" />;
    case 'BONUS':
      return <Gift size={18} color="#D97706" />;
    case 'REFUND':
      return <RotateCcw size={18} color={Colors.primary} />;
  }
}

function getStatusIcon(status: WalletTransaction['status']) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle size={14} color="#16A34A" />;
    case 'PENDING':
      return <Clock size={14} color="#D97706" />;
    case 'FAILED':
      return <XCircle size={14} color="#DC2626" />;
  }
}

function getTransactionColor(type: WalletTransaction['type']): string {
  return type === 'WITHDRAWAL' ? '#DC2626' : '#16A34A';
}

const TransactionItem = React.memo(({ item }: { item: WalletTransaction }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.txRow, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        style={styles.txInner}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID={`tx-${item.id}`}
      >
        <View style={[styles.txIconWrap, {
          backgroundColor: item.type === 'WITHDRAWAL' ? '#FEF2F2' :
            item.type === 'BONUS' ? '#FFFBEB' : '#F0FDF4'
        }]}>
          {getTransactionIcon(item.type)}
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <View style={styles.txMeta}>
            {getStatusIcon(item.status)}
            <Text style={styles.txTime}>{formatRelativeTime(item.created_at)}</Text>
          </View>
        </View>
        <Text style={[styles.txAmount, { color: getTransactionColor(item.type) }]}>
          {item.type === 'WITHDRAWAL' ? '-' : '+'}{formatCurrency(item.amount, item.currency)}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

export default function WalletScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const balanceScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.spring(balanceScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, balanceScale]);

  const balanceQ = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
    refetchInterval: 30000,
  });

  const txQ = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: getTransactions,
  });

  const onRefresh = useCallback(() => {
    balanceQ.refetch();
    txQ.refetch();
  }, [balanceQ, txQ]);

  const todayEarnings = useMemo(() => {
    if (!txQ.data) return 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return txQ.data
      .filter(tx => tx.type !== 'WITHDRAWAL' && new Date(tx.created_at) >= todayStart && tx.status !== 'FAILED')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [txQ.data]);

  const handleWithdraw = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/withdraw');
  }, []);

  const handleFundWallet = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/fund-wallet');
  }, []);

  const balance = balanceQ.data;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={balanceQ.isRefetching || txQ.isRefetching}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <Animated.View style={[styles.balanceCard, {
          transform: [{ scale: balanceScale }, { translateY: slideAnim }],
        }]}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceIconWrap}>
              <Wallet size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.balanceLabel}>Available Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>
            {balance ? `GHS ${balance.available.toFixed(2)}` : '---'}
          </Text>
          {balance && balance.pending > 0 && (
            <View style={styles.pendingRow}>
              <Clock size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.pendingText}>
                GHS {balance.pending.toFixed(2)} pending
              </Text>
            </View>
          )}
          <View style={styles.balanceActions}>
            <Pressable
              style={({ pressed }) => [styles.fundBtn, pressed && styles.btnPressed]}
              onPress={handleFundWallet}
              testID="fund-btn"
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.fundBtnText}>Fund</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.withdrawBtn, pressed && styles.btnPressed]}
              onPress={handleWithdraw}
              testID="withdraw-btn"
            >
              <ArrowUpRight size={18} color={Colors.primary} />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </Pressable>
          </View>
        </Animated.View>

        <View style={styles.earningsCard}>
          <View style={styles.earningsLeft}>
            <View style={styles.earningsIconWrap}>
              <TrendingUp size={18} color="#16A34A" />
            </View>
            <View>
              <Text style={styles.earningsLabel}>Today's Earnings</Text>
              <Text style={styles.earningsAmount}>GHS {todayEarnings.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {txQ.data && txQ.data.length > 5 && (
            <Pressable style={styles.seeAllBtn} testID="see-all-tx">
              <Text style={styles.seeAllText}>See All</Text>
              <ChevronRight size={14} color={Colors.primary} />
            </Pressable>
          )}
        </View>

        {txQ.isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading transactions...</Text>
          </View>
        ) : txQ.data && txQ.data.length > 0 ? (
          <View style={styles.txList}>
            {txQ.data.map((tx) => (
              <TransactionItem key={tx.id} item={tx} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Wallet size={40} color={Colors.disabled} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>Your trip earnings will appear here</Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  balanceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 4,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500' as const,
  },
  balanceActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  fundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fundBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  withdrawBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  earningsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  earningsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  earningsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  earningsAmount: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#16A34A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  txList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  txRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  txInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  txTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
