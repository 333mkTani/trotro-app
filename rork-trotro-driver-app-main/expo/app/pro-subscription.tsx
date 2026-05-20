import React, { useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Animated, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Crown, MapPin, TrendingUp, Zap, Check, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDriverStore } from '@/store/driverStore';

const FEATURES = [
  { icon: MapPin, label: 'Live Demand Heat Map', desc: 'See real-time passenger demand across all stops' },
  { icon: TrendingUp, label: 'Demand Analytics', desc: 'Historical demand patterns and peak hour insights' },
  { icon: Zap, label: 'Priority Navigation', desc: 'Get turn-by-turn directions to high-demand zones' },
];

export default function ProSubscriptionScreen() {
  const setProSubscription = useDriverStore((s) => s.setProSubscription);
  const isProSubscriber = useDriverStore((s) => s.isProSubscriber);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  const handleSubscribe = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setProSubscription(true, expiresAt);
    Alert.alert(
      'Welcome to Pro!',
      'You now have full access to the Demand Heat Map and all Pro features.',
      [{ text: 'Open Heat Map', onPress: () => router.replace('/demand-map') }, { text: 'Done', onPress: () => router.back() }],
    );
  }, [setProSubscription]);

  const handleRestore = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Restore Purchase', 'Checking for existing subscription...', [
      {
        text: 'OK',
        onPress: () => {
          setProSubscription(true, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
          Alert.alert('Restored!', 'Your Pro subscription has been restored.');
        },
      },
    ]);
  }, [setProSubscription]);

  return (
    <ScrollView style={ps.container} contentContainerStyle={ps.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[ps.heroSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Animated.View style={[ps.crownCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Crown size={36} color="#F59E0B" />
        </Animated.View>
        <Text style={ps.heroTitle}>Trotro Pro</Text>
        <Text style={ps.heroSub}>Unlock powerful tools to maximize your earnings</Text>
      </Animated.View>

      <Animated.View style={[ps.featuresCard, { opacity: fadeAnim }]}>
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <View key={i} style={[ps.featureRow, i < FEATURES.length - 1 && ps.featureBorder]}>
              <View style={ps.featureIcon}>
                <Icon size={20} color={Colors.primary} />
              </View>
              <View style={ps.featureText}>
                <Text style={ps.featureLabel}>{f.label}</Text>
                <Text style={ps.featureDesc}>{f.desc}</Text>
              </View>
              <Check size={18} color={Colors.success} />
            </View>
          );
        })}
      </Animated.View>

      <Animated.View style={[ps.pricingCard, { opacity: fadeAnim }]}>
        <View style={ps.proBadge}>
          <Text style={ps.proBadgeText}>MOST POPULAR</Text>
        </View>
        <Text style={ps.priceMain}>GH₵ 29.99</Text>
        <Text style={ps.pricePer}>per month</Text>
        <View style={ps.priceFeatures}>
          {['Full Heat Map access', 'Unlimited demand checks', 'Cancel anytime'].map((t) => (
            <View key={t} style={ps.priceFeatureRow}>
              <Check size={14} color={Colors.success} />
              <Text style={ps.priceFeatureText}>{t}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {isProSubscriber ? (
        <View style={ps.activeCard}>
          <Check size={20} color={Colors.success} />
          <Text style={ps.activeText}>You're already a Pro subscriber!</Text>
        </View>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [ps.subscribeBtn, pressed && ps.subscribeBtnPressed]}
            onPress={handleSubscribe}
            testID="subscribe-btn"
          >
            <Crown size={18} color="#FFF" />
            <Text style={ps.subscribeBtnText}>Subscribe to Pro</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [ps.restoreBtn, pressed && { opacity: 0.6 }]}
            onPress={handleRestore}
            testID="restore-btn"
          >
            <Text style={ps.restoreBtnText}>Restore Purchase</Text>
          </Pressable>
        </>
      )}

      <Text style={ps.terms}>
        Subscription auto-renews monthly. Cancel anytime in your account settings. By subscribing you agree to our Terms of Service.
      </Text>
    </ScrollView>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  heroSection: { alignItems: 'center', paddingTop: 12, paddingBottom: 28 },
  crownCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  heroTitle: { fontSize: 28, fontWeight: '800' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  heroSub: { fontSize: 15, color: Colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 22 },
  featuresCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 4,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  featureIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#EBF4FF',
    justifyContent: 'center', alignItems: 'center',
  },
  featureText: { flex: 1 },
  featureLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.textPrimary },
  featureDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  pricingCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 24, alignItems: 'center',
    borderWidth: 2, borderColor: '#F59E0B', marginBottom: 24,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
  },
  proBadge: {
    backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    position: 'absolute', top: -14,
  },
  proBadgeText: { fontSize: 11, fontWeight: '800' as const, color: '#FFF', letterSpacing: 1 },
  priceMain: { fontSize: 36, fontWeight: '800' as const, color: Colors.textPrimary, marginTop: 12 },
  pricePer: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  priceFeatures: { marginTop: 16, gap: 10, width: '100%' },
  priceFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceFeatureText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' as const },
  activeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E8F5E9', borderRadius: 14, padding: 16, marginBottom: 16,
  },
  activeText: { fontSize: 15, fontWeight: '600' as const, color: Colors.success },
  subscribeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#F59E0B', borderRadius: 16, paddingVertical: 18, marginBottom: 12,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  subscribeBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  subscribeBtnText: { fontSize: 17, fontWeight: '700' as const, color: '#FFF' },
  restoreBtn: { alignItems: 'center', paddingVertical: 14, marginBottom: 16 },
  restoreBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  terms: { fontSize: 11, color: Colors.disabled, textAlign: 'center', lineHeight: 16 },
});
