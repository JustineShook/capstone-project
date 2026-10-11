import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacySecurityScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(v_owner)/profile")} accessibilityRole="button"><Text style={s.back}>‹ Back</Text></TouchableOpacity>
        <Text style={s.title}>Privacy & Security</Text>
      </View>
      <View style={s.content}>
        <Text style={s.heading}>Keep your account secure</Text>
        <Text style={s.copy}>Use a strong, unique password and keep access to your account email. VeResc uses your account and booking information to provide app features.</Text>
        <TouchableOpacity style={s.button} onPress={() => router.push("/(auth)/forgot-password")} accessibilityRole="button">
          <Text style={s.buttonText}>Reset account password</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0c0e" },
  header: { minHeight: 56, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 22 },
  back: { color: "#ed1c2e", fontSize: 16 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  content: { padding: 22, gap: 16 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700" },
  copy: { color: "#b8bbc0", fontSize: 15, lineHeight: 23 },
  button: { backgroundColor: "#ed1c2e", padding: 15, borderRadius: 12, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
