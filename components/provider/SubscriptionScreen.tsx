import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { DEMO_SUBSCRIPTION_PLANS } from "../../constants/demoSubscriptionPlans";
import {
  DemoSubscriptionMapSyncError,
  simulateDemoSubscriptionActivation,
  subscribeToMyDemoSubscription,
  subscribeToMyDemoSubscriptionHistory,
  syncMyDemoSubscriptionMapExpiry,
} from "../../services/demoSubscriptionService";
import type { DemoSubscription, DemoSubscriptionPlanId, DemoSubscriptionTransaction } from "../../types/demoSubscription";

const DEFAULT_COLORS = { bg: "#090A0C", card: "#17191D", line: "#292C31", text: "#F7F7F8", muted: "#A6ADB5", red: "#F51F3B", green: "#55C98A", subtle: "#202329", noticeBg: "#292317", noticeLine: "#5B4926", noticeText: "#FFE2A5", warning: "#FFD27B", error: "#FF9AA8", modalBg: "rgba(0,0,0,0.8)" };
const MECHANIC_COLORS = { bg: "#FFFFFF", card: "#FFFFFF", line: "#D5DEE9", text: "#172B4D", muted: "#526277", red: "#0F52BA", green: "#166534", subtle: "#F1F5F9", noticeBg: "#EFF6FF", noticeLine: "#BFDBFE", noticeText: "#1E3A5F", warning: "#9A6700", error: "#B4233A", modalBg: "rgba(15,23,42,0.55)" };
type SubscriptionColors = typeof DEFAULT_COLORS;
const dateLabel = (value: Date) => value.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
const amountLabel = (value: number) => `₱${value.toLocaleString("en-PH")}`;

interface DemoCardDetails { name: string; number: string; expiry: string; cvv: string }
type DemoCardErrors = Partial<Record<keyof DemoCardDetails, string>>;
const EMPTY_DEMO_CARD: DemoCardDetails = { name: "", number: "", expiry: "", cvv: "" };

export function validateDemoCard(details: DemoCardDetails, now = new Date()): DemoCardErrors {
  const errors: DemoCardErrors = {};
  if (!details.name.trim()) errors.name = "Enter a fictional cardholder name.";
  if (!/^\d{16}$/.test(details.number.trim())) errors.number = "Enter exactly 16 demo digits.";
  const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(details.expiry.trim());
  if (!expiry) errors.expiry = "Enter a valid expiry in MM/YY format.";
  else if ((2000 + Number(expiry[2])) * 12 + Number(expiry[1]) - 1 < now.getFullYear() * 12 + now.getMonth()) {
    errors.expiry = "Expiry cannot be in a past month.";
  }
  if (!/^\d{3}$/.test(details.cvv.trim())) errors.cvv = "Enter exactly 3 demo CVV digits.";
  return errors;
}

export function SubscriptionScreen({ appearance = "default" }: { appearance?: "default" | "mechanic" | "homegarage" } = {}) {
  const homeGarageAppearance = appearance === "homegarage";
  const mechanicAppearance = appearance === "mechanic" || homeGarageAppearance;
  const C = mechanicAppearance ? MECHANIC_COLORS : DEFAULT_COLORS;
  const baseStyles = createStyles(C, mechanicAppearance);
  const s = homeGarageAppearance ? { ...baseStyles, ...homeGarageStyles } : baseStyles;
  const [selected, setSelected] = useState<DemoSubscriptionPlanId>("monthly");
  const [subscription, setSubscription] = useState<DemoSubscription | null>(null);
  const [history, setHistory] = useState<DemoSubscriptionTransaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmedExpiry, setConfirmedExpiry] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const operationInFlight = useRef(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardDetails, setCardDetails] = useState<DemoCardDetails>(EMPTY_DEMO_CARD);
  const [cardErrors, setCardErrors] = useState<DemoCardErrors>({});

  useEffect(() => {
    const stopSubscription = subscribeToMyDemoSubscription(setSubscription, cause => setError(cause.message));
    const stopHistory = subscribeToMyDemoSubscriptionHistory(setHistory, cause => setError(cause.message));
    return () => { stopSubscription(); stopHistory(); };
  }, []);

  const active = !!subscription && subscription.expiresAt.getTime() > Date.now();
  const selectedPlan = DEMO_SUBSCRIPTION_PLANS[selected];

  function clearAndCloseCardForm() {
    setCardDetails(EMPTY_DEMO_CARD);
    setCardErrors({});
    setShowCardForm(false);
  }

  function closeCardForm() {
    if (!operationInFlight.current) clearAndCloseCardForm();
  }

  function openCardForm() {
    if (operationInFlight.current || active) return;
    setCardDetails(EMPTY_DEMO_CARD);
    setCardErrors({});
    setError("");
    setShowCardForm(true);
  }

  function updateCardField(field: keyof DemoCardDetails, value: string) {
    setCardDetails(previous => ({ ...previous, [field]: value }));
    setCardErrors(previous => ({ ...previous, [field]: undefined }));
  }

  async function simulate() {
    if (operationInFlight.current || active) return;
    const validation = validateDemoCard(cardDetails);
    setCardErrors(validation);
    if (Object.keys(validation).length > 0) return;
    operationInFlight.current = true;
    setBusy(true);
    setError("");
    setConfirmedExpiry(null);
    setSyncMessage("");
    setSyncFailed(false);
    try {
      setConfirmedExpiry(await simulateDemoSubscriptionActivation(selected));
      clearAndCloseCardForm();
    } catch (cause) {
      if (cause instanceof DemoSubscriptionMapSyncError) {
        clearAndCloseCardForm();
        setConfirmedExpiry(cause.expiresAt);
        setSyncFailed(true);
        setSyncMessage(cause.message);
      } else {
        setError(`Activation failed: ${cause instanceof Error ? cause.message : "Demo activation could not be completed."}`);
      }
    } finally {
      setBusy(false);
      operationInFlight.current = false;
    }
  }

  async function retrySync() {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setSyncing(true);
    setError("");
    setSyncMessage("");
    setSyncFailed(false);
    try {
      const status = await syncMyDemoSubscriptionMapExpiry();
      setSyncMessage(status === "missing_listing"
        ? "No existing listing to sync. Your subscription and history are unchanged."
        : "Map expiry synced. Your subscription dates and history are unchanged.");
    } catch (cause) {
      setSyncFailed(true);
      setSyncMessage(`Map sync failed. Your subscription and history are unchanged. ${cause instanceof Error ? cause.message : "Please try again."}`);
    } finally {
      setSyncing(false);
      operationInFlight.current = false;
    }
  }

  return <SafeAreaView style={s.safe}>
    {mechanicAppearance ? <View style={s.pageHeader}><View><Text style={s.eyebrow}>PROVIDER ACCOUNT</Text><Text style={s.title}>Subscription</Text></View><Feather name="credit-card" size={24} color="#FFFFFF" /></View> : null}
    <ScrollView style={mechanicAppearance ? s.scroll : undefined} contentContainerStyle={s.content}>
      {!mechanicAppearance ? <View style={s.header}><View><Text style={s.eyebrow}>PROVIDER ACCOUNT</Text><Text style={s.title}>Subscription</Text></View><Feather name="credit-card" size={24} color={C.red} /></View> : null}
      <View style={s.notice}><Feather name="info" size={18} color={C.warning} /><Text style={s.noticeText}>Demo only—no real money is charged.</Text></View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>Choose a demo plan</Text>
        {(Object.values(DEMO_SUBSCRIPTION_PLANS)).map(plan => <TouchableOpacity key={plan.id} accessibilityRole="radio" accessibilityState={{ selected: selected === plan.id }} style={[s.plan, selected === plan.id && s.planSelected]} onPress={() => setSelected(plan.id)}>
          <View style={[s.radio, selected === plan.id && s.radioSelected]}>{selected === plan.id && <View style={s.radioDot} />}</View>
          <View style={s.planCopy}><Text style={s.planTitle}>{plan.label}</Text><Text style={s.secondary}>{plan.durationDays} days</Text></View>
          <Text style={s.amount}>{amountLabel(plan.amount)}</Text>
        </TouchableOpacity>)}
        <Text style={s.secondary}>Selected: {selectedPlan.label} · {amountLabel(selectedPlan.amount)} · {selectedPlan.durationDays} days</Text>
        <TouchableOpacity style={[s.button, (busy || syncing || active) && s.buttonDisabled]} disabled={busy || syncing || active} onPress={openCardForm}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.buttonText}>{active ? "Already Active" : subscription ? "Simulate Renewal" : "Simulate Payment"}</Text>}
        </TouchableOpacity>
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        {confirmedExpiry ? <Text accessibilityLiveRegion="polite" style={s.success}>Demo activation recorded. Expires {dateLabel(confirmedExpiry)}.</Text> : null}
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>Current status</Text>
        {subscription ? <>
          <Text style={[s.status, { color: active ? C.green : C.warning }]}>{active ? "Active demo subscription" : "Expired demo subscription"}</Text>
          <Text style={s.secondary}>{DEMO_SUBSCRIPTION_PLANS[subscription.plan].label} · {amountLabel(subscription.demoAmount)}</Text>
          <Text style={s.secondary}>Started {dateLabel(subscription.startedAt)} · Expires {dateLabel(subscription.expiresAt)}</Text>
        </> : <Text style={s.secondary}>No demo subscription history yet.</Text>}
        {(subscription || confirmedExpiry) ? <>
          <Text style={s.secondary}>Retry Sync copies your existing subscription expiry to an existing listing. No demo payment or renewal is recorded.</Text>
          <TouchableOpacity accessibilityRole="button" style={[s.button, (busy || syncing) && s.buttonDisabled]} disabled={busy || syncing} onPress={() => void retrySync()}>
            {syncing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.buttonText}>Retry Sync</Text>}
          </TouchableOpacity>
        </> : null}
        {syncMessage ? <Text accessibilityRole={syncFailed ? "alert" : undefined} accessibilityLiveRegion="polite" style={syncFailed ? s.error : s.success}>{syncMessage}</Text> : null}
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>Demo transaction history</Text>
        {history.length === 0 ? <Text style={s.secondary}>No demo transactions recorded.</Text> : history.map(item => <View key={item.id} style={s.historyRow}>
          <View style={s.historyIcon}><Feather name="check" size={16} color={C.green} /></View>
          <View style={s.historyCopy}><Text style={s.historyTitle}>{item.type === "renewal" ? "Manual demo renewal" : "Demo activation"} · {DEMO_SUBSCRIPTION_PLANS[item.plan].label}</Text><Text style={s.secondary}>{amountLabel(item.demoAmount)} · {item.durationDays} days · {dateLabel(item.createdAt)}</Text><Text style={s.secondary}>Expires {dateLabel(item.expiresAt)} · Demo only</Text></View>
        </View>)}
      </View>
      <Text style={s.footnote}>This demo subscription does not change listing, discovery, booking, or account access.</Text>
    </ScrollView>
    {showCardForm ? <Modal visible transparent animationType="fade" onRequestClose={closeCardForm}>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalContent}>
          <View style={s.card}>
            <Text style={s.sectionTitle}>Demo card details</Text>
            <Text style={s.noticeText}>Demo only—no real money is charged. Format validation only; use fictional details.</Text>
            <Text style={s.secondary}>{selectedPlan.label} · {amountLabel(selectedPlan.amount)} · {selectedPlan.durationDays} days</Text>
            {([
              ["name", "Fictional cardholder name", "Demo Provider", 100],
              ["number", "Demo card number", "16 digits", 16],
              ["expiry", "Demo expiry", "MM/YY", 5],
              ["cvv", "Demo CVV", "3 digits", 3],
            ] as const).map(([field, label, placeholder, maxLength]) => <View key={field} style={s.field}>
              <Text style={s.secondary}>{label}</Text>
              <TextInput accessibilityLabel={label} value={cardDetails[field]} onChangeText={value => updateCardField(field, value)}
                placeholder={placeholder} placeholderTextColor={C.muted} style={s.input} maxLength={maxLength}
                keyboardType={field === "number" || field === "cvv" ? "number-pad" : "default"}
                autoCapitalize={field === "name" ? "words" : "none"} autoCorrect={false} autoComplete="off"
                textContentType="none" importantForAutofill="no" secureTextEntry={field === "cvv"} editable={!busy} />
              {cardErrors[field] ? <Text accessibilityRole="alert" style={s.error}>{cardErrors[field]}</Text> : null}
            </View>)}
            {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
            <TouchableOpacity accessibilityRole="button" style={[s.button, busy && s.buttonDisabled]} disabled={busy} onPress={() => void simulate()}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.buttonText}>{subscription ? "Confirm Demo Renewal" : "Confirm Demo Payment"}</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[s.button, s.cancelButton, busy && s.buttonDisabled]} disabled={busy} onPress={closeCardForm}>
              <Text style={[s.buttonText, homeGarageAppearance && { color: C.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal> : null}
  </SafeAreaView>;
}

function createStyles(C: SubscriptionColors, mechanic: boolean) { return StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: C.modalBg }, modalContent: { flexGrow: 1, justifyContent: "center", padding: 18 },
  field: { gap: 5 }, input: { minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: mechanic ? 12 : 10, paddingHorizontal: 12, color: C.text, backgroundColor: C.bg },
  cancelButton: { backgroundColor: mechanic ? C.subtle : C.line },
  safe: { flex: 1, backgroundColor: mechanic ? C.red : C.bg }, scroll: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }, content: { padding: mechanic ? 16 : 18, gap: 14, paddingBottom: 30 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pageHeader: { minHeight: 82, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, backgroundColor: C.red, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, eyebrow: { color: mechanic ? "#DCEBFF" : C.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, title: { color: mechanic ? "#FFFFFF" : C.text, fontSize: 25, lineHeight: 32, fontWeight: "900", marginTop: 2 },
  notice: { flexDirection: "row", alignItems: "center", gap: 9, padding: 13, borderWidth: 1, borderColor: C.noticeLine, backgroundColor: C.noticeBg, borderRadius: mechanic ? 16 : 12 }, noticeText: { color: C.noticeText, fontSize: 14, lineHeight: 20, fontWeight: "800", flexShrink: 1 },
  card: { padding: mechanic ? 18 : 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: mechanic ? 20 : 16, gap: 12, ...(mechanic ? { shadowColor: "#172B4D", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 } : {}) }, sectionTitle: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: "800" }, plan: { minHeight: 72, borderRadius: mechanic ? 14 : 12, borderWidth: 1, borderColor: C.line, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 }, planSelected: { borderColor: C.red }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.muted, alignItems: "center", justifyContent: "center" }, radioSelected: { borderColor: C.red }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red }, planCopy: { flex: 1, minWidth: 0 }, planTitle: { color: C.text, fontWeight: "800", fontSize: 14, lineHeight: 20, flexShrink: 1 }, amount: { color: C.text, fontWeight: "900", fontSize: 16 }, secondary: { color: C.muted, fontSize: 12, lineHeight: 18 },
  button: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.red, marginTop: 2 }, buttonDisabled: { opacity: 0.55 }, buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, error: { color: C.error, fontSize: 13, lineHeight: 19 }, success: { color: C.green, fontWeight: "700", fontSize: 13, lineHeight: 19 }, status: { fontWeight: "900", fontSize: 15 }, historyRow: { flexDirection: "row", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }, historyIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: mechanic ? "#EAF6EE" : "#193326", alignItems: "center", justifyContent: "center" }, historyCopy: { flex: 1, gap: 1, minWidth: 0 }, historyTitle: { color: C.text, fontSize: 13, lineHeight: 19, fontWeight: "700", flexShrink: 1 }, footnote: { color: C.muted, fontSize: 11, lineHeight: 16, textAlign: "center", paddingHorizontal: 8 },
}); }

const homeGarageStyles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: 24 },
  pageHeader: { minHeight: 70, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16, backgroundColor: "#0F52BA", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#FFFFFF", fontSize: 24, lineHeight: 31, fontWeight: "800", marginTop: 5 },
  card: { padding: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DEE9", borderRadius: 20, gap: 12, shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sectionTitle: { color: "#172B4D", fontSize: 16, lineHeight: 22, fontWeight: "700" },
  planTitle: { color: "#172B4D", fontSize: 15, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  amount: { color: "#172B4D", fontSize: 18, lineHeight: 25, fontWeight: "700" },
  secondary: { color: "#526277", fontSize: 13, lineHeight: 19 },
  noticeText: { color: "#1E3A5F", fontSize: 13, lineHeight: 19, fontWeight: "600", flexShrink: 1 },
  input: { minHeight: 54, borderWidth: 1, borderColor: "#D5DEE9", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: "#172B4D", backgroundColor: "#FFFFFF", fontSize: 15, lineHeight: 21 },
  button: { minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0F52BA", marginTop: 2, paddingHorizontal: 16, paddingVertical: 12 },
  buttonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  modalContent: { flexGrow: 1, justifyContent: "center", padding: 16 },
  field: { gap: 6 },
  status: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
});
