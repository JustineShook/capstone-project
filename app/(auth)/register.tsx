import { Feather } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  PanResponder,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { logout, register } from "../../services/auth";
import { REGISTERABLE_ROLES, type UserRole } from "../../types/user";

const SELECTABLE_ROLES: { label: string; value: UserRole }[] = [
  { label: "Vehicle Owner", value: "owner" },
  { label: "Onsite Mechanic", value: "onsite-mechanic" },
  { label: "Shop owner", value: "shop-owner" },
  { label: "Towing Company", value: "towing-company" },
  { label: "Home Garage", value: "homegarage" },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ providerId?: string; category?: string; timingMode?: string }>();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleRegister() {
    setError(null);
    if (!displayName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!role || !REGISTERABLE_ROLES.includes(role)) {
      setError("Please select a role.");
      return;
    }

    setLoading(true);
    try {
      const profile = await register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
      });
      await logout();
      router.replace({ pathname: "/(auth)/login", params } as any);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={require("../../assets/images/login-all-providers-sapphire.png")} style={styles.background} resizeMode={Platform.OS === "web" && width > height ? "contain" : "cover"}>
    <View style={styles.backgroundShade} />
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F52BA" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.container} onLayout={(event) => setSheetAreaHeight(event.nativeEvent.layout.height)}>
          <View style={styles.hero}>
            
            
            
            <View style={styles.brand}>
              <Text style={styles.brandMark}>V</Text>
              <Text style={styles.brandName}>Ve<Text style={styles.brandRed}>Resc</Text></Text>
            </View>
          </View>

          <Animated.View style={[styles.form, { top: sheetTop }]}>
            <View {...dragHandle.panHandlers} style={styles.dragHandle}>
              <Pressable style={styles.handleButton} onPress={() => snapSheet(settledPosition.current === 0 ? 1 : 0)} accessibilityRole="button" accessibilityLabel="Expand or lower sign up card" accessibilityHint="Drag up or down, or tap to change the card position"><View pointerEvents="none" style={styles.dragBar} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.formContent, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join VeResc and get started</Text>

            <Field onFocus={() => snapSheet(0)} label="Full name" icon="user" placeholder="Enter your full name" value={displayName} onChangeText={setDisplayName} editable={!loading} autoCapitalize="words" returnKeyType="next" />
            <Field onFocus={() => snapSheet(0)} label="Email address" icon="mail" placeholder="Enter your email" value={email} onChangeText={setEmail} editable={!loading} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
            <PasswordField onFocus={() => snapSheet(0)} label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} visible={passwordVisible} toggle={() => setPasswordVisible((v) => !v)} editable={!loading} returnKeyType="next" />
            <PasswordField onFocus={() => snapSheet(0)} label="Confirm password" placeholder="Re-enter your password" value={confirmPassword} onChangeText={setConfirmPassword} visible={confirmVisible} toggle={() => setConfirmVisible((v) => !v)} editable={!loading} returnKeyType="done" />

            <Text style={styles.label}>Account type</Text>
            <TouchableOpacity
              style={styles.roleSelector}
              onPress={() => setRolePickerOpen((open) => !open)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={`Account type: ${SELECTABLE_ROLES.find((item) => item.value === role)?.label ?? "not selected"}. Tap to choose.`}
              accessibilityState={{ expanded: rolePickerOpen }}
            >
              <Text style={[styles.roleSelected, !role && styles.rolePlaceholder]}>{SELECTABLE_ROLES.find((item) => item.value === role)?.label ?? "Select account type"}</Text>
              <Feather name={rolePickerOpen ? "chevron-up" : "chevron-down"} size={19} color="#526277" />
            </TouchableOpacity>
            {rolePickerOpen ? (
              <View style={styles.roleOptions}>
                {SELECTABLE_ROLES.map((item) => {
                  const selected = role === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.roleOption, selected && styles.roleOptionSelected]}
                      onPress={() => {
                        setRole(item.value);
                        setRolePickerOpen(false);
                      }}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.roleText, selected && styles.roleTextActive]}>{item.label}</Text>
                      {selected ? <Feather name="check" size={17} color="#0F52BA" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Already have an account?</Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity><Text style={styles.loginLink}>Log In</Text></TouchableOpacity>
              </Link>
            </View>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ImageBackground>
  );
}

function Field({
  label, icon, placeholder, value, onChangeText, ...inputProps
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
} & Omit<React.ComponentProps<typeof TextInput>, "style" | "placeholder" | "value" | "onChangeText">) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Feather name={icon} size={16} color="#526277" />
        <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#526277" value={value} onChangeText={onChangeText} {...inputProps} />
      </View>
    </View>
  );
}

function PasswordField({
  label, placeholder, value, onChangeText, visible, toggle, ...inputProps
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  toggle: () => void;
} & Omit<React.ComponentProps<typeof TextInput>, "style" | "placeholder" | "value" | "onChangeText" | "secureTextEntry">) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Feather name="lock" size={16} color="#526277" />
        <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#526277" value={value} onChangeText={onChangeText} secureTextEntry={!visible} {...inputProps} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} onPress={toggle} hitSlop={8}>
          <Feather name={visible ? "eye" : "eye-off"} size={17} color="#526277" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, backgroundColor: "#08090b", paddingBottom: 22 },
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
  brandMark: { color: "#FFFFFF", fontSize: 57, lineHeight: 64, fontWeight: "900", fontStyle: "italic", marginRight: 9, textShadowColor: "#0B3D8A", textShadowRadius: 8 },
  brandName: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: -1 },
  brandRed: { color: "#FFFFFF" },
  form: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "#D5DEE9", overflow: "hidden" },
  title: { color: "#172B4D", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { color: "#526277", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 20 },
  fieldGroup: { marginBottom: 17 },
  label: { color: "#172B4D", fontSize: 13, lineHeight: 19, fontWeight: "600", marginBottom: 6 },
  inputShell: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "#D5DEE9", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  input: { flex: 1, minHeight: 52, color: "#172B4D", fontSize: 15, marginLeft: 10, paddingVertical: 10 },
  roleSelector: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#D5DEE9", backgroundColor: "#FFFFFF", marginTop: 1, marginBottom: 12 },
  roleSelected: { color: "#172B4D", fontSize: 15, lineHeight: 21, flexShrink: 1 },
  rolePlaceholder: { color: "#526277" },
  roleOptions: { borderRadius: 12, borderWidth: 1, borderColor: "#D5DEE9", backgroundColor: "#FFFFFF", marginTop: -6, marginBottom: 12, overflow: "hidden" },
  roleOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#D5DEE9" },
  roleOptionSelected: { backgroundColor: "#EAF2FF" },
  roleText: { color: "#526277", fontSize: 15, lineHeight: 21, fontWeight: "500" },
  roleTextActive: { color: "#0F52BA", fontWeight: "700" },
  error: { color: "#9F1239", fontSize: 13, lineHeight: 19, marginTop: -7, marginBottom: 10 },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: "#0F52BA", alignItems: "center", justifyContent: "center", marginTop: 1, paddingHorizontal: 16, paddingVertical: 12 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 22, minHeight: 44 },
  loginPrompt: { color: "#526277", fontSize: 13, lineHeight: 19 },
  loginLink: { color: "#0F52BA", fontSize: 13, lineHeight: 19, fontWeight: "700" },
background: { flex: 1, backgroundColor: "#0F52BA" },backgroundShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 20, 45, 0.58)" },container: { flex: 1, backgroundColor: "transparent" },dragHandle: { minHeight: 44, alignItems: "center", justifyContent: "center", ...Platform.select({ web: { cursor: "ns-resize", touchAction: "none" } as any, default: {} }) },handleButton: { width: "100%", minHeight: 44, alignItems: "center", justifyContent: "center" },dragBar: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#94A3B8" },formContent: { paddingHorizontal: 16, paddingBottom: 24 }});
