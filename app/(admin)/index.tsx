import { Feather } from "@expo/vector-icons";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../services/firebase";

type ProviderRole = "owner" | "onsite-mechanic" | "shop-owner" | "towing-company" | "homegarage";
type Decision = "VERIFIED" | "REJECTED";
type Submission = {
  id: string;
  uid: string;
  role: ProviderRole;
  name: string;
  status: string;
  data: DocumentData;
  snapshot: QueryDocumentSnapshot<DocumentData>;
};

const profileCollectionByRole: Record<ProviderRole, string> = {
  owner: "ownerProfile",
  "onsite-mechanic": "providerProfile",
  "shop-owner": "shopVerification",
  "towing-company": "towingCompanyProfile",
  homegarage: "homeGarageVerification",
};
const roleLabels: Record<ProviderRole, string> = {
  owner: "Vehicle owner",
  "onsite-mechanic": "Onsite mechanic",
  "shop-owner": "Auto shop",
  "towing-company": "Towing company",
  homegarage: "Parking provider",
};

function nestedString(data: DocumentData, parent: string, key: string): string {
  const value = data[parent];
  if (value && typeof value === "object" && typeof value[key] === "string") return value[key];
  return "";
}

function submissionName(role: ProviderRole, data: DocumentData): string {
  if (role === "shop-owner") return nestedString(data, "business", "name") || "Auto shop";
  if (role === "towing-company") return nestedString(data, "company", "companyName") || "Towing company";
  if (role === "homegarage") return nestedString(data, "business", "name") || "Parking provider";
  return nestedString(data, "personal", "fullName") || roleLabels[role];
}

function collectDocumentUrls(value: unknown, key = ""): { label: string; url: string }[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => collectDocumentUrls(item, `${key} ${index + 1}`));
  return Object.entries(value as Record<string, unknown>).flatMap(([childKey, child]) => {
    if (typeof child === "string" && /url$/i.test(childKey) && /^https:\/\//i.test(child)) {
      return [{ label: childKey.replace(/Url$/i, "").replace(/([A-Z])/g, " $1"), url: child }];
    }
    return collectDocumentUrls(child, childKey);
  });
}

export default function AdminDashboard() {
  const [claimChecked, setClaimChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSubmissions = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in with your administrator account to continue.");
      const token = await getIdTokenResult(user, true);
      const adminClaim = token.claims.admin === true;
      setIsAdmin(adminClaim);
      setClaimChecked(true);
      if (!adminClaim) {
        setSubmissions([]);
        return;
      }

      const groups = Object.entries(profileCollectionByRole) as [ProviderRole, string][];
      const results = await Promise.all(groups.map(async ([role, group]) => {
        const snapshot = await getDocs(query(collectionGroup(db, group), where("verificationStatus", "==", "PENDING")));
        return snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            uid: typeof data.uid === "string" ? data.uid : item.ref.parent.parent?.id ?? "",
            role,
            name: submissionName(role, data),
            status: typeof data.verificationStatus === "string" ? data.verificationStatus : "PENDING",
            data,
            snapshot: item,
          } satisfies Submission;
        }).filter((item) => item.uid.length > 0);
      }));
      setSubmissions(results.flat().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load pending reviews.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setClaimChecked(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => { void loadSubmissions(); });
    return unsubscribe;
  }, [loadSubmissions]);

  const review = async (submission: Submission, decision: Decision, rejectionReason = "") => {
    setSaving(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Your session expired. Sign in again.");
      const now = serverTimestamp();
      const notificationRef = doc(collection(db, "users", submission.uid, "accountStatusNotifications"));
      const profileRef = submission.snapshot.ref;
      const batch = writeBatch(db);
      const reviewFields = {
        verificationStatus: decision,
        reviewedAt: now,
        reviewedBy: user.uid,
        rejectionReason: decision === "REJECTED" ? rejectionReason.trim() : "",
        lastStatusNotificationId: notificationRef.id,
      };

      batch.update(profileRef, reviewFields);

      // Shop approval is reflected in both the private submission and the
      // existing provider profile used by its dashboard and listing.
      if (submission.role === "shop-owner") {
        const providerRef = doc(db, "providers", submission.uid);
        const business = submission.data.business ?? {};
        batch.update(providerRef, {
          ...reviewFields,
          ...(decision === "VERIFIED" ? {
            businessName: business.name,
            phone: business.phone,
            address: business.address,
            latitude: business.latitude,
            longitude: business.longitude,
          } : {}),
          verified: decision === "VERIFIED",
        });
      }

      const listingRef = doc(db, "providerListings", submission.uid);
      const listing = await getDoc(listingRef);
      if (listing.exists()) batch.update(listingRef, { visibility: "inactive" });

      batch.set(notificationRef, {
        notificationId: notificationRef.id,
        providerId: submission.uid,
        providerRole: submission.role,
        status: decision,
        previousStatus: submission.status,
        title: decision === "VERIFIED" ? "Verification approved" : "Verification needs changes",
        message: decision === "VERIFIED"
          ? "Your verification has been approved. You can now continue setting up your provider profile."
          : "Your verification was not approved. Review the reason and update your submission.",
        reason: decision === "REJECTED" ? rejectionReason.trim() : "",
        isRead: false,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const historyRef = doc(collection(db, "providerVerificationHistory"));
      batch.set(historyRef, {
        providerId: submission.uid,
        providerName: submission.name,
        role: submission.role,
        decision,
        reviewedAt: now,
        reviewedBy: user.uid,
      });

      await batch.commit();
      setSelected(null);
      setRejecting(null);
      setReason("");
      await loadSubmissions(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#101114" />
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>VERESC ADMIN</Text><Text style={styles.title}>Verification reviews</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh reviews" onPress={() => void loadSubmissions(true)} style={styles.refresh}>
          <Feather name="refresh-cw" size={19} color="#f5f5f6" />
        </Pressable>
      </View>

      {!claimChecked || loading ? <View style={styles.center}><ActivityIndicator color="#ed1c2e" /><Text style={styles.muted}>Loading admin access…</Text></View>
        : !auth.currentUser ? <View style={styles.notice}><Text style={styles.noticeTitle}>Sign in required</Text><Text style={styles.muted}>Sign in with your administrator account to review submissions.</Text></View>
        : !isAdmin ? <View style={styles.notice}><Feather name="shield" size={25} color="#ed1c2e" /><Text style={styles.noticeTitle}>Admin permission is missing</Text><Text style={styles.muted}>This account needs the Firebase Auth custom claim admin: true. After it is assigned, sign out and back in, then reopen this screen.</Text></View>
        : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSubmissions(true)} tintColor="#ed1c2e" />}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.count}>{submissions.length} pending {submissions.length === 1 ? "submission" : "submissions"}</Text>
          {submissions.length === 0 && !error ? <View style={styles.notice}><Feather name="check-circle" size={26} color="#72d29b" /><Text style={styles.noticeTitle}>You’re all caught up</Text><Text style={styles.muted}>New provider submissions will appear here.</Text></View> : null}
          {submissions.map((item) => <Pressable key={`${item.role}-${item.uid}`} style={styles.card} onPress={() => setSelected(item)}>
            <View style={styles.cardTop}><View style={styles.avatar}><Feather name={item.role === "owner" ? "user" : "briefcase"} size={18} color="#ed1c2e" /></View><View style={styles.cardText}><Text style={styles.cardName}>{item.name}</Text><Text style={styles.cardRole}>{roleLabels[item.role]}</Text></View><Feather name="chevron-right" size={19} color="#92949b" /></View>
            <Text style={styles.uid}>Account: {item.uid}</Text>
          </Pressable>)}
        </ScrollView>}

      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.scrim}><View style={styles.sheet}>
          <View style={styles.sheetHeader}><View><Text style={styles.eyebrow}>{selected ? roleLabels[selected.role] : ""}</Text><Text style={styles.sheetTitle}>{selected?.name}</Text></View><Pressable onPress={() => setSelected(null)}><Feather name="x" size={23} color="#f5f5f6" /></Pressable></View>
          <ScrollView style={styles.details}>
            <Text style={styles.uid}>Account: {selected?.uid}</Text>
            {selected ? collectDocumentUrls(selected.data).map((item) => <Pressable key={item.url} style={styles.docLink} onPress={() => void Linking.openURL(item.url)}><Feather name="external-link" size={16} color="#ff626f" /><Text style={styles.docText}>Open {item.label || "document"}</Text></Pressable>) : null}
            {selected && collectDocumentUrls(selected.data).length === 0 ? <Text style={styles.muted}>No document links were included in this submission.</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable disabled={saving} style={styles.rejectButton} onPress={() => { setRejecting(selected); setReason(""); }}><Text style={styles.rejectText}>Reject</Text></Pressable>
            <Pressable disabled={saving} style={styles.approveButton} onPress={() => selected && void review(selected, "VERIFIED")}><Text style={styles.approveText}>{saving ? "Saving…" : "Approve"}</Text></Pressable>
          </View>
        </View></View>
      </Modal>

      <Modal visible={Boolean(rejecting)} transparent animationType="fade" onRequestClose={() => !saving && setRejecting(null)}>
        <View style={styles.scrim}><View style={styles.rejectSheet}><Text style={styles.sheetTitle}>Reason for rejection</Text><Text style={styles.muted}>Give the provider at least 5 characters explaining what needs attention.</Text><TextInput value={reason} onChangeText={setReason} multiline maxLength={500} editable={!saving} placeholder="Enter a clear reason" placeholderTextColor="#81868d" style={styles.reasonInput} />
          <View style={styles.actions}><Pressable disabled={saving} style={styles.cancelButton} onPress={() => setRejecting(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving || reason.trim().length < 5} style={[styles.rejectButton, (saving || reason.trim().length < 5) && styles.disabled]} onPress={() => rejecting && void review(rejecting, "REJECTED", reason)}><Text style={styles.rejectText}>{saving ? "Saving…" : "Reject submission"}</Text></Pressable></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#101114" },
  header: { minHeight: 86, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#292a30" },
  eyebrow: { color: "#ed1c2e", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: "#f5f5f6", fontSize: 22, fontWeight: "800", marginTop: 4 },
  refresh: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#24252a", alignItems: "center", justifyContent: "center" },
  content: { padding: 18, gap: 12, maxWidth: 900, width: "100%", alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  count: { color: "#c5c6cb", fontSize: 14, fontWeight: "700", marginBottom: 2 },
  card: { backgroundColor: "#1a1b20", borderRadius: 14, padding: 15, borderWidth: 1, borderColor: "#2b2c32" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#2b171b", alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1 },
  cardName: { color: "#f5f5f6", fontSize: 16, fontWeight: "700" },
  cardRole: { color: "#a6a7ad", fontSize: 13, marginTop: 3 },
  uid: { color: "#898b93", fontSize: 11, marginTop: 12 },
  notice: { alignSelf: "center", width: "90%", maxWidth: 460, marginTop: 48, padding: 22, backgroundColor: "#1a1b20", borderRadius: 16, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#303137" },
  noticeTitle: { color: "#f5f5f6", fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 5 },
  muted: { color: "#a6a7ad", fontSize: 14, lineHeight: 21, textAlign: "center" },
  error: { color: "#ff828a", padding: 12, backgroundColor: "#33191d", borderRadius: 10 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { width: "100%", maxWidth: 900, maxHeight: "88%", backgroundColor: "#17181c", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  sheetTitle: { color: "#f5f5f6", fontSize: 20, fontWeight: "800", marginTop: 4 },
  details: { maxHeight: 380 },
  docLink: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#303137" },
  docText: { color: "#ff727d", fontSize: 14, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  approveButton: { flex: 1, minHeight: 48, borderRadius: 11, backgroundColor: "#ed1c2e", alignItems: "center", justifyContent: "center" },
  approveText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  rejectButton: { flex: 1, minHeight: 48, borderRadius: 11, backgroundColor: "#3a1d22", borderWidth: 1, borderColor: "#7c303a", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  rejectText: { color: "#ff8992", fontSize: 14, fontWeight: "800", textAlign: "center" },
  rejectSheet: { width: "90%", maxWidth: 480, backgroundColor: "#1a1b20", borderRadius: 18, padding: 20, gap: 12, marginBottom: "auto", marginTop: "auto" },
  reasonInput: { minHeight: 100, maxHeight: 180, color: "#f5f5f6", backgroundColor: "#101114", borderRadius: 10, borderWidth: 1, borderColor: "#36373d", padding: 12, textAlignVertical: "top" },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: 11, backgroundColor: "#2a2b30", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#e3e4e6", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.45 },
});
