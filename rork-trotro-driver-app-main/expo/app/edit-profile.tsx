import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Camera, Check, User as UserIcon, Phone, Mail } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState<string>(user?.full_name ?? '');
  const [email, setEmail] = useState<string>(user?.email ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.avatar_url);

  const initials = (fullName || 'D').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const pickImageMutation = useMutation({
    mutationFn: async (source: 'camera' | 'library') => {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) throw new Error('Camera permission denied');
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
        if (result.canceled) return null;
        return result.assets[0]?.uri ?? null;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error('Photo library permission denied');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return null;
      return result.assets[0]?.uri ?? null;
    },
    onSuccess: (uri) => {
      if (uri) {
        setAvatarUri(uri);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handlePickPhoto = useCallback(() => {
    if (Platform.OS === 'web') {
      pickImageMutation.mutate('library');
      return;
    }
    Alert.alert('Profile Photo', 'Choose how you want to update your photo', [
      { text: 'Take Photo', onPress: () => pickImageMutation.mutate('camera') },
      { text: 'Choose from Library', onPress: () => pickImageMutation.mutate('library') },
      ...(avatarUri ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setAvatarUri(undefined) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, [pickImageMutation, avatarUri]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log('[EditProfile] Saving profile');
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!user) throw new Error('No user');
      return {
        ...user,
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        avatar_url: avatarUri,
      };
    },
    onSuccess: (updated) => {
      setUser(updated);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleSave = useCallback(() => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      Alert.alert('Invalid name', 'Please enter your full name.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    saveMutation.mutate();
  }, [fullName, email, saveMutation]);

  const isDirty =
    fullName.trim() !== (user?.full_name ?? '') ||
    email.trim() !== (user?.email ?? '') ||
    avatarUri !== user?.avatar_url;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.avatarSection}>
          <Pressable
            onPress={handlePickPhoto}
            style={({ pressed }) => [s.avatarWrap, pressed && { opacity: 0.85 }]}
            testID="pick-avatar"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <Text style={s.avatarInitials}>{initials}</Text>
            )}
            {pickImageMutation.isPending && (
              <View style={s.avatarLoading}>
                <ActivityIndicator color={Colors.white} />
              </View>
            )}
            <View style={s.cameraBadge}>
              <Camera size={16} color={Colors.white} />
            </View>
          </Pressable>
          <Text style={s.changePhotoText}>Tap to change photo</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Personal Information</Text>

          <View style={s.field}>
            <View style={s.fieldIcon}><UserIcon size={18} color={Colors.primary} /></View>
            <View style={s.fieldBody}>
              <Text style={s.fieldLabel}>Full Name</Text>
              <TextInput
                style={s.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={Colors.disabled}
                autoCapitalize="words"
                testID="input-name"
              />
            </View>
          </View>

          <View style={s.field}>
            <View style={s.fieldIcon}><Mail size={18} color={Colors.primary} /></View>
            <View style={s.fieldBody}>
              <Text style={s.fieldLabel}>Email (optional)</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.disabled}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-email"
              />
            </View>
          </View>

          <View style={[s.field, s.fieldDisabled]}>
            <View style={s.fieldIcon}><Phone size={18} color={Colors.textSecondary} /></View>
            <View style={s.fieldBody}>
              <Text style={s.fieldLabel}>Phone Number</Text>
              <Text style={s.fieldStatic}>{user?.phone ? `+233 ${user.phone}` : 'Not set'}</Text>
              <Text style={s.fieldHint}>Contact support to change your phone number</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [
            s.saveBtn,
            (!isDirty || saveMutation.isPending) && s.saveBtnDisabled,
            pressed && isDirty && { opacity: 0.9 },
          ]}
          onPress={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          testID="save-profile"
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Check size={18} color={Colors.white} />
              <Text style={s.saveBtnText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginTop: 8, marginBottom: 28 },
  avatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 60 },
  avatarInitials: { fontSize: 40, fontWeight: '800' as const, color: Colors.white },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
  changePhotoText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  fieldDisabled: { backgroundColor: '#F8FAFC' },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldBody: { flex: 1 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  fieldStatic: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  fieldHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnDisabled: { backgroundColor: Colors.disabled },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
