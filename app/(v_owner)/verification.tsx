import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "../../services/firebase";
import { getOwnerVerificationProfile, saveOwnerVerificationProfile } from "../../services/ownerVerificationProfileService";
import { uploadVerificationFile } from "../../services/providerProfileService";
import type { OwnerVerificationProfile } from "../../types/ownerVerificationProfile";

const C = { primary: "#F52239", text: "#F4F6F8", muted: "#AAB5C0", border: "#28313A", surface: "#151C23", surfaceAlt: "#1C252E", background: "#0C1015", success: "#39D98A" };
const ID_TYPES = ["Driver's License", "UMID", "PhilSys ID", "Passport"];

type UploadedFile = { url: string; name: string };
type AddressSuggestion = { id: string; label: string; cityMunicipality: string };
type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    name?: string; street?: string; housenumber?: string; district?: string;
    city?: string; county?: string; state?: string; country?: string;
    osm_type?: string; osm_id?: string | number;
  };
};

export default function OwnerVerification() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [validId, setValidId] = useState<UploadedFile | null>(null);
  const [validIdBack, setValidIdBack] = useState<UploadedFile | null>(null);
  const [faceImage, setFaceImage] = useState<UploadedFile | null>(null);
  const [orcr, setOrcr] = useState<UploadedFile | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState<"PENDING" | "VERIFIED" | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearchError, setAddressSearchError] = useState("");
  const [addressSearching, setAddressSearching] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressSearchController = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const profile = await getOwnerVerificationProfile(user.uid);
        if (!active) return;
        if (profile) {
          setFullName(profile.personal.fullName);
          setPhone(profile.personal.phone);
          setAddress(profile.personal.address);
          setCity(profile.personal.cityMunicipality);
          setIdType(profile.identification.idType);
          setIdNumber(profile.identification.idNumber);
          setValidId(profile.identification.validIdUrl ? { url: profile.identification.validIdUrl, name: "Previously uploaded" } : null);
          setValidIdBack(profile.identification.validIdBackUrl ? { url: profile.identification.validIdBackUrl, name: "Previously uploaded" } : null);
          setFaceImage(profile.identification.facePhotoUrl ? { url: profile.identification.facePhotoUrl, name: "Previously uploaded" } : null);
          setOrcr(profile.vehicleDocuments.orCrUrl ? { url: profile.vehicleDocuments.orCrUrl, name: "Previously uploaded" } : null);
          if (profile.verificationStatus === "PENDING" || profile.verificationStatus === "VERIFIED") {
            setLocked(profile.verificationStatus);
          }
        } else {
          setFullName(user.displayName ?? "");
        }
      } catch (error) {
        console.error("Failed to load owner verification:", error);
        Alert.alert("Error", "Could not load verification details.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (addressSearchTimeout.current) clearTimeout(addressSearchTimeout.current);
    addressSearchController.current?.abort();
  }, []);

  const searchAddress = (value: string) => {
    if (addressSearchTimeout.current) clearTimeout(addressSearchTimeout.current);
    addressSearchController.current?.abort();
    setAddressSearchError("");
    if (value.trim().length < 3) {
      setAddressSuggestions([]);
      setAddressSearching(false);
      return;
    }

    addressSearchTimeout.current = setTimeout(async () => {
      const controller = new AbortController();
      addressSearchController.current = controller;
      setAddressSearching(true);
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(value.trim())}&limit=5&lang=en&lat=12.8797&lon=121.7740`,
          { headers: { Accept: "application/json" }, signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Location search failed (${response.status}).`);
        const data = await response.json() as { features?: PhotonFeature[] };
        const results = (data.features ?? []).flatMap((feature, index) => {
          const coordinates = feature.geometry?.coordinates;
          const properties = feature.properties;
          if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) || !properties) return [];
          const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
          const label = [properties.name, street, properties.district, properties.city, properties.county, properties.state, properties.country]
            .filter((part): part is string => Boolean(part))
            .filter((part, partIndex, parts) => parts.indexOf(part) === partIndex)
            .join(", ");
          return [{
            id: `${properties.osm_type ?? "place"}-${properties.osm_id ?? index}`,
            label,
            cityMunicipality: properties.city || properties.county || properties.district || "",
          }];
        });
        setAddressSuggestions(results);
        if (!results.length) setAddressSearchError("No matching locations found.");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setAddressSuggestions([]);
          setAddressSearchError("Location search is unavailable. Check your connection or enter the address manually.");
        }
      } finally {
        if (addressSearchController.current === controller) setAddressSearching(false);
      }
    }, 650);
  };

  const pickIdImage = async (side: "front" | "back" | "face") => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Sign in required", "Please sign in before uploading your ID.");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission required", "Photo library access is needed to upload your ID.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return Alert.alert("File too large", "Choose an image smaller than 5 MB.");
    const uploadKey = `valid-id-${side}`;
    setUploading(uploadKey);
    try {
      const url = await uploadVerificationFile(user.uid, "valid-id", {
        uri: asset.uri, mimeType: asset.mimeType, name: asset.fileName, size: asset.fileSize,
      });
      const uploaded = { url, name: asset.fileName || `ID ${side} uploaded` };
      if (side === "front") setValidId(uploaded);
      else if (side === "back") setValidIdBack(uploaded);
      else setFaceImage({ url, name: asset.fileName || "Face photo uploaded" });
    } catch (error) {
      Alert.alert("Upload failed", (error as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const pickOrcr = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Sign in required", "Please sign in before uploading a document.");
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading("orcr");
    try {
      const url = await uploadVerificationFile(user.uid, "certificate", {
        uri: asset.uri, mimeType: asset.mimeType, name: asset.name, size: asset.size,
      });
      setOrcr({ url, name: asset.name || "Upload complete" });
    } catch (error) {
      Alert.alert("Upload failed", (error as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!fullName.trim() || !phone.trim() || !address.trim() || !city.trim() || !idType || !idNumber.trim() || !validId || !validIdBack || !faceImage || !consent) {
      Alert.alert("Missing information", "Complete all required fields, upload the front and back of your ID and a face photo, and accept the consent statement.");
      return;
    }
    const user = auth.currentUser;
    if (!user) return Alert.alert("Sign in required", "Please sign in first.");
    setSaving(true);
    try {
      const profile: OwnerVerificationProfile = {
        uid: user.uid,
        role: "owner",
        personal: { fullName: fullName.trim(), phone: phone.trim(), address: address.trim(), cityMunicipality: city.trim() },
        identification: { idType, idNumber: idNumber.trim(), validIdUrl: validId.url, validIdBackUrl: validIdBack.url, facePhotoUrl: faceImage.url, profilePhotoUrl: "" },
        vehicleDocuments: { orCrUrl: orcr?.url ?? null },
        verificationStatus: "PENDING",
      };
      await saveOwnerVerificationProfile(user.uid, profile);
      setLocked("PENDING");
    } catch (error) {
      console.error("Failed to save owner verification:", error);
      Alert.alert("Submission failed", "Could not save your verification.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={C.primary} /></View></SafeAreaView>;

  if (locked) {
    const verified = locked === "VERIFIED";
    return <SafeAreaView style={styles.safe}>
      <View style={styles.statusPage}>
        <View style={styles.statusTopRow}>
          <TouchableOpacity
            onPress={() => router.replace("/(v_owner)/profile")}
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            style={styles.statusBackButton}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.statusTopTitle}>Verification</Text>
          <View style={styles.backButtonSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.statusContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.statusHero, verified && styles.statusHeroVerified]}>
            <View style={[styles.statusGlow, verified && styles.statusGlowVerified]} />
            <View style={[styles.statusIconWrap, verified && styles.statusIconWrapVerified]}>
              <Ionicons name={verified ? "checkmark-circle" : "time"} size={43} color={verified ? C.success : C.primary} />
            </View>
            <View style={[styles.statusBadge, verified && styles.statusBadgeVerified]}>
              <View style={[styles.statusDot, verified && styles.statusDotVerified]} />
              <Text style={[styles.statusBadgeText, verified && styles.statusBadgeTextVerified]}>{verified ? "APPROVED" : "IN REVIEW"}</Text>
            </View>
            <Text style={styles.statusTitle}>{verified ? "You’re verified" : "Your details are in review"}</Text>
            <Text style={styles.statusDescription}>
              {verified
                ? "Your identity has been approved. You can now book services with confidence."
                : "Your documents have been submitted. Our team is checking your information before unlocking bookings."}
            </Text>
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewCardEyebrow}>VERIFICATION JOURNEY</Text>
            <View style={styles.reviewStepRow}>
              <View style={styles.reviewStepIconDone}><Ionicons name="checkmark" size={15} color={C.success} /></View>
              <View style={styles.reviewStepCopy}>
                <Text style={styles.reviewStepTitle}>Documents submitted</Text>
                <Text style={styles.reviewStepText}>Your identity details are safely received.</Text>
              </View>
              <Text style={styles.reviewStepStateDone}>DONE</Text>
            </View>
            <View style={styles.reviewConnector} />
            <View style={styles.reviewStepRow}>
              <View style={[styles.reviewStepIconCurrent, verified && styles.reviewStepIconDone]}>
                <Ionicons name={verified ? "checkmark" : "search-outline"} size={15} color={verified ? C.success : C.primary} />
              </View>
              <View style={styles.reviewStepCopy}>
                <Text style={styles.reviewStepTitle}>{verified ? "Identity approved" : "Team review"}</Text>
                <Text style={styles.reviewStepText}>{verified ? "Your owner account is ready." : "We’ll notify you when the review is complete."}</Text>
              </View>
              <Text style={verified ? styles.reviewStepStateDone : styles.reviewStepStateCurrent}>{verified ? "DONE" : "NOW"}</Text>
            </View>
            {!verified && <>
              <View style={styles.reviewConnector} />
              <View style={styles.reviewStepRow}>
                <View style={styles.reviewStepIconNext}><Ionicons name="car-outline" size={15} color={C.muted} /></View>
                <View style={styles.reviewStepCopy}>
                  <Text style={styles.reviewStepTitleMuted}>Book a service</Text>
                  <Text style={styles.reviewStepText}>Booking access opens after approval.</Text>
                </View>
                <Ionicons name="lock-closed" size={14} color={C.muted} />
              </View>
            </>}
          </View>

          {!verified && <View style={styles.statusTip}>
            <Ionicons name="notifications-outline" size={18} color={C.primary} />
            <Text style={styles.statusTipText}>You can return to your profile while we review your submission.</Text>
          </View>}
          <Button text={verified ? "Back to Profile" : "Go to Profile"} onPress={() => router.replace("/(v_owner)/profile")} />
        </ScrollView>
      </View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(v_owner)/profile")} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Your Account</Text>
        <View style={styles.backButtonSpacer} />
      </View>
      <View style={styles.headerCopy}>
        <View style={styles.headerIcon}><Ionicons name="shield-checkmark" size={20} color={C.primary} /></View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerEyebrow}>ACCOUNT SECURITY</Text>
          <Text style={styles.headerSubtitle}>Verify your identity to unlock service bookings.</Text>
        </View>
      </View>
    </View>
    <ScrollView style={styles.formScroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.introCard}>
        <View style={styles.introTopRow}>
          <View style={styles.introBadge}><Ionicons name="lock-closed" size={14} color={C.success} /><Text style={styles.introBadgeText}>PRIVATE & SECURE</Text></View>
          <Text style={styles.requiredNote}>* Required</Text>
        </View>
        <Text style={styles.introTitle}>A quick identity check</Text>
        <Text style={styles.introText}>Add your contact details and clear ID photos. Our team will review your submission.</Text>
        <View style={styles.stepRow}>
          <Step number="1" label="Your details" active />
          <View style={styles.stepLine} />
          <Step number="2" label="Review" />
        </View>
      </View>

      <Card title="Personal details" subtitle="How we can reach you" icon="person-outline">
        <Input label="Full Name" value={fullName} onChangeText={setFullName} />
        <Input label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={styles.field}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={styles.input}
            value={address}
            placeholder="Search your address or city"
            placeholderTextColor="#7E8B97"
            onFocus={() => setShowAddressSuggestions(true)}
            onChangeText={(value) => {
              setAddress(value);
              setCity("");
              setAddressSuggestions([]);
              setShowAddressSuggestions(true);
              searchAddress(value);
            }}
          />
          {addressSearching && <Text style={styles.helper}>Searching locations…</Text>}
          {showAddressSuggestions && addressSuggestions.length > 0 && <View style={styles.suggestionList}>
            {addressSuggestions.map((suggestion) => <TouchableOpacity key={suggestion.id} style={styles.suggestionItem} onPress={() => {
              setAddress(suggestion.label);
              if (suggestion.cityMunicipality) setCity(suggestion.cityMunicipality);
              setAddressSuggestions([]);
              setShowAddressSuggestions(false);
              addressSearchController.current?.abort();
            }}>
              <Text style={styles.suggestionText}>{suggestion.label}</Text>
            </TouchableOpacity>)}
          </View>}
          {!addressSearching && showAddressSuggestions && addressSearchError ? <Text style={styles.helper}>{addressSearchError}</Text> : null}
        </View>
        <Input label="City / Municipality" value={city} onChangeText={setCity} />
      </Card>

      <Card title="Identity documents" subtitle="Use clear, readable photos" icon="card-outline">
        <Text style={styles.label}>Government ID Type *</Text>
        <View style={styles.chips}>{ID_TYPES.map((type) => <TouchableOpacity key={type} style={[styles.chip, idType === type && styles.chipActive]} onPress={() => setIdType(type)}>
          <Text style={[styles.chipText, idType === type && styles.chipTextActive]}>{type}</Text>
        </TouchableOpacity>)}</View>
        <Input label="Government ID Number" value={idNumber} onChangeText={setIdNumber} />
        <Upload label="Valid Government ID — Front *" file={validId} busy={uploading === "valid-id-front"} onPress={() => void pickIdImage("front")} />
        <Upload label="Valid Government ID — Back *" file={validIdBack} busy={uploading === "valid-id-back"} onPress={() => void pickIdImage("back")} />
        <Upload label="Face Photo *" file={faceImage} busy={uploading === "valid-id-face"} onPress={() => void pickIdImage("face")} />
        <Upload label="OR/CR Registration (Optional)" file={orcr} busy={uploading === "orcr"} onPress={() => void pickOrcr()} />
      </Card>

      <TouchableOpacity style={styles.consentCard} onPress={() => setConsent((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
        <Ionicons name={consent ? "checkbox" : "square-outline"} size={22} color={C.primary} />
        <View style={{ flex: 1 }}><Text style={styles.consentTitle}>Confirmation</Text><Text style={styles.consentText}>I confirm that my information and documents are accurate.</Text></View>
      </TouchableOpacity>
      <Button text="Submit for Verification" onPress={() => void submit()} disabled={saving || uploading !== null} />
    </ScrollView>
  </SafeAreaView>;
}

function Card({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>["name"]; children: React.ReactNode }) {
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.cardIcon}><Ionicons name={icon} size={19} color={C.primary} /></View><View style={styles.cardHeadingText}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSubtitle}>{subtitle}</Text></View></View>{children}</View>;
}

function Step({ number, label, active = false }: { number: string; label: string; active?: boolean }) {
  return <View style={styles.step}><View style={[styles.stepNumber, active && styles.stepNumberActive]}><Text style={[styles.stepNumberText, active && styles.stepNumberTextActive]}>{number}</Text></View><Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text></View>;
}

function Input({ label, value, onChangeText, keyboardType = "default" }: {
  label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "phone-pad";
}) {
  return <View style={styles.field}><Text style={styles.label}>{label} *</Text><TextInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} /></View>;
}

function Upload({ label, file, busy, onPress }: { label: string; file: UploadedFile | null; busy: boolean; onPress: () => void }) {
  const optional = label.includes("Optional");
  return <View style={styles.field}><View style={styles.uploadLabelRow}><Text style={styles.label}>{label.replace(" (Optional)", "")}</Text>{optional && <Text style={styles.optionalTag}>OPTIONAL</Text>}</View><TouchableOpacity disabled={busy} style={[styles.upload, file && styles.uploadDone, busy && styles.uploadBusy]} onPress={onPress} accessibilityRole="button">
    <View style={[styles.uploadIcon, file && styles.uploadIconDone]}><Ionicons name={file ? "checkmark" : "cloud-upload-outline"} size={19} color={file ? C.success : C.primary} /></View>
    <View style={styles.uploadCopy}><Text style={styles.uploadTitle}>{busy ? "Uploading…" : file ? "File added" : "Upload image or document"}</Text><Text numberOfLines={1} style={[styles.uploadText, file && styles.uploadTextDone]}>{file?.name ?? (optional ? "You can add this later" : "JPG or PNG · Up to 5 MB")}</Text></View>
    {!busy && <Ionicons name={file ? "checkmark-circle" : "add-circle-outline"} size={21} color={file ? C.success : C.muted} />}
    {busy && <ActivityIndicator color={C.primary} size="small" />}
  </TouchableOpacity></View>;
}

function Button({ text, onPress, disabled = false }: { text: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={onPress}>
    <Text style={styles.buttonText}>{text}</Text><Ionicons name="arrow-forward" size={18} color={C.text} />
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 32, paddingVertical: 3 },
  backButtonSpacer: { width: 32 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  headerCopy: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 12 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#321A20", alignItems: "center", justifyContent: "center" },
  headerTextWrap: { flex: 1, gap: 2 },
  headerEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, color: C.primary },
  headerSubtitle: { fontSize: 12, color: C.muted, lineHeight: 17 },
  formScroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 15, padding: 30 },
  title: { fontSize: 23, fontWeight: "700", color: C.text },
  muted: { fontSize: 13, color: C.muted, lineHeight: 19 },
  statusPage: { flex: 1, backgroundColor: C.background },
  statusTopRow: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  statusBackButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  statusTopTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  statusContent: { flexGrow: 1, padding: 18, paddingTop: 22, paddingBottom: 28, gap: 15 },
  statusHero: { minHeight: 280, alignItems: "center", justifyContent: "center", overflow: "hidden", paddingHorizontal: 24, paddingVertical: 25, borderRadius: 24, backgroundColor: "#21191D", borderWidth: 1, borderColor: "#48232B" },
  statusHeroVerified: { backgroundColor: "#14251F", borderColor: "#24513D" },
  statusGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, top: -125, backgroundColor: "#3A2025", opacity: 0.8 },
  statusGlowVerified: { backgroundColor: "#173127" },
  statusIconWrap: { width: 82, height: 82, alignItems: "center", justifyContent: "center", borderRadius: 28, backgroundColor: "#351D24", borderWidth: 1, borderColor: "#63313C" },
  statusIconWrapVerified: { backgroundColor: "#173127", borderColor: "#24513D" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 17, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: "#351D24", borderWidth: 1, borderColor: "#63313C" },
  statusBadgeVerified: { backgroundColor: "#173127", borderColor: "#24513D" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  statusDotVerified: { backgroundColor: C.success },
  statusBadgeText: { color: "#F7A4AE", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  statusBadgeTextVerified: { color: C.success },
  statusTitle: { marginTop: 14, textAlign: "center", color: C.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  statusDescription: { maxWidth: 310, marginTop: 7, textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 21 },
  reviewCard: { padding: 17, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  reviewCardEyebrow: { marginBottom: 16, color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  reviewStepRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 11 },
  reviewStepIconDone: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#173127", borderWidth: 1, borderColor: "#24513D" },
  reviewStepIconCurrent: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#351D24", borderWidth: 1, borderColor: "#63313C" },
  reviewStepIconNext: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  reviewStepCopy: { flex: 1, gap: 2 },
  reviewStepTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  reviewStepTitleMuted: { color: C.muted, fontSize: 13, fontWeight: "700" },
  reviewStepText: { color: C.muted, fontSize: 11, lineHeight: 16 },
  reviewStepStateDone: { color: C.success, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  reviewStepStateCurrent: { color: "#F7A4AE", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  reviewConnector: { height: 15, width: 1, marginLeft: 14, backgroundColor: C.border },
  statusTip: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  statusTipText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  introCard: { padding: 17, borderRadius: 17, backgroundColor: "#191F26", borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  introTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  introBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#173127", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  introBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.7, color: C.success },
  requiredNote: { fontSize: 10, color: C.muted },
  introTitle: { marginTop: 16, fontSize: 20, lineHeight: 25, fontWeight: "800", color: C.text },
  introText: { marginTop: 5, fontSize: 12, lineHeight: 18, color: C.muted },
  stepRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  step: { flexDirection: "row", alignItems: "center", gap: 7 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  stepNumberActive: { backgroundColor: C.primary, borderColor: C.primary },
  stepNumberText: { fontSize: 10, fontWeight: "700", color: C.muted },
  stepNumberTextActive: { color: C.text },
  stepLabel: { fontSize: 10, color: C.muted, fontWeight: "600" },
  stepLabelActive: { color: C.text },
  stepLine: { flex: 1, height: 1, backgroundColor: C.border, marginHorizontal: 10 },
  card: { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 15, gap: 15, backgroundColor: C.surface },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  cardIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#321A20", alignItems: "center", justifyContent: "center" },
  cardHeadingText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  cardSubtitle: { fontSize: 11, color: C.muted },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600", color: C.text },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 9, padding: 11, fontSize: 14, color: C.text, backgroundColor: C.background },
  helper: { fontSize: 11, color: C.muted, lineHeight: 16 },
  suggestionList: { borderWidth: 1, borderColor: C.border, borderRadius: 9, overflow: "hidden", backgroundColor: C.background },
  suggestionItem: { padding: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  suggestionText: { fontSize: 13, color: C.text, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 12, color: C.muted },
  chipTextActive: { color: C.text },
  uploadLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionalTag: { fontSize: 9, color: C.muted, letterSpacing: 0.6, fontWeight: "700" },
  upload: { flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 11, backgroundColor: C.background, minHeight: 64 },
  uploadDone: { borderColor: "#24513D", backgroundColor: "#111E1A" },
  uploadBusy: { opacity: 0.75 },
  uploadIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#321A20" },
  uploadIconDone: { backgroundColor: "#173127" },
  uploadCopy: { flex: 1, gap: 3 },
  uploadTitle: { fontSize: 12, fontWeight: "700", color: C.text },
  uploadText: { fontSize: 10, color: C.muted, flex: 1 },
  uploadTextDone: { color: C.success },
  consentCard: { flexDirection: "row", gap: 11, alignItems: "center", padding: 14, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  consentTitle: { color: C.text, fontSize: 12, fontWeight: "700", marginBottom: 3 },
  consentText: { flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },
  button: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, shadowColor: C.primary, shadowOpacity: 0.22, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  disabled: { opacity: 0.5 },
  buttonText: { color: C.text, fontSize: 14, fontWeight: "700" },
});
