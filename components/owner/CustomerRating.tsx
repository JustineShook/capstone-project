import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getRating, submitRating, type BookingRating, type RatedBookingType } from "../../services/owner/ratingService";

export function CustomerRating({ bookingId, bookingType, providerName }: { bookingId: string; bookingType: Extract<RatedBookingType, "shop" | "parking">; providerName: string }) {
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

  return <View style={s.card}>
    <Text style={s.title}>{saved ? "Thank you for your feedback!" : "Rate this Provider"}</Text>
    <Text style={s.hint}>{saved ? "Your feedback helps improve VeResc." : `How was your experience with ${providerName}?`}</Text>
    {loading ? <Text style={s.hint}>Loading your review…</Text> : <>
      <View style={s.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Rate ${value} out of 5 stars`} accessibilityState={{ selected: value <= stars, disabled: Boolean(saved) }} disabled={Boolean(saved)} onPress={() => setStars(value)} hitSlop={6}>
        <Ionicons name={value <= stars ? "star" : "star-outline"} size={32} color={value <= stars ? "#E6A800" : "#9E9E9E"} />
      </Pressable>)}</View>
      {saved ? comment ? <Text style={s.comment}>“{comment}”</Text> : null : <TextInput accessibilityLabel="Written feedback (optional)" value={comment} onChangeText={setComment} maxLength={1000} multiline placeholder="Share a few words (optional)" placeholderTextColor="#8B8684" style={s.input} />}
      {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!saved && <Pressable accessibilityRole="button" accessibilityState={{ disabled: stars === 0 || saving }} disabled={stars === 0 || saving} onPress={() => void send()} style={[s.button, (stars === 0 || saving) && s.disabled]}>
        <Text style={s.buttonText}>{saving ? "Submitting…" : "Submit Rating"}</Text>
      </Pressable>}
    </>}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEE0E0", borderRadius: 14, padding: 16, gap: 11 },
  title: { color: "#1A1A1A", fontSize: 17, fontWeight: "700" },
  hint: { color: "#6B6B6B", fontSize: 14, lineHeight: 20 },
  stars: { flexDirection: "row", gap: 12, paddingVertical: 3 },
  input: { minHeight: 84, borderWidth: 1, borderColor: "#EEE0E0", borderRadius: 11, padding: 12, textAlignVertical: "top", color: "#1A1A1A", fontSize: 15 },
  comment: { color: "#4E4E4E", fontSize: 15, lineHeight: 22 },
  button: { minHeight: 48, backgroundColor: "#D32F2F", borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.48 },
  error: { color: "#B3261E", fontSize: 14, lineHeight: 20 },
});
