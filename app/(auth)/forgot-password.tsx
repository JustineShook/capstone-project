import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Animated, ImageBackground, PanResponder, Pressable, ScrollView, StatusBar, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resetPassword } from "../../services/auth";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);

  const [sheetAreaHeight, setSheetAreaHeight] = useState(0);
  const sheetTop = useRef(new Animated.Value(200)).current;
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
    }
  }, [sheetAreaHeight, sheetTop, snapPoints]);

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

  async function submit() {
    if (submitting.current || sent) return;
    setError(null);
    const address = email.trim();
    if (!address) {
      setError("Enter the email address for your VeResc account.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      await resetPassword(address);
      setSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send reset link. Please try again.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={require("../../assets/images/login-all-providers-sapphire.png")} style={s.background} resizeMode={Platform.OS === "web" && width > height ? "contain" : "cover"}>
    <View style={s.backgroundShade} />
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0F52BA" />
      <KeyboardAvoidingView style={s.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.content} onLayout={(event) => setSheetAreaHeight(event.nativeEvent.layout.height)}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(auth)/login")} accessibilityRole="button" style={s.back}>
          <Text style={s.backText}>‹  Back</Text>
        </TouchableOpacity>
        <Animated.View style={[s.form, { top: sheetTop }]}>
            <View {...dragHandle.panHandlers} style={s.dragHandle}>
              <Pressable style={s.handleButton} onPress={() => snapSheet(settledPosition.current === 0 ? 1 : 0)} accessibilityRole="button" accessibilityLabel="Expand or lower password reset card" accessibilityHint="Drag up or down, or tap to change the card position"><View pointerEvents="none" style={s.dragBar} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.brand}>VeResc</Text>
          <Text style={s.title}>Reset your password</Text>
          {sent ? (
            <>
              <Text style={s.copy} accessibilityLiveRegion="polite">If an account exists for this email, you’ll receive a password reset link.</Text>
              <Text style={s.copy}>Use the link to set a new VeResc password, then return to login.</Text>
              <TouchableOpacity style={s.button} onPress={() => router.canGoBack() ? router.back() : router.replace("/(auth)/login")} accessibilityRole="button">
                <Text style={s.buttonText}>Back to login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
          <Text style={s.copy}>Enter your account email and we’ll send instructions to reset your password.</Text>
          <View style={s.fieldGroup}>
          <Text style={s.label}>Email address</Text>
          <View style={s.inputShell}>
          <TextInput
            style={s.input}
            onFocus={() => snapSheet(0)}
            placeholder="Email address"
            placeholderTextColor="#526277"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!loading}
            accessibilityLabel="Email address"
          />
          </View>
          </View>
          {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
          <TouchableOpacity style={[s.button, loading && s.disabled]} onPress={submit} disabled={loading} accessibilityRole="button">
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send reset link</Text>}
          </TouchableOpacity>
            </>
          )}
            </ScrollView>
        </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#0F52BA" },
  backgroundShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 20, 45, 0.58)" },
  safe: { flex: 1, backgroundColor: "transparent" },
  keyboard: { flex: 1 },
  content: { flex: 1, backgroundColor: "transparent" },
  form: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "#D5DEE9", overflow: "hidden" },
  dragHandle: { minHeight: 44, alignItems: "center", justifyContent: "center", ...Platform.select({ web: { cursor: "ns-resize", touchAction: "none" } as any, default: {} }) },
  handleButton: { width: "100%", minHeight: 44, alignItems: "center", justifyContent: "center" },
  dragBar: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#94A3B8" },
  formContent: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { color: "#172B4D", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  copy: { color: "#526277", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 20 },
  fieldGroup: { marginBottom: 17 },
  label: { color: "#172B4D", fontSize: 13, lineHeight: 19, fontWeight: "600", marginBottom: 6 },
  inputShell: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "#D5DEE9", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  input: { flex: 1, minHeight: 52, color: "#172B4D", fontSize: 15, marginLeft: 10, paddingVertical: 10 },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: "#0F52BA", alignItems: "center", justifyContent: "center", marginTop: 1, paddingHorizontal: 16, paddingVertical: 12 },
  disabled: { opacity: 0.65 },
  error: { color: "#9F1239", fontSize: 13, lineHeight: 19, marginTop: -7, marginBottom: 10 },
  buttonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  back: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, alignSelf: "flex-start" },
  backText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "600" },
  brand: { color: "#0F52BA", fontSize: 18, lineHeight: 25, fontWeight: "800", marginBottom: 16 },
});
