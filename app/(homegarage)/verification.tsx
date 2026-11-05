import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { auth } from "../../services/firebase";
import { getHomeGarageVerificationProfile, saveHomeGarageVerificationProfile } from "../../services/homeGarageVerificationService";
import { uploadVerificationFile } from "../../services/providerProfileService";

const C = { bg: "#0F52BA", card: "#FFFFFF", text: "#172B4D", muted: "#526277", red: "#0F52BA", border: "#D5DEE9" };
export default function HomeGarageVerification() {
  const router = useRouter(); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [status, setStatus] = useState<string | null>(null); const [validId, setValidId] = useState<{ uri: string; name: string; mimeType?: string | null; size?: number | null } | null>(null); const [form, setForm] = useState({ name: "", contactPerson: "", phone: "" });
  useEffect(() => { const uid = auth.currentUser?.uid; if (!uid) return; getHomeGarageVerificationProfile(uid).then((profile) => { if (profile) { setStatus(profile.verificationStatus); setForm({ name: profile.business.name, contactPerson: profile.business.contactPerson, phone: profile.business.phone }); } }).finally(() => setLoading(false)); }, []);
  const chooseValidId = async () => { const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png"], copyToCacheDirectory: true }); if (!result.canceled) { const file = result.assets[0]; setValidId({ uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size }); } };
  const submit = async () => { const uid = auth.currentUser?.uid; if (!uid || !form.name.trim() || !form.contactPerson.trim() || !form.phone.trim() || !validId) return Alert.alert("Missing information", "Complete all details and upload a valid ID."); setSaving(true); try { const validIdUrl = await uploadVerificationFile(uid, "valid-id", validId); await saveHomeGarageVerificationProfile(uid, { uid, role: "homegarage", business: { name: form.name.trim(), contactPerson: form.contactPerson.trim(), phone: form.phone.trim(), address: "", latitude: 0, longitude: 0 }, documents: { validIdUrl }, verificationStatus: "PENDING" }); setStatus("PENDING"); } catch (error) { Alert.alert("Submission failed", error instanceof Error ? error.message : "Please try again."); } finally { setSaving(false); } };
  if (loading) return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={s.center}><ActivityIndicator color={C.red} /></View></SafeAreaView>;
  if (status === "PENDING" || status === "VERIFIED") return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={s.center}><Text style={s.title}>{status === "VERIFIED" ? "Home Garage verified" : "Verification submitted"}</Text><Text style={s.muted}>{status === "VERIFIED" ? "Your Home Garage profile is verified." : "Your documents are being reviewed."}</Text><TouchableOpacity style={s.primary} onPress={() => router.canGoBack() ? router.back() : router.replace("/(homegarage)/profile")}><Text style={s.primaryText}>Back to Profile</Text></TouchableOpacity></View></SafeAreaView>;
  const input = (key: keyof typeof form, label: string, placeholder: string) => <><Text style={s.label}>{label}</Text><TextInput value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} placeholder={placeholder} placeholderTextColor={C.muted} style={s.input} /></>;
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><StatusBar barStyle="light-content" backgroundColor={C.bg} /><View style={s.header}><Text style={s.headerTitle}>Profile Verification</Text></View><KeyboardAvoidingView style={s.surface} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}><View style={s.card}><Text style={s.muted}>Verify your Home Garage account before going live.</Text>{input("name", "HOME GARAGE NAME", "Business name")}{input("contactPerson", "CONTACT PERSON", "Full name")}{input("phone", "PHONE", "Contact number")}<Text style={s.label}>VALID ID</Text><TouchableOpacity style={s.secondary} onPress={() => void chooseValidId()}><Text style={s.secondaryText}>{validId ? validId.name : "Upload valid ID (JPG or PNG)"}</Text></TouchableOpacity><TouchableOpacity style={s.primary} disabled={saving} onPress={() => void submit()}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Submit for Verification</Text>}</TouchableOpacity></View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { minHeight: 70, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 16, justifyContent: "center", backgroundColor: C.bg },
  headerTitle: { color: "#FFFFFF", fontSize: 20, lineHeight: 26, fontWeight: "800" },
  surface: { flex: 1, backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16 },
  center: { flex: 1, backgroundColor: C.card, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  title: { color: C.text, fontSize: 24, lineHeight: 31, fontWeight: "800", textAlign: "center" },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  label: { color: C.text, fontSize: 13, lineHeight: 19, fontWeight: "600", marginTop: 16, marginBottom: 6 },
  input: { minHeight: 54, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 15, lineHeight: 21 },
  primary: { marginTop: 16, backgroundColor: C.red, borderRadius: 14, minHeight: 54, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  secondary: { minHeight: 54, borderWidth: 1, borderColor: C.border, backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, justifyContent: "center" },
  secondaryText: { color: C.red, fontSize: 14, lineHeight: 20, fontWeight: "700", flexShrink: 1 },
});
