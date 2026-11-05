import { homeColors } from "../../constants/owner/homeTheme";
import { KeyboardAvoidingView, Platform, StatusBar } from "react-native";
// app/(v_owner)/personal-information.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { onAuthStateChanged, updateProfile, type User as FirebaseUser } from "firebase/auth";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getUserProfile } from "@/services/auth";
import { auth } from "@/services/firebase";
import { getOwnerVerificationProfile, updateOwnerContactDetails } from "@/services/ownerVerificationProfileService";
import type { OwnerVerificationProfile } from "@/types/ownerVerificationProfile";
import type { UserProfile, UserRole } from "@/types/user";

// Same design tokens as components/profile.tsx — keep in sync if that
// palette changes, or move both to a shared theme file.
const COLORS = { ...homeColors, darkRed: homeColors.primaryDark };

function formatRole(role: UserRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "onsite-mechanic":
      return "Indie Mechanic";
    case "shop-owner":
      return "Shop Owner";
    case "towing-company":
      return "Towing Company";
    case "homegarage":
      return "Home Garage";
    default:
      return role;
  }
}

// Same row component as Profile — display-only rows just omit onPress,
// but still render the chevron so the two screens look identical.
type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  isLast?: boolean;
};

function InfoRow({ icon, label, value, isLast }: RowProps) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowLabel}>{label}</Text>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

// ---------------------------------------------------------------------------
export default function PersonalInformationScreen() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verificationProfile, setVerificationProfile] = useState<OwnerVerificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", cityMunicipality: "" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const [userProfile, ownerVerification] = await Promise.all([
          getUserProfile(user.uid),
          getOwnerVerificationProfile(user.uid),
        ]);
        setProfile(userProfile);
        setVerificationProfile(ownerVerification);
        setForm({
          fullName: ownerVerification?.personal.fullName || userProfile?.displayName || user.displayName || "",
          phone: ownerVerification?.personal.phone || user.phoneNumber || "",
          address: ownerVerification?.personal.address || "",
          cityMunicipality: ownerVerification?.personal.cityMunicipality || "",
        });
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const displayName = verificationProfile?.personal.fullName || profile?.displayName || firebaseUser?.displayName || "Unnamed User";
  const email = profile?.email || firebaseUser?.email || "No email on file";
  const roleLabel = profile ? formatRole(profile.role) : "—";
  const phone = verificationProfile?.personal.phone || "Not provided";
  const address = verificationProfile?.personal.address || "Not provided";
  const cityMunicipality = verificationProfile?.personal.cityMunicipality || "Not provided";

  async function saveChanges() {
    const user = auth.currentUser;
    if (!user || !verificationProfile) {
      Alert.alert("Profile unavailable", "Complete account verification before editing personal details.");
      return;
    }
    const personal = { fullName: form.fullName.trim(), phone: form.phone.trim(), address: form.address.trim(), cityMunicipality: form.cityMunicipality.trim() };
    if (!personal.fullName || !personal.phone || !personal.address || !personal.cityMunicipality) {
      Alert.alert("Missing information", "Please complete your name, phone number, address, and city.");
      return;
    }
    setSaving(true);
    try {
      await updateOwnerContactDetails(user.uid, personal);
      await updateProfile(user, { displayName: personal.fullName });
      setVerificationProfile({ ...verificationProfile, personal });
      setProfile(profile ? { ...profile, displayName: personal.fullName } : profile);
      setEditing(false);
    } catch (error) {
      Alert.alert("Could not update profile", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <SafeAreaView style={[styles.header, { backgroundColor: "#0F52BA", borderBottomWidth: 0, height: undefined, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 }]} edges={["top"]}><StatusBar barStyle="light-content" backgroundColor="#0F52BA" />
        <Pressable style={[styles.backButton, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" }]} onPress={() => router.replace("/(v_owner)/profile")} accessibilityRole="button" accessibilityLabel="Back to profile">
          <Ionicons name="chevron-back" size={22} color={"#FFFFFF"} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerEyebrow, { color: "#FFFFFF" }]}>YOUR ACCOUNT</Text>
          <Text style={[styles.pageTitle, { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "700", flexShrink: 1 }]}>Personal Information</Text>
        </View>
        {!editing && <Pressable style={styles.editButton} onPress={() => setEditing(true)} accessibilityRole="button"><Ionicons name="create-outline" size={17} color={"#FFFFFF"} /><Text style={[styles.editButtonText, { color: "#FFFFFF" }]}>Edit</Text></Pressable>}
        {editing && <View style={styles.editSpacer} />}
      </SafeAreaView>
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: "#0F52BA" }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        style={[styles.container, { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card — identical hero to components/profile.tsx */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={40} color={COLORS.white} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountEyebrow}>VEHICLE OWNER</Text>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primary} />
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        {editing ? <>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><Ionicons name="create-outline" size={18} color={COLORS.primary} /></View><View><SectionLabel text="Edit contact details" /><Text style={styles.sectionSubtitle}>Keep your contact information up to date.</Text></View></View>
          <View style={styles.formCard}>
            <FormField label="Full Name" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} icon="person-outline" />
            <FormField label="Email Address" value={email} icon="mail-outline" editable={false} hint="Email cannot be changed here." />
            <FormField label="Phone Number" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} icon="call-outline" keyboardType="phone-pad" />
            <FormField label="Address" value={form.address} onChange={(address) => setForm({ ...form, address })} icon="location-outline" />
            <FormField label="City / Municipality" value={form.cityMunicipality} onChange={(cityMunicipality) => setForm({ ...form, cityMunicipality })} icon="business-outline" />
            <View style={styles.formActions}>
              <Pressable style={styles.cancelButton} onPress={() => { setEditing(false); setForm({ fullName: displayName === "Unnamed User" ? "" : displayName, phone: phone === "Not provided" ? "" : phone, address: address === "Not provided" ? "" : address, cityMunicipality: cityMunicipality === "Not provided" ? "" : cityMunicipality }); }} disabled={saving}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.saveButton, saving && styles.saveDisabled]} onPress={() => void saveChanges()} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="checkmark" size={18} color={COLORS.white} /><Text style={styles.saveText}>Save Changes</Text></>}
              </Pressable>
            </View>
          </View>
        </> : <>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><Ionicons name="person-outline" size={18} color={COLORS.primary} /></View><View><SectionLabel text="Personal details" /><Text style={styles.sectionSubtitle}>Your contact and account information.</Text></View></View>
          <View style={styles.card}>
            <InfoRow icon="person-outline" label="Full Name" value={displayName} />
            <InfoRow icon="mail-outline" label="Email Address" value={email} />
            <InfoRow icon="call-outline" label="Phone Number" value={phone} />
            <InfoRow icon="location-outline" label="Address" value={address} />
            <InfoRow icon="business-outline" label="City / Municipality" value={cityMunicipality} />
            <InfoRow icon="shield-checkmark-outline" label="Role" value={roleLabel} isLast />
          </View>
        </>}

        <View style={{ height: 24 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({ label, value, onChange, icon, editable = true, keyboardType = "default", hint }: { label: string; value: string; onChange?: (value: string) => void; icon: keyof typeof Ionicons.glyphMap; editable?: boolean; keyboardType?: "default" | "phone-pad"; hint?: string }) {
  return <View style={styles.formField}>
    <View style={styles.formLabelRow}><Ionicons name={icon} size={16} color={COLORS.primary} /><Text style={styles.formLabel}>{label}</Text></View>
    <TextInput value={value} onChangeText={onChange} editable={editable} keyboardType={keyboardType} autoCapitalize={label === "Full Name" ? "words" : "sentences"} style={[styles.formInput, !editable && styles.formInputDisabled]} placeholder={`Enter ${label.toLowerCase()}`} placeholderTextColor="#77838E" />
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  rowCopy: { flex: 1, minWidth: 0 },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 4 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#151C23", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerCopy: { flex: 1, gap: 2 , minWidth: 0},
  headerEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: COLORS.primary },
  editSpacer: { width: 61 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C252E",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 0,
  minHeight: 44},
  pageTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  editButton: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 11, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 9 , minHeight: 44},
  editButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "800" },

  // Profile card — matches components/profile.tsx exactly
  profileCard: { backgroundColor: homeColors.surface, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 17, borderWidth: 1, borderColor: COLORS.border },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  accountCopy: { flex: 1, gap: 3 },
  accountEyebrow: { fontSize: 13, fontWeight: "800", letterSpacing: 1, color: COLORS.primary , lineHeight: 19},
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  lineHeight: 25},
  profileEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 0,
  lineHeight: 19},
  roleBadge: { marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EAF1FC", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 , flexWrap: "wrap"},
  roleBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  lineHeight: 19},

  // Section labels
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 3,
  lineHeight: 22},
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 2 },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#EAF1FC", alignItems: "center", justifyContent: "center" },
  sectionSubtitle: { color: homeColors.textSecondary, fontSize: 13, marginLeft: 4 , lineHeight: 19},

  // Rectangular grouped card
  card: {
    backgroundColor: homeColors.surface,
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  flex: 1, minWidth: 0},
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EAF1FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  lineHeight: 19},
  rowValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginTop: 4,
  lineHeight: 22},

  note: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginLeft: 4,
  },
  formCard: { backgroundColor: homeColors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 18 },
  formField: { marginBottom: 15 },
  formLabelRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 },
  formLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "500" , lineHeight: 19},
  formInput: { minHeight: 54, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: homeColors.surface, paddingHorizontal: 16, color: COLORS.textPrimary, fontSize: 15 , lineHeight: 22, paddingVertical: 14},
  formInputDisabled: { color: COLORS.textSecondary, backgroundColor: homeColors.surfaceAlt },
  fieldHint: { color: COLORS.textSecondary, fontSize: 13, marginTop: 5 , lineHeight: 19},
  formActions: { flexDirection: "row", gap: 12, marginTop: 5 , flexWrap: "wrap"},
  cancelButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  cancelText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: "700" , lineHeight: 20},
  saveButton: { flex: 1, minHeight: 54, backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 , minWidth: 150, paddingHorizontal: 16, paddingVertical: 14},
  saveDisabled: { opacity: 0.7 },
  saveText: { color: COLORS.white, fontSize: 15, fontWeight: "700" , lineHeight: 20},
});
