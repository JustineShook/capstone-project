import { Stack } from "expo-router";
import { ImageBackground, Platform, StyleSheet, useWindowDimensions, View } from "react-native";

export default function AuthLayout() {
  const { width, height } = useWindowDimensions();

  return (
    <ImageBackground
      source={require("../../assets/images/login-all-providers-sapphire.png")}
      style={styles.background}
      resizeMode={Platform.OS === "web" && width > height ? "contain" : "cover"}
    >
      <View pointerEvents="none" style={styles.backgroundShade} />
      <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: styles.screen }} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#0F52BA" },
  backgroundShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 20, 45, 0.58)" },
  screen: { backgroundColor: "transparent" },
});
