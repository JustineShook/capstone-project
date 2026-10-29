import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/owner/theme";
import type { ProviderReview } from "../../data/owner/mockProviders";
import { getProviderReviewSummary } from "../../services/owner/ratingService";

export default function ProviderReviewsScreen() {
  const router = useRouter();
  const { providerId, providerName, rating, reviewCount } = useLocalSearchParams<{
    providerId: string;
    providerName?: string;
    rating?: string;
    reviewCount?: string;
  }>();
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [average, setAverage] = useState(Number(rating) || 0);
  const [count, setCount] = useState(Number(reviewCount) || 0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const returnToProvider = useCallback(() => {
    router.replace("/(v_owner)");
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        returnToProvider();
        return true;
      });
      return () => subscription.remove();
    }, [returnToProvider])
  );

  useEffect(() => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setReviews([]);
    getProviderReviewSummary(providerId)
      .then((summary) => {
        if (!active) return;
        setReviews(summary.reviews);
        setAverage(summary.average);
        setCount(summary.count);
      })
      .catch(() => {
        if (active) {
          setReviews([]);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [providerId]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={returnToProvider} accessibilityRole="button" accessibilityLabel="Back to provider" style={styles.backButton}>
          <Ionicons name="chevron-back" size={23} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Reviews</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{providerName || "Provider"}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : loadFailed ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={30} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Reviews unavailable</Text>
            <Text style={styles.emptyCopy}>Please check your connection and try again.</Text>
          </View>
        ) : reviews.length ? (
          <>
          <View style={styles.summary}>
            <Ionicons name="star" size={20} color={colors.rating} />
            <Text style={styles.average}>{average.toFixed(1)}</Text>
            <Text style={styles.count}>{count} {count === 1 ? "review" : "reviews"}</Text>
          </View>
          <View style={styles.list}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <Text style={styles.stars}>{"★".repeat(Math.max(0, Math.min(5, Math.round(review.rating)))).padEnd(5, "☆")}</Text>
                {review.comment ? <Text style={styles.comment}>“{review.comment}”</Text> : <Text style={styles.noComment}>No written comment.</Text>}
                <View style={styles.footer}>
                  <Text style={styles.author}>{review.customerName}</Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.date}>{review.date}</Text>
                </View>
              </View>
            ))}
          </View>
          </>
        ) : (
          <>
            <View style={styles.summary}>
              <Ionicons name="star" size={20} color={colors.rating} />
              <Text style={styles.average}>{average.toFixed(1)}</Text>
              <Text style={styles.count}>{count} {count === 1 ? "review" : "reviews"}</Text>
            </View>
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyCopy}>Customer reviews will appear here.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, alignItems: "center" },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2, maxWidth: "100%" },
  content: { padding: 18, paddingBottom: 32 },
  summary: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  average: { color: colors.textPrimary, fontSize: 22, fontWeight: "900" },
  count: { color: colors.textSecondary, fontSize: 14, marginLeft: 2 },
  loader: { marginTop: 36 },
  list: { gap: 12 },
  reviewCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, gap: 8 },
  stars: { color: colors.rating, fontSize: 15, letterSpacing: 1 },
  comment: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  noComment: { color: colors.textSecondary, fontSize: 14, fontStyle: "italic" },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
  author: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  dot: { color: colors.textMuted, fontSize: 14 },
  date: { color: colors.textSecondary, fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: 52, gap: 9 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  emptyCopy: { color: colors.textSecondary, fontSize: 14 },
});
