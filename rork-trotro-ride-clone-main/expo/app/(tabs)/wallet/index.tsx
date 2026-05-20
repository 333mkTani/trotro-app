import React, { useCallback, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  ChevronRight,
  TrendingUp,
  Clock,
  Send,
  Banknote,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { WalletTransaction } from "@/types";
const Colors = StaticColors;

const formatCurrency = (amount: number): string => {
  const abs = Math.abs(amount);
  return `GH₵ ${abs.toFixed(2)}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
};

const TransactionIcon = ({ type }: { type: WalletTransaction["type"] }) => {
  switch (type) {
    case "top_up":
      return (
        <View style={[st.txnIcon, { backgroundColor: Colors.successLight }]}>
          <ArrowDownLeft size={16} color={Colors.success} />
        </View>
      );
    case "ride_payment":
      return (
        <View style={[st.txnIcon, { backgroundColor: Colors.primaryFaded }]}>
          <ArrowUpRight size={16} color={Colors.primary} />
        </View>
      );
    case "driver_payment":
      return (
        <View style={[st.txnIcon, { backgroundColor: Colors.warningLight }]}>
          <Send size={16} color={Colors.warning} />
        </View>
      );
    case "refund":
      return (
        <View style={[st.txnIcon, { backgroundColor: Colors.infoLight }]}>
          <RotateCcw size={16} color={Colors.info} />
        </View>
      );
    default:
      return null;
  }
};

const TransactionRow = React.memo(({ txn }: { txn: WalletTransaction }) => {
  const isPositive = txn.amount > 0;

  return (
    <View style={st.txnRow} testID={`txn-${txn.id}`}>
      <TransactionIcon type={txn.type} />
      <View style={st.txnInfo}>
        <Text style={st.txnDesc} numberOfLines={1}>
          {txn.description}
        </Text>
        <Text style={st.txnDate}>{formatDate(txn.created_at)}</Text>
      </View>
      <Text style={[st.txnAmount, isPositive ? st.txnPositive : st.txnNegative]} numberOfLines={1}>
        {isPositive ? "+" : "-"}{formatCurrency(txn.amount)}
      </Text>
    </View>
  );
});

export default function WalletScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { balance, recentTransactions, isLoading } = useWallet();
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(balanceAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
    ]).start();
  }, []);

  const onTopUp = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/wallet-topup");
  }, [router]);

  const onPayDriver = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/pay-driver");
  }, [router]);

  const totalSpent = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return recentTransactions
      .filter((t) => t.type === "ride_payment" && new Date(t.created_at) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [recentTransactions]);

  const totalTopUps = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return recentTransactions
      .filter((t) => t.type === "top_up" && new Date(t.created_at) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [recentTransactions]);

  if (isLoading) {
    return (
      <View style={st.loadingRoot}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={[
          st.balanceCard,
          {
            opacity: balanceAnim,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <View style={st.cardTop}>
          <View style={st.cardIconWrap}>
            <Wallet size={20} color={Colors.white} />
          </View>
          <Text style={st.cardLabel}>Available Balance</Text>
        </View>
        <Text style={st.cardBalance} numberOfLines={1} adjustsFontSizeToFit>GH₵ {balance.toFixed(2)}</Text>
        <View style={st.cardDivider} />
        <View style={st.cardActions}>
          <TouchableOpacity
            style={st.topUpBtn}
            onPress={onTopUp}
            activeOpacity={0.8}
            testID="topup-btn"
          >
            <Plus size={18} color={Colors.white} />
            <Text style={st.topUpText}>Top Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={st.payDriverBtn}
            onPress={onPayDriver}
            activeOpacity={0.8}
            testID="pay-driver-btn"
          >
            <Send size={18} color={Colors.primary} />
            <Text style={st.payDriverText}>Pay Driver</Text>
          </TouchableOpacity>
        </View>
        <View style={st.cardDecor1} />
        <View style={st.cardDecor2} />
      </Animated.View>

      <View style={st.statsRow}>
        <View style={st.statCard}>
          <View style={[st.statIconWrap, { backgroundColor: Colors.primaryFaded }]}>
            <ArrowUpRight size={16} color={Colors.primary} />
          </View>
          <Text style={st.statLabel} numberOfLines={1}>Spent (30d)</Text>
          <Text style={st.statValue} numberOfLines={1} adjustsFontSizeToFit>GH₵ {totalSpent.toFixed(2)}</Text>
        </View>
        <View style={st.statCard}>
          <View style={[st.statIconWrap, { backgroundColor: Colors.successLight }]}>
            <TrendingUp size={16} color={Colors.success} />
          </View>
          <Text style={st.statLabel} numberOfLines={1}>Added (30d)</Text>
          <Text style={st.statValue} numberOfLines={1} adjustsFontSizeToFit>GH₵ {totalTopUps.toFixed(2)}</Text>
        </View>
      </View>

      <View style={st.sectionHeader}>
        <View style={st.sectionLeft}>
          <Clock size={16} color={Colors.gray500} />
          <Text style={st.sectionTitle}>Recent Transactions</Text>
        </View>
        <Text style={st.sectionCount}>{recentTransactions.length}</Text>
      </View>

      <View style={st.txnList}>
        {recentTransactions.length === 0 ? (
          <View style={st.emptyState}>
            <Wallet size={40} color={Colors.gray300} />
            <Text style={st.emptyTitle}>No transactions yet</Text>
            <Text style={st.emptySub}>Top up your wallet to get started</Text>
          </View>
        ) : (
          recentTransactions.map((txn, idx) => (
            <React.Fragment key={txn.id}>
              <TransactionRow txn={txn} />
              {idx < recentTransactions.length - 1 && <View style={st.txnDivider} />}
            </React.Fragment>
          ))
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.screenBg,
  },
  content: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  loadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.screenBg,
  },
  balanceCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 22,
    padding: 24,
    overflow: "hidden" as const,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.8)",
  },
  cardBalance: {
    fontSize: 38,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: -1,
    marginBottom: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },
  topUpBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  topUpText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  payDriverBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 14,
  },
  payDriverText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  cardDecor1: {
    position: "absolute" as const,
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cardDecor2: {
    position: "absolute" as const,
    bottom: -20,
    right: 50,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 18,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray500,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  sectionCount: {
    fontSize: 13,
    color: Colors.gray400,
    fontWeight: "600" as const,
  },
  txnList: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  txnInfo: {
    flex: 1,
  },
  txnDesc: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.gray700,
  },
  txnDate: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: "700" as const,
    flexShrink: 0,
    maxWidth: "40%" as const,
  },
  txnPositive: {
    color: Colors.success,
  },
  txnNegative: {
    color: Colors.gray700,
  },
  txnDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginLeft: 66,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.gray600,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.gray400,
  },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
