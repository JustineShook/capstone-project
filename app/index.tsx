import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { getDashboardRoute } from "../services/auth";
import { useBrandColor } from "../hooks/useBrandColor";

const splashImage = require("../assets/images/login-all-providers-sapphire.png");

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, userProfile, loading } = useAuth();
  const brandColor = useBrandColor();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user) {
    // Keep the existing signed-in routing based on the user's profile role.
    const route = getDashboardRoute(userProfile?.role);
    if (!route) {
      return <Redirect href="/(auth)/login" />;
    }

    return <Redirect href={route as any} />;
  }

  const buttonBottom = Math.max(insets.bottom + 44, height * 0.2);

  return (
    <ImageBackground
      source={splashImage}
      style={styles.container}
      resizeMode={Platform.OS === "web" && width > height ? "contain" : "cover"}
      accessible
      accessibilityLabel="VeResc roadside assistance home screen"
    >
      <StatusBar hidden />
      <View style={styles.backgroundShade} />
      <View pointerEvents="none" style={[styles.brand, { top: insets.top, bottom: buttonBottom + 64 }]}>
        <Text style={[styles.brandMark, { color: brandColor }]} accessibilityLabel="VeResc V logo">V</Text>
        <Text style={styles.brandName}>VeResc</Text>
      </View>
      <View style={[styles.actionContainer, { paddingBottom: buttonBottom }]}>
        <TouchableOpacity
          style={styles.getStartedButton}
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={() => router.replace("/(v_owner)" as any)}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F52BA",
  },
  backgroundShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 20, 45, 0.58)" },
  brand: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  brandMark: { fontSize: 200, lineHeight: 220, fontWeight: "900", fontStyle: "italic", marginBottom: -18, textShadowColor: "#0B3D8A", textShadowRadius: 8 },
  brandName: { color: "#FFFFFF", fontSize: 38, lineHeight: 46, fontWeight: "800", letterSpacing: -0.8, textAlign: "center" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
  },
  getStartedButton: {
    minWidth: 200,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F52BA",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0F52BA",
  },
  getStartedText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
});
