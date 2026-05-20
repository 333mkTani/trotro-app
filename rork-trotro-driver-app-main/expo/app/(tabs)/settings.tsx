import React, { useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, Switch, Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  User, LogOut, Phone, Shield, MapPin, Bell, Clock,
  ChevronRight, Bus, Info, HelpCircle, FileText, Crown, Camera,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useDriverStore } from '@/store/driverStore';
import { logout } from '@/services/auth';
import { stopGpsService } from '@/services/gpsService';

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}

const SettingsRow = React.memo(function SettingsRow({
  icon, label, value, onPress, isDestructive, showChevron = true, rightElement,
}: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && onPress && s.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
      testID={`settings-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <View style={[s.rowIcon, isDestructive && s.rowIconDanger]}>
        {icon}
      </View>
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, isDestructive && s.rowLabelDanger]}>{label}</Text>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
      </View>
      {rightElement ?? (showChevron && onPress ? <ChevronRight size={18} color={Colors.disabled} /> : null)}
    </Pressable>
  );
});

export default function SettingsScreen() {
  const { bottom: safeBottom } = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const store = useDriverStore();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeIn]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? GPS tracking will stop.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            stopGpsService();
            await logout();
            clearAuth();
            router.replace('/');
          },
        },
      ],
    );
  }, [clearAuth]);

  const handleNotImplemented = useCallback((feature: string) => {
    Alert.alert('Coming Soon', `${feature} will be available in a future update.`);
  }, []);

  const initials = (user?.full_name ?? 'D')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Animated.View style={[s.container, { opacity: fadeIn }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: safeBottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [s.profileCard, pressed && { opacity: 0.92 }]}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/edit-profile');
          }}
          testID="open-edit-profile"
        >
          <View style={s.avatar}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <Text style={s.avatarText}>{initials}</Text>
            )}
            <View style={s.avatarCam}>
              <Camera size={12} color={Colors.primary} />
            </View>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.full_name ?? 'Driver'}</Text>
            <Text style={s.profilePhone}>{user?.phone ? `+233 ${user.phone}` : 'No phone'}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{user?.role === 'driver' ? 'Verified Driver' : (user?.role ?? 'Driver')}</Text>
            </View>
          </View>
          <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>

        {store.assignedRoute && (
          <View style={s.routeCard}>
            <Bus size={18} color={Colors.primary} />
            <View style={s.routeInfo}>
              <Text style={s.routeLabel}>Assigned Route</Text>
              <Text style={s.routeName}>{store.assignedRoute.name}</Text>
            </View>
            <View style={s.regBadge}>
              <Text style={s.regText}>{store.busRegistration || 'N/A'}</Text>
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          <View style={s.card}>
            <SettingsRow
              icon={<User size={18} color={Colors.primary} />}
              label="Edit Profile"
              value={user?.full_name ?? 'View profile'}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/edit-profile');
              }}
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<Phone size={18} color={Colors.primary} />}
              label="Phone Number"
              value={user?.phone ? `+233 ${user.phone}` : 'Not set'}
              showChevron={false}
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<Shield size={18} color={Colors.primary} />}
              label="Change Password"
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/change-password');
              }}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Driving</Text>
          <View style={s.card}>
            <SettingsRow
              icon={<MapPin size={18} color={Colors.success} />}
              label="GPS Tracking"
              value="Active while signed in"
              showChevron={false}
              rightElement={
                <View style={s.statusDot}>
                  <View style={s.statusDotInner} />
                </View>
              }
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<Clock size={18} color={Colors.warning} />}
              label="Scheduling Hours"
              value={
                store.schedulingHours
                  ? `${store.schedulingHours.start_time} – ${store.schedulingHours.end_time}`
                  : 'Not set'
              }
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/schedule');
              }}
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<Bell size={18} color={Colors.gold} />}
              label="Notifications"
              value="Push notifications"
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/notification-settings');
              }}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Subscription</Text>
          <View style={s.card}>
            <SettingsRow
              icon={<Crown size={18} color="#F59E0B" />}
              label="Trotro Pro"
              value={store.isProSubscriber ? 'Active' : 'Upgrade for Heat Map access'}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/pro-subscription');
              }}
              rightElement={
                store.isProSubscriber ? (
                  <View style={s.proBadge}><Text style={s.proBadgeText}>PRO</Text></View>
                ) : undefined
              }
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Support</Text>
          <View style={s.card}>
            <SettingsRow
              icon={<HelpCircle size={18} color={Colors.lightBlue} />}
              label="Help & FAQ"
              onPress={() => handleNotImplemented('Help center')}
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<FileText size={18} color={Colors.textSecondary} />}
              label="Terms & Privacy"
              onPress={() => handleNotImplemented('Terms & Privacy')}
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<Info size={18} color={Colors.textSecondary} />}
              label="App Version"
              value="1.0.0"
              showChevron={false}
            />
          </View>
        </View>

        <View style={s.section}>
          <View style={s.card}>
            <SettingsRow
              icon={<LogOut size={18} color={Colors.error} />}
              label="Sign Out"
              isDestructive
              onPress={handleSignOut}
              showChevron={false}
            />
          </View>
        </View>

        <Text style={s.footer}>Trotro Driver v1.0.0{'\n'}Ride Coordination System</Text>
      </ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'visible',
  },
  avatarText: { fontSize: 24, fontWeight: '800' as const, color: Colors.white },
  avatarImg: { width: '100%', height: '100%', borderRadius: 32 },
  avatarCam: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700' as const, color: Colors.white, marginBottom: 2 },
  profilePhone: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: { fontSize: 12, fontWeight: '600' as const, color: Colors.white },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    gap: 12,
  },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' as const },
  routeName: { fontSize: 15, fontWeight: '600' as const, color: Colors.textPrimary },
  regBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  regText: { fontSize: 12, fontWeight: '700' as const, color: Colors.white },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowPressed: { backgroundColor: '#F1F5F9' },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowIconDanger: { backgroundColor: '#FFEBEE' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '500' as const, color: Colors.textPrimary },
  rowLabelDanger: { color: Colors.error, fontWeight: '600' as const },
  rowValue: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 66 },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  proBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.disabled,
    marginTop: 8,
    lineHeight: 18,
  },
});
