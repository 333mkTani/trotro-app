import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Platform,
  Animated,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  MessageSquare,
  RefreshCw,
  Shield,
  Info,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from '@/services/notificationService';

interface PrefsState {
  enabled: boolean;
  newRequests: boolean;
  requestUpdates: boolean;
  sound: boolean;
}

export default function NotificationSettingsScreen() {
  const { bottom: safeBottom } = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<PrefsState | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPrefs();
    Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [fadeIn]);

  const loadPrefs = async () => {
    try {
      const stored = await getNotificationPreferences();
      setPrefs(stored);
    } catch (e) {
      console.log('[NotifSettings] Failed to load prefs:', e);
    } finally {
      setLoading(false);
    }
  };

  const updatePref = useCallback(
    async (key: keyof PrefsState, value: boolean) => {
      if (!prefs) return;
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const updated = { ...prefs, [key]: value };

      if (key === 'enabled' && !value) {
        updated.newRequests = false;
        updated.requestUpdates = false;
        updated.sound = false;
      }

      if (key === 'enabled' && value) {
        updated.newRequests = true;
        updated.requestUpdates = true;
        updated.sound = true;
      }

      setPrefs(updated);
      await setNotificationPreferences(updated);
      console.log('[NotifSettings] Updated pref:', key, '=', value);
    },
    [prefs],
  );

  const openSystemSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else if (Platform.OS === 'android') {
      Linking.openSettings();
    } else {
      Alert.alert('Info', 'Manage notification permissions in your browser settings.');
    }
  }, []);

  if (loading || !prefs) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Animated.View style={[s.container, { opacity: fadeIn }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: safeBottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroCard}>
          <View style={s.heroIconWrap}>
            {prefs.enabled ? (
              <BellRing size={28} color={Colors.primary} />
            ) : (
              <Bell size={28} color={Colors.disabled} />
            )}
          </View>
          <Text style={s.heroTitle}>
            {prefs.enabled ? 'Notifications Active' : 'Notifications Paused'}
          </Text>
          <Text style={s.heroSubtitle}>
            {prefs.enabled
              ? 'You will receive alerts for new ride requests and updates.'
              : 'Turn on notifications so you never miss a ride request.'}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>General</Text>
          <View style={s.card}>
            <ToggleRow
              icon={<Bell size={18} color={prefs.enabled ? Colors.primary : Colors.disabled} />}
              iconBg={prefs.enabled ? '#EBF4FF' : '#F1F5F9'}
              label="Enable Notifications"
              sublabel="Master toggle for all notifications"
              value={prefs.enabled}
              onToggle={(v) => updatePref('enabled', v)}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Notification Types</Text>
          <View style={s.card}>
            <ToggleRow
              icon={<MessageSquare size={18} color={prefs.newRequests ? Colors.success : Colors.disabled} />}
              iconBg={prefs.newRequests ? '#E8F5E9' : '#F1F5F9'}
              label="New Ride Requests"
              sublabel="Get notified when passengers need a ride nearby"
              value={prefs.newRequests}
              onToggle={(v) => updatePref('newRequests', v)}
              disabled={!prefs.enabled}
            />
            <View style={s.divider} />
            <ToggleRow
              icon={<RefreshCw size={18} color={prefs.requestUpdates ? Colors.warning : Colors.disabled} />}
              iconBg={prefs.requestUpdates ? '#FFF3E0' : '#F1F5F9'}
              label="Request Updates"
              sublabel="Notifications when you accept or decline requests"
              value={prefs.requestUpdates}
              onToggle={(v) => updatePref('requestUpdates', v)}
              disabled={!prefs.enabled}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Preferences</Text>
          <View style={s.card}>
            <ToggleRow
              icon={
                prefs.sound ? (
                  <Volume2 size={18} color={Colors.lightBlue} />
                ) : (
                  <VolumeX size={18} color={Colors.disabled} />
                )
              }
              iconBg={prefs.sound ? '#E3F2FD' : '#F1F5F9'}
              label="Sound"
              sublabel="Play a sound with notifications"
              value={prefs.sound}
              onToggle={(v) => updatePref('sound', v)}
              disabled={!prefs.enabled}
            />
          </View>
        </View>

        <View style={s.section}>
          <Pressable
            style={({ pressed }) => [s.systemBtn, pressed && { opacity: 0.7 }]}
            onPress={openSystemSettings}
            testID="open-system-settings"
          >
            <Shield size={18} color={Colors.primary} />
            <View style={s.systemBtnContent}>
              <Text style={s.systemBtnLabel}>System Notification Settings</Text>
              <Text style={s.systemBtnSub}>Manage permissions in device settings</Text>
            </View>
          </Pressable>
        </View>

        <View style={s.infoBox}>
          <Info size={16} color={Colors.textSecondary} />
          <Text style={s.infoText}>
            Notifications help you respond quickly to passenger requests. Keeping them enabled
            ensures you don't miss out on ride opportunities.
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function ToggleRow({
  icon,
  iconBg,
  label,
  sublabel,
  value,
  onToggle,
  disabled,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[s.row, disabled && s.rowDisabled]} testID={`toggle-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <View style={[s.rowIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, disabled && s.rowLabelDisabled]}>{label}</Text>
        <Text style={s.rowSublabel}>{sublabel}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#E2E8F0', true: Colors.primary }}
        thumbColor={value ? Colors.white : '#F1F5F9'}
        ios_backgroundColor="#E2E8F0"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16 },

  heroCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },

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
    minHeight: 64,
  },
  rowDisabled: { opacity: 0.5 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowContent: { flex: 1, marginRight: 12 },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
  },
  rowLabelDisabled: { color: Colors.disabled },
  rowSublabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 66 },

  systemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  systemBtnContent: { flex: 1 },
  systemBtnLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  systemBtnSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
});
