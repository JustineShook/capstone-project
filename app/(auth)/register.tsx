// app/(auth)/register.tsx
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getDashboardRoute, register } from "../../services/auth";
import { REGISTERABLE_ROLES, type UserRole } from "../../types/user";

// Admin accounts are provisioned separately (not self-registered), so only
// these four roles are selectable at signup.
const SELECTABLE_ROLES: { label: string; value: UserRole }[] = [
  { label: "Vehicle Owner", value: "owner" },
  { label: "Onsite Mechanic", value: "onsite-mechanic" },
  { label: "Auto Shop", value: "shop-owner" },
  { label: "Towing Company", value: "towing-company" },
];

export default function RegisterScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("owner");
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
    if (!REGISTERABLE_ROLES.includes(role)) {
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
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={displayName}
        onChangeText={setDisplayName}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
      />

      <View style={styles.roleRow}>
        {SELECTABLE_ROLES.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.roleChip, role === r.value && styles.roleChipActive]}
            onPress={() => setRole(r.value)}
            disabled={loading}
          >
            <Text style={role === r.value ? styles.roleTextActive : styles.roleText}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </TouchableOpacity>

      <Link href="/(auth)/login" style={styles.link}>
        Already have an account? Log in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  roleChip: {
    flexBasis: "45%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  roleChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  roleText: { color: "#333" },
  roleTextActive: { color: "#fff", fontWeight: "600" },

  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#dc2626", marginBottom: 8 },
  link: { color: "#2563eb", marginTop: 16, textAlign: "center" },
});