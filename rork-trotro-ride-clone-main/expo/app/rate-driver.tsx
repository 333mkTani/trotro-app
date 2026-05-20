import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import {
  Star,
  Bus,
  User,
  Check,
  ThumbsUp,
  Shield,
  Smile,
  Sparkles,
  Clock,
  MapPin,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";

type Params = {
  bookingId?: string;
  driverName?: string;
  busReg?: string;
  routeName?: string;
  pickupStop?: string;
  destinationStop?: string;
  fare?: string;
};

type TagKey =
  | "friendly"
  | "safe_driving"
  | "clean_bus"
  | "on_time"
  | "smooth_ride"
  | "good_music"
  | "polite"
  | "helpful";

const TAGS: { key: TagKey; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: "friendly", label: "Friendly", icon: Smile },
  { key: "safe_driving", label: "Safe Driving", icon: Shield },
  { key: "clean_bus", label: "Clean Bus", icon: Sparkles },
  { key: "on_time", label: "On Time", icon: Clock },
  { key: "smooth_ride", label: "Smooth Ride", icon: ThumbsUp },
  { key: "polite", label: "Polite", icon: Smile },
  { key: "helpful", label: "Helpful", icon: ThumbsUp },
  { key: "good_music", label: "Good Vibes", icon: Sparkles },
];

const RATING_LABELS: Record<number, string> = {
  0: "Tap a star to rate",
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

export default function RateDriverScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  const st = useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const params = useLocalSearchParams<Params>();

  const [rating, setRating] = useState<number>(0);
  const [tags, setTags] = useState<TagKey[]>([]);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const starScales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
    ]).start();
  }, [fadeIn, cardSlide]);

  const handleRate = useCallback((val: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(val);
    const anim = starScales[val - 1];
    if (anim) {
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 5 }),
      ]).start();
    }
  }, [starScales]);

  const toggleTag = useCallback((key: TagKey) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setTags((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    console.log("[RateDriver] Submitting rating:", {
      bookingId: params.bookingId,
      driverName: params.driverName,
      rating,
      tags,
      comment,
    });

    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    setShowSuccess(true);

    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      router.replace("/");
    }, 1800);
  }, [rating, tags, comment, params, router, successScale, successOpacity]);

  const handleSkip = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  }, [router]);

  if (showSuccess) {
    return (
      <View style={st.successRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <Animated.View
          style={[st.successCircle, { opacity: successOpacity, transform: [{ scale: successScale }] }]}
        >
          <Check size={48} color={Colors.white} />
        </Animated.View>
        <Animated.Text style={[st.successTitle, { opacity: successOpacity }]}>
          Thanks for your feedback!
        </Animated.Text>
        <Animated.Text style={[st.successSub, { opacity: successOpacity }]}>
          Your rating helps keep our drivers top-notch.
        </Animated.Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Rate Your Ride",
          headerRight: () => (
            <TouchableOpacity onPress={handleSkip} style={st.skipBtn} testID="skip-rating">
              <Text style={[st.skipTxt, { color: Colors.gray500 }]}>Skip</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: cardSlide }] }}>
          <View style={st.driverCard}>
            <View style={st.driverAvatar}>
              <User size={32} color={Colors.white} />
            </View>
            <Text style={st.driverName} numberOfLines={1}>
              {params.driverName || "Your Driver"}
            </Text>
            <View style={st.busRow}>
              <Bus size={14} color={Colors.gray500} />
              <Text style={st.busRowTxt} numberOfLines={1}>
                {params.busReg || "Bus"} · {params.routeName || "Route"}
              </Text>
            </View>
            {(params.pickupStop || params.destinationStop) && (
              <View style={st.stopsRow}>
                <MapPin size={12} color={Colors.gray400} />
                <Text style={st.stopsTxt} numberOfLines={1}>
                  {params.pickupStop || "—"} → {params.destinationStop || "—"}
                </Text>
              </View>
            )}
          </View>

          <Text style={st.question}>How was your ride?</Text>
          <Text style={st.ratingLabel}>{RATING_LABELS[rating]}</Text>

          <View style={st.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= rating;
              const scaleVal = starScales[n - 1] ?? new Animated.Value(1);
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => handleRate(n)}
                  activeOpacity={0.7}
                  style={st.starBtn}
                  testID={`star-${n}`}
                >
                  <Animated.View style={{ transform: [{ scale: scaleVal }] }}>
                    <Star
                      size={44}
                      color={active ? Colors.warning : Colors.gray300}
                      fill={active ? Colors.warning : "transparent"}
                      strokeWidth={active ? 0 : 2}
                    />
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>

          {rating > 0 && (
            <>
              <Text style={st.sectionLabel}>
                {rating >= 4 ? "WHAT WENT WELL?" : "WHAT COULD BE BETTER?"}
              </Text>
              <View style={st.tagsWrap}>
                {TAGS.map((t) => {
                  const selected = tags.includes(t.key);
                  const Icon = t.icon;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[st.tagChip, selected && st.tagChipActive]}
                      onPress={() => toggleTag(t.key)}
                      activeOpacity={0.7}
                      testID={`tag-${t.key}`}
                    >
                      <Icon size={14} color={selected ? Colors.white : Colors.gray600} />
                      <Text style={[st.tagTxt, selected && st.tagTxtActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={st.sectionLabel}>ADD A COMMENT (OPTIONAL)</Text>
              <View style={st.commentCard}>
                <TextInput
                  style={st.commentInput}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Share more about your experience..."
                  placeholderTextColor={Colors.gray400}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                  testID="comment-input"
                />
                <Text style={st.commentCount}>{comment.length}/300</Text>
              </View>
            </>
          )}

          <View style={{ height: 16 }} />
        </Animated.View>
      </ScrollView>

      <View style={st.bottomArea}>
        <TouchableOpacity
          style={[st.submitBtn, (rating === 0 || submitting) && st.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={rating === 0 || submitting}
          testID="submit-rating"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={st.submitTxt}>
              {rating === 0 ? "Select a rating" : "Submit Rating"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  scrollContent: { paddingTop: 16, paddingBottom: 30 },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  skipTxt: { fontSize: 15, fontWeight: "600" as const },

  driverCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  driverAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  driverName: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: Colors.gray800,
    marginBottom: 6,
    maxWidth: "100%",
  },
  busRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  busRowTxt: { fontSize: 13, color: Colors.gray500, fontWeight: "600" as const, flexShrink: 1 },
  stopsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: "100%",
  },
  stopsTxt: { fontSize: 11, color: Colors.gray600, fontWeight: "500" as const, flexShrink: 1 },

  question: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.gray800,
    textAlign: "center" as const,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  ratingLabel: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: "center" as const,
    marginBottom: 18,
    fontWeight: "500" as const,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  starBtn: { padding: 4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 10,
    marginTop: 4,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap" as const,
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
  },
  tagChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagTxt: { fontSize: 13, fontWeight: "600" as const, color: Colors.gray700 },
  tagTxtActive: { color: Colors.white },

  commentCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  commentInput: {
    fontSize: 14,
    color: Colors.gray800,
    minHeight: 80,
    padding: 0,
    lineHeight: 20,
  },
  commentCount: {
    fontSize: 11,
    color: Colors.gray400,
    textAlign: "right" as const,
    marginTop: 6,
  },

  bottomArea: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    backgroundColor: Colors.screenBg,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitTxt: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },

  successRoot: {
    flex: 1,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800" as const,
    color: Colors.white,
    marginBottom: 10,
    textAlign: "center" as const,
  },
  successSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center" as const,
    lineHeight: 22,
  },
});
