import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resetPassword } from "../../services/auth";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const address = email.trim();
    if (!address) {
      Alert.alert("Email required", "Enter the email address for your VeResc account.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(address);
      Alert.alert("Check your email", "If an account uses this address, Firebase will send a password reset link.", [
        { text: "Back to sign in", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Could not send reset link", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.content} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={s.back}>
          <Text style={s.backText}>‹  Back</Text>
        </TouchableOpacity>
        <View style={s.form}>
          <Text style={s.brand}>VeResc</Text>
          <Text style={s.title}>Reset your password</Text>
          <Text style={s.copy}>Enter your account email and we’ll send instructions to reset your password.</Text>
          <TextInput
            style={s.input}
            placeholder="Email address"
            placeholderTextColor="#81868d"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!loading}
          />
          <TouchableOpacity style={[s.button, loading && s.disabled]} onPress={() => void submit()} disabled={loading} accessibilityRole="button">
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send reset link</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#08090b" },
  content: { flex: 1, padding: 24 },
  back: { paddingVertical: 8, alignSelf: "flex-start" },
  backText: { color: "#fff", fontSize: 16 },
  form: { flex: 1, justifyContent: "center", gap: 16 },
  brand: { color: "#ed1c2e", fontSize: 18, fontWeight: "800" },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  copy: { color: "#a3a8ae", fontSize: 15, lineHeight: 22 },
  input: { color: "#fff", borderColor: "#3a3d42", borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16 },
  button: { backgroundColor: "#ed1c2e", borderRadius: 12, minHeight: 50, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.65 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
