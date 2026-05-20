import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Camera, ImageIcon, Trash2, Check, User as UserIcon } from "lucide-react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
const Colors = StaticColors;

export default function EditProfileScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  styles = React.useMemo(() => make_styles(themeColors), [themeColors]);

  const router = useRouter();
  const { user, updateProfile, updateProfilePending } = useAuth();

  const [fullName, setFullName] = useState<string>(user?.full_name ?? "");
  const [phone, setPhone] = useState<string>(user?.phone ?? "");
  const [email, setEmail] = useState<string>(user?.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatar_url);
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const initials = useMemo(() => {
    const n = fullName.trim();
    if (!n) return "?";
    return n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }, [fullName]);

  const hasChanges = useMemo(() => {
    return (
      fullName !== (user?.full_name ?? "") ||
      phone !== (user?.phone ?? "") ||
      email !== (user?.email ?? "") ||
      avatarUrl !== user?.avatar_url
    );
  }, [fullName, phone, email, avatarUrl, user]);

  const pickFromLibrary = useCallback(async () => {
    try {
      setShowPicker(false);
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Please allow photo library access to change your picture.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatarUrl(result.assets[0].uri);
        if (Platform.OS !== "web") Haptics.selectionAsync();
      }
    } catch (e) {
      console.log("pickFromLibrary error", e);
      Alert.alert("Error", "Couldn't open photo library.");
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    try {
      setShowPicker(false);
      if (Platform.OS === "web") {
        Alert.alert("Not available", "Camera is not available on web. Please upload from library.");
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow camera access to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatarUrl(result.assets[0].uri);
        if (Platform.OS !== "web") Haptics.selectionAsync();
      }
    } catch (e) {
      console.log("pickFromCamera error", e);
      Alert.alert("Error", "Couldn't open camera.");
    }
  }, []);

  const removePhoto = useCallback(() => {
    setShowPicker(false);
    setAvatarUrl(undefined);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }, []);

  const onSave = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert("Full name required", "Please enter your full name.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Phone required", "Please enter your phone number.");
      return;
    }
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        avatar_url: avatarUrl,
      });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.log("save profile error", e);
      Alert.alert("Error", "Couldn't save changes. Try again.");
    }
  }, [fullName, phone, email, avatarUrl, updateProfile, router]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Edit Profile",
          headerStyle: { backgroundColor: Colors.screenBg },
          headerTintColor: Colors.primary,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={onSave}
              disabled={!hasChanges || updateProfilePending}
              style={styles.headerBtn}
              testID="save-profile"
            >
              {updateProfilePending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={[styles.headerBtnTxt, (!hasChanges || updateProfilePending) && styles.headerBtnTxtDisabled]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowPicker(true)}
              style={styles.avatarBtn}
              testID="change-avatar"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Camera size={16} color={Colors.white} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPicker(true)} activeOpacity={0.7}>
              <Text style={styles.changePhotoTxt}>Change profile photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.gray400}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
              testID="input-name"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+233 ..."
              placeholderTextColor={Colors.gray400}
              style={styles.input}
              keyboardType="phone-pad"
              returnKeyType="next"
              testID="input-phone"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Email (optional)</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.gray400}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              testID="input-email"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!hasChanges || updateProfilePending) && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={!hasChanges || updateProfilePending}
            activeOpacity={0.85}
            testID="save-profile-btn"
          >
            {updateProfilePending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnTxt}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Profile Photo</Text>
            <Text style={styles.sheetSub}>Choose a new picture</Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity style={styles.optionRow} onPress={pickFromCamera} activeOpacity={0.7} testID="opt-camera">
              <View style={[styles.optIcon, { backgroundColor: Colors.primaryFaded }]}>
                <Camera size={18} color={Colors.primary} />
              </View>
              <Text style={styles.optionTxt}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={pickFromLibrary} activeOpacity={0.7} testID="opt-library">
              <View style={[styles.optIcon, { backgroundColor: Colors.infoLight }]}>
                <ImageIcon size={18} color={Colors.info} />
              </View>
              <Text style={styles.optionTxt}>Choose from Library</Text>
            </TouchableOpacity>
            {avatarUrl ? (
              <TouchableOpacity style={styles.optionRow} onPress={removePhoto} activeOpacity={0.7} testID="opt-remove">
                <View style={[styles.optIcon, { backgroundColor: Colors.dangerLight }]}>
                  <Trash2 size={18} color={Colors.danger} />
                </View>
                <Text style={[styles.optionTxt, { color: Colors.danger }]}>Remove Photo</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPicker(false)} activeOpacity={0.7}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}



const make_styles = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  inner: { padding: 20, paddingBottom: 40 },
  headerBtn: { paddingHorizontal: 12, paddingVertical: 6, minWidth: 48, alignItems: "flex-end" as const },
  headerBtnTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.primary },
  headerBtnTxtDisabled: { color: Colors.gray300 },
  avatarWrap: { alignItems: "center" as const, marginVertical: 12, marginBottom: 28 },
  avatarBtn: { width: 120, height: 120, marginBottom: 12 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  initials: { fontSize: 40, fontWeight: "800" as const, color: Colors.white },
  cameraBadge: {
    position: "absolute" as const,
    right: 2,
    bottom: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: Colors.screenBg,
  },
  changePhotoTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  section: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: "700" as const, color: Colors.gray500, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" as const },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
    fontSize: 15,
    color: Colors.gray800,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  saveBtnDisabled: { backgroundColor: Colors.gray200 },
  saveBtnTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray200, alignSelf: "center" as const, marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray800 },
  sheetSub: { fontSize: 13, color: Colors.gray500, marginTop: 4 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: Colors.screenBg,
  },
  optIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center" as const, justifyContent: "center" as const },
  optionTxt: { fontSize: 15, fontWeight: "500" as const, color: Colors.gray700 },
  cancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: "center" as const },
  cancelTxt: { fontSize: 15, fontWeight: "600" as const, color: Colors.gray500 },
});

let styles: ReturnType<typeof make_styles> = make_styles(StaticColors as unknown as ThemePalette);
