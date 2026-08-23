// app/(onsite-mechanic)/service-history.tsx
import { Feather } from "@expo/vector-icons";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  primary: "#D32F2F",
  primaryMuted: "#FCE8E8",
  background: "#FFFFFF",
  sectionBackground: "#F7F7F8",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  success: "#2E7D32",
  successMuted: "#E8F5E9",
};

interface SummaryStat {
  label: string;
  value: string;
}

interface CompletedRecord {
  id: string;
  customerName: string;
  vehicle: string;
  serviceType: string;
  location: string;
  date: string;
  amount: string;
}

const SUMMARY_STATS: SummaryStat[] = [
  { label: "Completed Jobs", value: "24" },
  { label: "This Week", value: "8" },
  { label: "This Month", value: "24" },
  { label: "Total Earnings", value: "\u20B118,450" },
];

const COMPLETED_RECORDS: CompletedRecord[] = [
  {
    id: "hist-001",
    customerName: "John Ramirez",
    vehicle: "Toyota Innova 2018",
    serviceType: "Brake Inspection",
    location: "Quezon City",
    date: "August 21, 2026",
    amount: "\u20B1800",
  },
  {
    id: "hist-002",
    customerName: "Sofia Mendoza",
    vehicle: "Honda City 2020",
    serviceType: "Oil Change",
    location: "Cubao, Quezon City",
    date: "August 20, 2026",
    amount: "\u20B1950",
  },
  {
    id: "hist-003",
    customerName: "Mark Villanueva",
    vehicle: "Ford Ranger 2019",
    serviceType: "Battery Replacement",
    location: "Project 4, Quezon City",
    date: "August 18, 2026",
    amount: "\u20B11,200",
  },
];

export default function ServiceHistoryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryGrid}>
          {SUMMARY_STATS.map((stat) => (
            <View key={stat.label} style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stat.value}</Text>
              <Text style={styles.summaryLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Records */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>COMPLETED SERVICES</Text>
        </View>

        {COMPLETED_RECORDS.map((record) => (
          <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeaderRow}>
              <View style={styles.customerNameBadge}>
                <Text style={styles.customerName}>{record.customerName}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>COMPLETED</Text>
              </View>
            </View>
            <Text style={styles.vehicle}>{record.vehicle}</Text>

            <View style={styles.recordDivider} />

            <View style={styles.recordDetailRow}>
              <Feather name="tool" size={14} color={COLORS.textMuted} />
              <Text style={styles.recordDetailText}>{record.serviceType}</Text>
            </View>
            <View style={styles.recordDetailRow}>
              <Feather name="map-pin" size={14} color={COLORS.textMuted} />
              <Text style={styles.recordDetailText}>{record.location}</Text>
            </View>
            <View style={styles.recordDetailRow}>
              <Feather name="calendar" size={14} color={COLORS.textMuted} />
              <Text style={styles.recordDetailText}>{record.date}</Text>
            </View>
            <View style={styles.recordDetailRow}>
              <Feather name="credit-card" size={14} color={COLORS.textMuted} />
              <Text style={styles.recordDetailText}>{record.amount}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primary,
  },
  summaryValue: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  summaryLabel: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 },

  sectionHeaderRow: { marginTop: 22, marginBottom: 10 },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },

  recordCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recordHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerNameBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  customerName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  statusBadge: {
    backgroundColor: COLORS.successMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "700", color: COLORS.success, letterSpacing: 0.4 },
  vehicle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  recordDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  recordDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  recordDetailText: { fontSize: 13, color: COLORS.text },
});