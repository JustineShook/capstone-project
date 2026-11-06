import { Feather } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getDashboardRoute, getUserProfile, login } from "../../services/auth";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ providerId?: string; category?: string; timingMode?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheetAreaHeight, setSheetAreaHeight] = useState(0);
  const sheetTop = useRef(new Animated.Value(200)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardOffset = useRef(new Animated.Value(24)).current;
  const dragStart = useRef(200);
  const settledPosition = useRef(0);
  const snapPoints = useMemo(() => [
    sheetAreaHeight * 0.2,
    Math.max(sheetAreaHeight * 0.2, sheetAreaHeight - 140),
  ], [sheetAreaHeight]);

  const snapSheet = (position: number) => {
    settledPosition.current = position;
    Animated.spring(sheetTop, {
      toValue: snapPoints[position],
      useNativeDriver: false,
      damping: 24,
      stiffness: 220,
      mass: 0.8,
      overshootClamping: true,
    }).start();
  };

  useEffect(() => {
    if (sheetAreaHeight > 0) {
      sheetTop.stopAnimation();
      sheetTop.setValue(snapPoints[settledPosition.current]);
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 260, useNativeDriver: false }),
        Animated.spring(cardOffset, { toValue: 0, damping: 22, stiffness: 210, useNativeDriver: false }),
      ]).start();
    }
  }, [sheetAreaHeight, sheetTop, snapPoints, cardOpacity, cardOffset]);

  const dragHandle = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => sheetTop.stopAnimation((value) => { dragStart.current = value; }),
    onPanResponderMove: (_, gesture) => {
      sheetTop.setValue(Math.max(snapPoints[0], Math.min(snapPoints[1], dragStart.current + gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const projected = Math.max(snapPoints[0], Math.min(snapPoints[1], dragStart.current + gesture.dy + gesture.vy * 120));
      const nearest = snapPoints.reduce((best, point, index) => Math.abs(point - projected) < Math.abs(snapPoints[best] - projected) ? index : best, 0);
      snapSheet(nearest);
    },
    onPanResponderTerminate: () => snapSheet(settledPosition.current),
  });

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
      if (profile.role === "owner" && params.providerId) {
        router.replace({ pathname: "/(v_owner)", params: {
          selectedProviderId: params.providerId,
          ...(params.category ? { selectedCategory: params.category } : {}),
          ...(params.timingMode ? { discoveryMode: params.timingMode } : {}),
        } } as any);
      } else router.replace(route as any);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.background}>
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F52BA" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container} onLayout={(event) => setSheetAreaHeight(event.nativeEvent.layout.height)}>
          <View style={styles.hero}>
            <View style={styles.brand} accessible accessibilityLabel="VeResc logo">
              <Image source={require("../../assets/images/veresc-silver-v.png")} style={styles.brandMark} resizeMode="contain" />
              <Text style={styles.brandWordmark}>Ve<Text style={styles.brandAccent}>Resc</Text></Text>
            </View>
          </View>

          <Animated.View style={[styles.form, { top: sheetTop, opacity: cardOpacity, transform: [{ translateY: cardOffset }] }]}>
            <View {...dragHandle.panHandlers} style={styles.dragHandle}>
              <Pressable style={styles.handleButton} onPress={() => snapSheet(settledPosition.current === 0 ? 1 : 0)} accessibilityRole="button" accessibilityLabel="Expand or lower login card" accessibilityHint="Drag up or down, or tap to change the card position"><View pointerEvents="none" style={styles.dragBar} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.formContent, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputShell}>
                <Feather name="mail" size={16} color="#526277" />
                <TextInput
                  style={styles.input}
                  onFocus={() => snapSheet(0)}
                  placeholder="Enter your email"
                  placeholderTextColor="#526277"
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
                <Feather name="lock" size={16} color="#526277" />
                <TextInput
                  style={styles.input}
                  onFocus={() => snapSheet(0)}
                  placeholder="Enter your password"
                  placeholderTextColor="#526277"
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
                  <Feather name={passwordVisible ? "eye" : "eye-off"} size={17} color="#526277" />
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
              <TouchableOpacity onPress={() => router.replace({ pathname: "/(auth)/register", params })}><Text style={styles.signupLink}>Sign Up</Text></TouchableOpacity>
              <View style={styles.divider} />
            </View>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "transparent" },
  safeArea: { flex: 1, backgroundColor: "transparent" },
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: "transparent" },
  hero: { height: "29%", minHeight: 175, maxHeight: 245, overflow: "hidden", justifyContent: "flex-start" },
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
  brand: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", marginLeft: 24, marginTop: 8 },
  brandMark: { width: 58, height: 66, marginRight: -2, tintColor: "#FFFFFF" },
  brandWordmark: { color: "#F3F1EB", fontSize: 30, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
  brandAccent: { color: "#91D5FF" },
  form: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "#D5DEE9", overflow: "hidden" },
  dragHandle: { minHeight: 44, alignItems: "center", justifyContent: "center", ...Platform.select({ web: { cursor: "ns-resize", touchAction: "none" } as any, default: {} }) },
  handleButton: { width: "100%", minHeight: 44, alignItems: "center", justifyContent: "center" },
  dragBar: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#94A3B8" },
  formContent: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { color: "#172B4D", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { color: "#526277", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 20 },
  fieldGroup: { marginBottom: 17 },
  label: { color: "#172B4D", fontSize: 13, lineHeight: 19, fontWeight: "600", marginBottom: 6 },
  inputShell: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "#D5DEE9", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  input: { flex: 1, minHeight: 52, color: "#172B4D", fontSize: 15, marginLeft: 10, paddingVertical: 10 },
  forgot: { alignSelf: "flex-end", marginTop: -8, marginBottom: 29, paddingVertical: 3 },
  forgotText: { color: "#0F52BA", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  error: { color: "#9F1239", fontSize: 13, lineHeight: 19, marginTop: -7, marginBottom: 10 },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: "#0F52BA", alignItems: "center", justifyContent: "center", marginTop: 1, paddingHorizontal: 16, paddingVertical: 12 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  signupRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 31, gap: 5 },
  divider: { height: 1, backgroundColor: "#D5DEE9", flex: 1 },
  signupPrompt: { color: "#526277", fontSize: 12, lineHeight: 18, marginLeft: 3 },
  signupLink: { color: "#0F52BA", fontSize: 12, lineHeight: 18, fontWeight: "700", marginRight: 3 },
});
