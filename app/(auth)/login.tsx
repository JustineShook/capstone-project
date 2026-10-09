import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getDashboardRoute, getUserProfile, login } from "../../services/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        setError("Signed in, but no profile was found for this account.");
        return;
      }

      const route = getDashboardRoute(profile.role);
      if (!route) {
        setError("Your account role isn't recognized. Please contact support.");
        return;
      }
      router.replace(route as any);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#08090b" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.hero}>
            <View style={styles.swooshOuter} />
            <View style={styles.swooshInner} />
            <View style={styles.dashes}>
              <View style={styles.dash} />
              <View style={[styles.dash, styles.dashTwo]} />
              <View style={[styles.dash, styles.dashThree]} />
            </View>
            <View style={styles.brand}>
              <Text style={styles.brandMark}>V</Text>
              <Text style={styles.brandName}>Ve<Text style={styles.brandRed}>Resc</Text></Text>
            </View>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputShell}>
                <Feather name="mail" size={16} color="#9ba0a6" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#81868d"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputShell}>
                <Feather name="lock" size={16} color="#9ba0a6" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#81868d"
                  secureTextEntry={!passwordVisible}
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  hitSlop={8}
                >
                  <Feather name={passwordVisible ? "eye" : "eye-off"} size={17} color="#a3a8ae" />
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgot}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <View style={styles.divider} />
              <Text style={styles.signupPrompt}>New to VeResc?</Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity><Text style={styles.signupLink}>Sign Up</Text></TouchableOpacity>
              </Link>
              <View style={styles.divider} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#08090b" },
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: "#08090b" },
  hero: { height: "29%", minHeight: 175, maxHeight: 245, overflow: "hidden", justifyContent: "center" },
  swooshOuter: {
    position: "absolute", width: 560, height: 220, borderRadius: 280,
    borderBottomWidth: 3, borderColor: "#a90e20", left: -225, top: -126,
    transform: [{ rotate: "-13deg" }],
  },
  swooshInner: {
    position: "absolute", width: 460, height: 195, borderRadius: 230,
    borderBottomWidth: 2, borderColor: "#58101a", left: -188, top: -106,
    transform: [{ rotate: "-14deg" }],
  },
  dashes: { position: "absolute", right: 4, top: 0, width: 90, height: 155, transform: [{ rotate: "34deg" }] },
  dash: { position: "absolute", right: 18, top: 0, width: 1, height: 77, backgroundColor: "#b7192b", opacity: 0.9 },
  dashTwo: { right: 37, top: 20, height: 86, opacity: 0.65 },
  dashThree: { right: 56, top: 42, height: 93, opacity: 0.45 },
  brand: { flexDirection: "row", alignItems: "center", marginLeft: 30, marginTop: 25 },
  brandMark: { color: "#ed1c2e", fontSize: 57, lineHeight: 64, fontWeight: "900", fontStyle: "italic", marginRight: 9, textShadowColor: "#7b0b17", textShadowRadius: 8 },
  brandName: { color: "#f5f5f6", fontSize: 26, fontWeight: "800", letterSpacing: -1 },
  brandRed: { color: "#ed1c2e" },
  form: { flex: 1, paddingHorizontal: 16, paddingTop: 2 },
  title: { color: "#f5f5f6", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { color: "#90949a", fontSize: 16, marginTop: 2, marginBottom: 24 },
  fieldGroup: { marginBottom: 17 },
  label: { color: "#e3e4e6", fontSize: 13, marginBottom: 6 },
  inputShell: {
    height: 54, borderRadius: 10, borderWidth: 1, borderColor: "#303237",
    backgroundColor: "#1a1b1f", flexDirection: "row", alignItems: "center", paddingHorizontal: 11,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  input: { flex: 1, height: "100%", color: "#f5f5f6", fontSize: 18, marginLeft: 13, paddingVertical: 0 },
  forgot: { alignSelf: "flex-end", marginTop: -8, marginBottom: 29, paddingVertical: 3 },
  forgotText: { color: "#ed1c2e", fontSize: 13, fontWeight: "600" },
  error: { color: "#ff737d", fontSize: 14, marginTop: -7, marginBottom: 10 },
  button: { height: 44, borderRadius: 9, backgroundColor: "#ed1c2e", alignItems: "center", justifyContent: "center", marginTop: 1 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  signupRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 31, gap: 5 },
  divider: { height: 1, backgroundColor: "#26272b", flex: 1 },
  signupPrompt: { color: "#96999e", fontSize: 12, marginLeft: 3 },
  signupLink: { color: "#ed1c2e", fontSize: 12, fontWeight: "600", marginRight: 3 },
});
