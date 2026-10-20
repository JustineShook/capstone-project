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
const COLORS = {
  primary: "#F52239",
  darkRed: "#C9152A",
  white: "#F4F6F8",
  background: "#0C1015",
  textPrimary: "#F4F6F8",
  textSecondary: "#AAB5C0",
  border: "#28313A",
};

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
        <View>
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
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.replace("/(v_owner)/profile")} accessibilityRole="button" accessibilityLabel="Back to profile">
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>YOUR ACCOUNT</Text>
          <Text style={styles.pageTitle}>Personal Information</Text>
        </View>
        {!editing && <Pressable style={styles.editButton} onPress={() => setEditing(true)} accessibilityRole="button"><Ionicons name="create-outline" size={17} color={COLORS.white} /><Text style={styles.editButtonText}>Edit</Text></Pressable>}
        {editing && <View style={styles.editSpacer} />}
      </View>
      <ScrollView
        style={styles.container}
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
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 4 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#151C23", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerCopy: { flex: 1, gap: 2 },
  headerEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: COLORS.primary },
  editSpacer: { width: 61 },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C252E",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
  },
  pageTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  editButton: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 11, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 9 },
  editButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "800" },

  // Profile card — matches components/profile.tsx exactly
  profileCard: { backgroundColor: "#151C23", borderRadius: 17, padding: 17, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 17, borderWidth: 1, borderColor: COLORS.border },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  accountCopy: { flex: 1, gap: 3 },
  accountEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: COLORS.primary },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 0,
  },
  roleBadge: { marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#321A20", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // Section labels
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 2 },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#321A20", alignItems: "center", justifyContent: "center" },
  sectionSubtitle: { color: "#7E8B97", fontSize: 11, marginLeft: 4 },

  // Rectangular grouped card
  card: {
    backgroundColor: "#151C23",
    borderRadius: 15,
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#321A20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 4,
  },

  note: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginLeft: 4,
  },
  formCard: { backgroundColor: "#151C23", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 18 },
  formField: { marginBottom: 15 },
  formLabelRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 },
  formLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  formInput: { minHeight: 46, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, backgroundColor: "#0C1015", paddingHorizontal: 12, color: COLORS.textPrimary, fontSize: 14 },
  formInputDisabled: { color: COLORS.textSecondary, backgroundColor: "#1C252E" },
  fieldHint: { color: COLORS.textSecondary, fontSize: 11, marginTop: 5 },
  formActions: { flexDirection: "row", gap: 10, marginTop: 5 },
  cancelButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  cancelText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "700" },
  saveButton: { flex: 1, minHeight: 48, backgroundColor: COLORS.primary, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  saveDisabled: { opacity: 0.7 },
  saveText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
});
