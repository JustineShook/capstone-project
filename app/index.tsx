import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { getDashboardRoute } from "../services/auth";

const splashImage = require("../assets/images/veresc-landing.png");

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user, userProfile, loading } = useAuth();

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

  const buttonBottom = Math.max(insets.bottom + 28, height * 0.15);

  return (
    <ImageBackground
      source={splashImage}
      style={styles.container}
      resizeMode="cover"
      accessible
      accessibilityLabel="VeResc roadside assistance home screen"
    >
      <StatusBar hidden />
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
    backgroundColor: "#000000",
  },
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C50022",
    paddingHorizontal: 32,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FF294B",
  },
  getStartedText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
