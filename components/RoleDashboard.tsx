// components/RoleDashboard.tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { logout } from "../services/auth";

export interface DashboardCard {
  label: string;
  onPress?: () => void;
}

interface RoleDashboardProps {
  title: string;
  displayName?: string | null;
  statusLabel?: string;
  cards: DashboardCard[];
}

/**
 * Minimal shared shell for the 4 placeholder role dashboards. Not used by
 * (v_owner) — that dashboard is untouched and stays exactly as it was.
 *
 * Purely for verifying role-based routing right now: title, welcome
 * message, optional status pill, a grid of placeholder cards, and a
 * working logout button. No real data/business logic yet.
 */
export function RoleDashboard({ title, displayName, statusLabel, cards }: RoleDashboardProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch {
      // Even if signOut throws, don't leave the user stuck on a dead button.
      router.replace("/(auth)/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.welcome}>
        Welcome{displayName ? `, ${displayName}` : ""}!
      </Text>

      {statusLabel ? (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      ) : null}

      <View style={styles.cardGrid}>
        {cards.map((card) => (
          <TouchableOpacity
            key={card.label}
            style={styles.card}
            onPress={card.onPress}
            disabled={!card.onPress}
          >
            <Text style={styles.cardText}>{card.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.logoutText}>Log Out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  welcome: { fontSize: 16, color: "#444", marginBottom: 16 },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 20,
  },
  statusText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { fontSize: 15, fontWeight: "600", color: "#1f2937", textAlign: "center" },
  logoutButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutButtonDisabled: { opacity: 0.6 },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});