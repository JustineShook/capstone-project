import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getDashboardRoute, register } from "../../services/auth";
import { REGISTERABLE_ROLES, type UserRole } from "../../types/user";

const SELECTABLE_ROLES: { label: string; value: UserRole }[] = [
  { label: "Vehicle Owner", value: "owner" },
  { label: "Onsite Mechanic", value: "onsite-mechanic" },
  { label: "Auto Shop", value: "shop-owner" },
  { label: "Towing Company", value: "towing-company" },
  { label: "Parking Space", value: "homegarage" },
];

export default function RegisterScreen() {
  const router = useRouter();
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
      const route = getDashboardRoute(profile.role);
      if (!route) {
        setError("Account created, but your role isn't recognized. Please contact support.");
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
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join VeResc and get started</Text>

            <Field label="Full name" icon="user" placeholder="Enter your full name" value={displayName} onChangeText={setDisplayName} editable={!loading} autoCapitalize="words" returnKeyType="next" />
            <Field label="Email address" icon="mail" placeholder="Enter your email" value={email} onChangeText={setEmail} editable={!loading} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
            <PasswordField label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} visible={passwordVisible} toggle={() => setPasswordVisible((v) => !v)} editable={!loading} returnKeyType="next" />
            <PasswordField label="Confirm password" placeholder="Re-enter your password" value={confirmPassword} onChangeText={setConfirmPassword} visible={confirmVisible} toggle={() => setConfirmVisible((v) => !v)} editable={!loading} returnKeyType="done" />

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
              <Feather name={rolePickerOpen ? "chevron-up" : "chevron-down"} size={19} color="#a3a8ae" />
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
                      {selected ? <Feather name="check" size={17} color="#ed1c2e" /> : null}
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
        <Feather name={icon} size={16} color="#9ba0a6" />
        <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#81868d" value={value} onChangeText={onChangeText} {...inputProps} />
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
        <Feather name="lock" size={16} color="#9ba0a6" />
        <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#81868d" value={value} onChangeText={onChangeText} secureTextEntry={!visible} {...inputProps} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} onPress={toggle} hitSlop={8}>
          <Feather name={visible ? "eye" : "eye-off"} size={17} color="#a3a8ae" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#08090b" },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, backgroundColor: "#08090b", paddingBottom: 22 },
  hero: { height: 175, overflow: "hidden", justifyContent: "center" },
  swooshOuter: { position: "absolute", width: 560, height: 220, borderRadius: 280, borderBottomWidth: 3, borderColor: "#a90e20", left: -225, top: -126, transform: [{ rotate: "-13deg" }] },
  swooshInner: { position: "absolute", width: 460, height: 195, borderRadius: 230, borderBottomWidth: 2, borderColor: "#58101a", left: -188, top: -106, transform: [{ rotate: "-14deg" }] },
  dashes: { position: "absolute", right: 4, top: 0, width: 90, height: 155, transform: [{ rotate: "34deg" }] },
  dash: { position: "absolute", right: 18, top: 0, width: 1, height: 77, backgroundColor: "#b7192b", opacity: 0.9 },
  dashTwo: { right: 37, top: 20, height: 86, opacity: 0.65 },
  dashThree: { right: 56, top: 42, height: 93, opacity: 0.45 },
  brand: { flexDirection: "row", alignItems: "center", marginLeft: 30, marginTop: 25 },
  brandMark: { color: "#ed1c2e", fontSize: 57, lineHeight: 64, fontWeight: "900", fontStyle: "italic", marginRight: 9, textShadowColor: "#7b0b17", textShadowRadius: 8 },
  brandName: { color: "#f5f5f6", fontSize: 26, fontWeight: "800", letterSpacing: -1 },
  brandRed: { color: "#ed1c2e" },
  form: { paddingHorizontal: 16, paddingTop: 0 },
  title: { color: "#f5f5f6", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  subtitle: { color: "#90949a", fontSize: 16, marginTop: 2, marginBottom: 18 },
  fieldGroup: { marginBottom: 13 },
  label: { color: "#e3e4e6", fontSize: 13, marginBottom: 6 },
  inputShell: { height: 54, borderRadius: 10, borderWidth: 1, borderColor: "#303237", backgroundColor: "#1a1b1f", flexDirection: "row", alignItems: "center", paddingHorizontal: 11, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  input: { flex: 1, height: "100%", color: "#f5f5f6", fontSize: 18, marginLeft: 13, paddingVertical: 0 },
  roleSelector: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "#303237", backgroundColor: "#1a1b1f", marginTop: 1, marginBottom: 12 },
  roleSelected: { color: "#f5f5f6", fontSize: 17 },
  rolePlaceholder: { color: "#81868d" },
  roleOptions: { borderRadius: 10, borderWidth: 1, borderColor: "#303237", backgroundColor: "#151619", marginTop: -6, marginBottom: 12, overflow: "hidden" },
  roleOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#28292d" },
  roleOptionSelected: { backgroundColor: "#281317" },
  roleText: { color: "#c3c5c9", fontSize: 15, fontWeight: "500" },
  roleTextActive: { color: "#fff", fontWeight: "700" },
  error: { color: "#ff737d", fontSize: 14, marginBottom: 10 },
  button: { height: 46, borderRadius: 9, backgroundColor: "#ed1c2e", alignItems: "center", justifyContent: "center", marginTop: 2 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 22 },
  loginPrompt: { color: "#96999e", fontSize: 13 },
  loginLink: { color: "#ed1c2e", fontSize: 13, fontWeight: "600" },
});
