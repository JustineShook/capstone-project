import { colors } from "../../constants/owner/theme";
import { homeColors } from "../../constants/owner/homeTheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getRating, submitRating, type BookingRating, type RatedBookingType } from "../../services/owner/ratingService";

export function CustomerRating({ homeAppearance = false, bookingId, bookingType, providerName, variant = "default" }: { homeAppearance?: boolean; bookingId: string; bookingType: Extract<RatedBookingType, "shop" | "parking" | "homegarage">; providerName: string; variant?: "default" | "towing" }) {
  const colors = homeAppearance ? homeColors : defaultColors;
  const s = homeAppearance ? lightStyles : defaultStyles;
  const [saved, setSaved] = useState<BookingRating>();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getRating(bookingId).then((rating) => {
      if (!active || !rating) return;
      setSaved(rating);
      setStars(rating.rating);
      setComment(rating.comment ?? "");
    }).catch(() => {
      if (active) setError("Could not load your feedback. Please check your connection.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId]);

  async function send() {
    if (stars < 1 || saving || saved) return;
    setSaving(true);
    setError(null);
    try {
      const result = await submitRating(bookingId, bookingType, stars, comment);
      setSaved(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit feedback. Please try again.");
    } finally { setSaving(false); }
  }

  return <View style={[s.card, variant === "towing" && s.towingCard]}>
    <Text style={[s.title, variant === "towing" && s.towingTitle]}>{saved ? "Thank you for your feedback!" : "Rate this Provider"}</Text>
    <Text style={[s.hint, variant === "towing" && s.towingHint]}>{saved ? "Your feedback helps improve VeResc." : `How was your experience with ${providerName}?`}</Text>
    {loading ? <Text style={[s.hint, variant === "towing" && s.towingHint]}>Loading your review…</Text> : <>
      <View style={[s.stars, variant === "towing" && s.towingStars]}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Rate ${value} out of 5 stars`} accessibilityState={{ selected: value <= stars, disabled: Boolean(saved) }} disabled={Boolean(saved)} onPress={() => setStars(value)} hitSlop={6}>
        <Ionicons name={value <= stars ? "star" : "star-outline"} size={32} color={homeAppearance ? (value <= stars ? homeColors.rating : homeColors.textMuted) : (value <= stars ? "#F5C451" : "#7E8B97")} />
      </Pressable>)}</View>
      {saved ? comment ? <Text style={[s.comment, variant === "towing" && s.towingComment]}>“{comment}”</Text> : null : <TextInput accessibilityLabel="Written feedback (optional)" value={comment} onChangeText={setComment} maxLength={1000} multiline placeholder={variant === "towing" ? "Write a comment about your experience..." : "Share a few words (optional)"} placeholderTextColor={homeAppearance ? homeColors.textMuted : "#7E8B97"} style={[s.input, variant === "towing" && s.towingInput]} />}
      {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!saved && <Pressable accessibilityRole="button" accessibilityState={{ disabled: stars === 0 || saving }} disabled={stars === 0 || saving} onPress={() => void send()} style={[s.button, variant === "towing" && s.towingButton, (stars === 0 || saving) && s.disabled]}>
        <Text style={[s.buttonText, variant === "towing" && s.towingButtonText]}>{saving ? "Submitting…" : "Submit Rating"}</Text>
      </Pressable>}
    </>}
  </View>;
}

const defaultColors = colors;
const makeStyles = (colors: typeof defaultColors) => StyleSheet.create({
  card: { backgroundColor: "#151C23", borderWidth: 1, borderColor: "#28313A", borderRadius: 14, padding: 16, gap: 11 },
  title: { color: "#F4F6F8", fontSize: 17, fontWeight: "700" },
  hint: { color: "#AAB5C0", fontSize: 14, lineHeight: 20 },
  stars: { flexDirection: "row", gap: 12, paddingVertical: 3 },
  input: { minHeight: 84, borderWidth: 1, borderColor: "#28313A", borderRadius: 11, padding: 12, textAlignVertical: "top", color: "#F4F6F8", fontSize: 15 },
  comment: { color: "#AAB5C0", fontSize: 15, lineHeight: 22 },
  button: { minHeight: 48, backgroundColor: "#F52239", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { color: "#F4F6F8", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.48 },
  error: { color: "#FF7482", fontSize: 14, lineHeight: 20 },
  towingCard: { backgroundColor: "#1C252E", borderWidth: 0, borderRadius: 14, padding: 16, marginBottom: 16, alignItems: "center", gap: 0 },
  towingTitle: { fontSize: 14.5, fontWeight: "500" },
  towingHint: { fontSize: 12.5, lineHeight: 18, marginTop: 4, textAlign: "center" },
  towingStars: { gap: 6, paddingVertical: 0, marginTop: 14, marginBottom: 10 },
  towingInput: { minHeight: 80, backgroundColor: "#0C1015", borderColor: "#28313A", borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  towingButton: { minHeight: 0, paddingVertical: 12, borderRadius: 10 },
  towingButtonText: { color: "#151C23", fontSize: 15, fontWeight: "700" },
  towingComment: { fontSize: 12.5, lineHeight: 18, color: "#AAB5C0", fontStyle: "italic", textAlign: "center", marginTop: 4 },
});
const defaultStyles = makeStyles(defaultColors);
const lightStyles = { ...makeStyles(homeColors), ...StyleSheet.create({
  card: { shadowColor: "#172B4D", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2, backgroundColor: homeColors.surfaceAlt, borderWidth: 1, borderColor: homeColors.border, borderRadius: 20, padding: 16, gap: 11 },
  title: { color: homeColors.textPrimary, fontSize: 16, fontWeight: "700", lineHeight: 22},
  hint: { color: homeColors.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: "400"},
  stars: { flexDirection: "row", gap: 12, paddingVertical: 3 },
  input: { minHeight: 84, borderWidth: 1, borderColor: homeColors.border, borderRadius: 11, padding: 12, textAlignVertical: "top", color: homeColors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: "400"},
  comment: { color: homeColors.textSecondary, fontSize: 15, lineHeight: 22, fontWeight: "400"},
  button: { minHeight: 54, backgroundColor: homeColors.primary, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { color: homeColors.white, fontSize: 15, fontWeight: "700", lineHeight: 20},
  disabled: { opacity: 0.48 },
  error: { color: homeColors.busy, fontSize: 13, lineHeight: 19, fontWeight: "400"},
  towingCard: { backgroundColor: homeColors.surfaceAlt, borderWidth: 0, borderRadius: 20, padding: 16, marginBottom: 16, alignItems: "center", gap: 0 },
  towingTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22},
  towingHint: { fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: "center", fontWeight: "400"},
  towingStars: { gap: 6, paddingVertical: 0, marginTop: 14, marginBottom: 10 },
  towingInput: { minHeight: 80, backgroundColor: homeColors.surfaceAlt, borderColor: homeColors.border, borderRadius: 10, padding: 12, fontSize: 15, lineHeight: 22, marginBottom: 14, fontWeight: "400"},
  towingButton: { minHeight: 54, paddingVertical: 12, borderRadius: 10 },
  towingButtonText: { color: homeColors.white, fontSize: 15, fontWeight: "700", lineHeight: 20},
  towingComment: { fontSize: 15, lineHeight: 22, color: homeColors.textSecondary, fontStyle: "italic", textAlign: "center", marginTop: 4, fontWeight: "400"},
}) };
