import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";
import { uploadVerificationFile } from "../../services/providerProfileService";
import { getShopVerificationProfile, saveShopVerificationProfile } from "../../services/shopVerificationService";
import type { ShopVerificationProfile } from "../../types/shopVerificationProfile";

const C = { bg: "#0B1115", card: "#151E25", text: "#F7F9FA", muted: "#A1ABB2", line: "#354249", red: "#F51F3B", green: "#1C8D5B" };
const DEFAULT_REGION: Region = { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.08, longitudeDelta: 0.08 };
type File = { url: string; name: string };
type Draft = { name: string; contact: string; phone: string; address: string; lat: string; lng: string; hours: string };

export default function ShopVerification() {
  const router = useRouter(), insets = useSafeAreaInsets();
  const [d, setD] = useState<Draft>({ name: "", contact: "", phone: "", address: "", lat: "", lng: "", hours: "" });
  const [permit, setPermit] = useState<File | null>(null), [support, setSupport] = useState<File | null>(null), [photos, setPhotos] = useState<File[]>([]);
  const [idFront, setIdFront] = useState<File | null>(null), [idBack, setIdBack] = useState<File | null>(null), [facePhoto, setFacePhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(true), [uploading, setUploading] = useState(false), [saving, setSaving] = useState(false), [locating, setLocating] = useState(false), [status, setStatus] = useState<string | null>(null);
  const pin = useMemo(() => { const latitude = Number(d.lat), longitude = Number(d.lng); return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : null; }, [d.lat, d.lng]);
  const region: Region = pin ? { ...pin, latitudeDelta: .012, longitudeDelta: .012 } : DEFAULT_REGION;

  useEffect(() => { const user = auth.currentUser; if (!user) { setLoading(false); return; } void getShopVerificationProfile(user.uid).then((p) => { if (!p) return; setD({ name: p.business.name, contact: p.business.contactPerson, phone: p.business.phone, address: p.business.address, lat: String(p.business.latitude), lng: String(p.business.longitude), hours: p.business.operatingHours }); setPermit(p.documents.businessPermitUrl ? { url: p.documents.businessPermitUrl, name: "Previously uploaded" } : null); setSupport(p.documents.supportingDocumentUrl ? { url: p.documents.supportingDocumentUrl, name: "Previously uploaded" } : null); setIdFront(p.documents.validIdFrontUrl ? { url: p.documents.validIdFrontUrl, name: "Previously uploaded" } : null); setIdBack(p.documents.validIdBackUrl ? { url: p.documents.validIdBackUrl, name: "Previously uploaded" } : null); setFacePhoto(p.documents.facePhotoUrl ? { url: p.documents.facePhotoUrl, name: "Previously uploaded" } : null); setPhotos(p.shopPhotos.map((url) => ({ url, name: "Shop photo" }))); setStatus(p.verificationStatus); }).finally(() => setLoading(false)); }, []);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));
  const selectLocation = async (latitude: number, longitude: number) => { setD((x) => ({ ...x, lat: latitude.toFixed(6), lng: longitude.toFixed(6) })); try { const [a] = await Location.reverseGeocodeAsync({ latitude, longitude }); const address = a && [a.name, a.street, a.district, a.city, a.region, a.postalCode].filter(Boolean).filter((item, i, all) => all.indexOf(item) === i).join(", "); if (address) set("address", address); } catch { /* saving the selected pin still works offline */ } };
  const currentLocation = async () => { setLocating(true); try { const p = await Location.requestForegroundPermissionsAsync(); if (!p.granted) return Alert.alert("Location permission required", "Allow location access to set your shop pin from your current position."); const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); await selectLocation(current.coords.latitude, current.coords.longitude); } catch { Alert.alert("Location unavailable", "We couldn't get your location. Tap the map to place your shop pin instead."); } finally { setLocating(false); } };
  const document = async (supporting = false) => { const user = auth.currentUser; if (!user) return; const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true }); if (r.canceled || !r.assets?.[0]) return; setUploading(true); try { const a = r.assets[0], url = await uploadVerificationFile(user.uid, "certificate", { uri: a.uri, mimeType: a.mimeType, name: a.name, size: a.size }); (supporting ? setSupport : setPermit)({ url, name: a.name || "Upload complete" }); } catch (e) { Alert.alert("Upload failed", e instanceof Error ? e.message : "Try again."); } finally { setUploading(false); } };
  const identityImage = async (kind: "front" | "back" | "face") => { const user = auth.currentUser; if (!user) return; const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return Alert.alert("Permission required", "Allow photo-library access to upload your ID and face photo."); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: .85 }); if (result.canceled || !result.assets[0]) return; const asset = result.assets[0]; setUploading(true); try { const url = await uploadVerificationFile(user.uid, "valid-id", { uri: asset.uri, mimeType: asset.mimeType, name: asset.fileName, size: asset.fileSize }); const file = { url, name: asset.fileName || "Image uploaded" }; if (kind === "front") setIdFront(file); else if (kind === "back") setIdBack(file); else setFacePhoto(file); } catch (e) { Alert.alert("Upload failed", e instanceof Error ? e.message : "Try again."); } finally { setUploading(false); } };
  const photo = async () => { const user = auth.currentUser; if (!user) return; const p = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!p.granted) return Alert.alert("Permission required", "Allow photos to upload shop images."); const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 3, quality: .8 }); if (r.canceled) return; setUploading(true); try { const files: File[] = []; for (const a of r.assets) files.push({ url: await uploadVerificationFile(user.uid, "profile-photo", { uri: a.uri, mimeType: a.mimeType, name: a.fileName, size: a.fileSize }), name: a.fileName || "Shop photo" }); setPhotos(files); } catch (e) { Alert.alert("Upload failed", e instanceof Error ? e.message : "Try again."); } finally { setUploading(false); } };
  const submit = async () => { if (!d.contact.trim() || !d.phone.trim() || !d.address.trim() || !pin || !permit || !idFront || !idBack || !facePhoto) return Alert.alert("Missing information", "Complete your business details and upload the business permit, both sides of your ID, and a face photo."); const user = auth.currentUser; if (!user) return; setSaving(true); try { const data: ShopVerificationProfile = { uid: user.uid, role: "shop-owner", business: { name: d.name.trim() || user.displayName?.trim() || "Auto Shop", contactPerson: d.contact.trim(), phone: d.phone.trim(), address: d.address.trim(), latitude: pin.latitude, longitude: pin.longitude, operatingHours: d.hours.trim() }, services: [], vehicleTypes: [], documents: { businessPermitUrl: permit.url, supportingDocumentUrl: support?.url ?? null, validIdFrontUrl: idFront.url, validIdBackUrl: idBack.url, facePhotoUrl: facePhoto.url }, shopPhotos: photos.map((x) => x.url), verificationStatus: "PENDING" }; await saveShopVerificationProfile(user.uid, data); setStatus("PENDING"); } catch (e) { Alert.alert("Submission failed", e instanceof Error ? e.message : "Try again."); } finally { setSaving(false); } };
  if (loading) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={C.red} /></View></SafeAreaView>;
  if (status === "PENDING" || status === "VERIFIED") return <SafeAreaView style={s.safe}><View style={s.center}><Feather name={status === "VERIFIED" ? "check-circle" : "clock"} size={46} color={C.green} /><Text style={s.confirm}>{status === "VERIFIED" ? "Auto shop verified" : "Verification submitted"}</Text><Text style={s.muted}>{status === "VERIFIED" ? "Your shop is verified." : "Your documents are being reviewed by an administrator."}</Text><TouchableOpacity style={s.button} onPress={() => router.replace("/(shop-owner)/profile")}><Text style={s.buttonText}>Back to Profile</Text></TouchableOpacity></View></SafeAreaView>;
  return (
    <SafeAreaView style={s.safe} edges={["left", "right", "bottom"]}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(shop-owner)/profile")}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Auto Shop Verification</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Card title="Business Information">
          <Input label="Owner / Contact Person" value={d.contact} change={(v) => set("contact", v)} />
          <Input label="Phone Number" value={d.phone} phone change={(v) => set("phone", v)} />
          <Input label="Shop Address" value={d.address} change={(v) => set("address", v)} />
          <Text style={s.locationLabel}>SHOP LOCATION</Text>
          <Text style={s.locationHint}>Tap the map to drop your shop pin. The address is filled in when available.</Text>
          <View style={s.mapWrap}>
            <MapView style={s.map} region={region} onPress={(e) => void selectLocation(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}>
              <Marker coordinate={pin ?? { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude }} pinColor={C.red} />
            </MapView>
          </View>
          <TouchableOpacity style={s.locationButton} disabled={locating} onPress={() => void currentLocation()}>
            {locating ? <ActivityIndicator color={C.red} /> : <><Feather name="crosshair" size={18} color={C.red} /><Text style={s.locationButtonText}>Use My Current Location</Text></>}
          </TouchableOpacity>
          <Text style={s.coordinates}>{pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : "No shop pin selected"}</Text>
        </Card>
        <Card title="Documentation">
          <Upload label="Business Permit or Registration" file={permit} press={() => void document()} />
          <Upload label="Supporting Document (optional)" file={support} optional press={() => void document(true)} />
        </Card>
        <Card title="Identity Verification">
          <Text style={s.locationHint}>Upload clear photos of the front and back of your valid ID, plus a face photo for identity review.</Text>
          <IdentityUpload label="Valid ID — Front" file={idFront} press={() => void identityImage("front")} />
          <IdentityUpload label="Valid ID — Back" file={idBack} press={() => void identityImage("back")} />
          <IdentityUpload label="Face Photo" file={facePhoto} press={() => void identityImage("face")} />
        </Card>
        <Card title="Shop Images">
          <Text style={s.locationHint}>Add up to three clear photos of your shop exterior, sign, workspace, or service area to help customers recognize and trust your business.</Text>
          {photos.map((item, index) => <ShopPhotoUpload key={`${item.url}-${index}`} index={index} file={item} remove={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} />)}
          {photos.length < 3 && <TouchableOpacity style={s.upload} disabled={uploading} onPress={() => void photo()} accessibilityRole="button"><Feather name={uploading ? "loader" : "camera"} size={19} color={C.red} /><Text style={s.uploadText}>{uploading ? "Uploading shop photos..." : "Tap to upload shop photos"}</Text><Feather name="upload-cloud" size={18} color={C.red} /></TouchableOpacity>}
        </Card>
        <TouchableOpacity disabled={saving || uploading} style={[s.button, (saving || uploading) && s.disabled]} onPress={() => void submit()}>
          {saving || uploading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Submit for Verification</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{children}</View>; }
function Input({ label, value, change, placeholder, phone }: { label: string; value: string; change: (value: string) => void; placeholder?: string; phone?: boolean }) { return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput style={s.input} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor={C.muted} keyboardType={phone ? "phone-pad" : "default"} /></View>; }
function Upload({ label, file, press, optional }: { label: string; file: File | null; press: () => void; optional?: boolean }) { return <View style={s.field}><Text style={s.label}>{label}{optional ? " (optional)" : ""}</Text><TouchableOpacity style={s.upload} onPress={press}><Feather name={file ? "check-circle" : "upload-cloud"} size={18} color={file ? C.green : C.red} /><Text style={s.uploadText}>{file ? file.name : "Tap to upload"}</Text></TouchableOpacity></View>; }
function IdentityUpload({ label, file, press }: { label: string; file: File | null; press: () => void }) { return <View style={s.field}><Text style={s.label}>{label}</Text><TouchableOpacity style={s.upload} onPress={press} accessibilityRole="button" accessibilityLabel={`${file ? "Change" : "Upload"} ${label.toLowerCase()}`}>{file ? <Image source={{ uri: file.url }} style={s.identityThumbnail} /> : <Feather name="camera" size={19} color={C.red} />}<Text style={s.uploadText}>{file ? "Photo uploaded · Tap to change" : "Tap to upload a photo"}</Text><Feather name={file ? "check-circle" : "upload-cloud"} size={18} color={file ? C.green : C.red} /></TouchableOpacity></View>; }
function ShopPhotoUpload({ index, file, remove }: { index: number; file: File; remove: () => void }) { return <View style={s.field}><Text style={s.label}>Shop Photo {index + 1}</Text><View style={s.upload}>{<Image source={{ uri: file.url }} style={s.identityThumbnail} />}<Text style={s.uploadText}>Photo uploaded</Text><TouchableOpacity onPress={remove} accessibilityRole="button" accessibilityLabel={`Remove shop photo ${index + 1}`}><Feather name="trash-2" size={18} color={C.red} /></TouchableOpacity></View></View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 13 },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  content: { padding: 18, gap: 15, paddingBottom: 32 },
  card: { padding: 16, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  cardTitle: { color: C.text, fontSize: 19, fontWeight: "800", marginBottom: 10 },
  field: { marginTop: 14 },
  label: { color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { minHeight: 50, borderRadius: 10, paddingHorizontal: 13, color: C.text, backgroundColor: "#202B32", borderWidth: 1, borderColor: C.line, fontSize: 15 },
  locationLabel: { color: C.text, fontSize: 15, fontWeight: "700", marginTop: 18 },
  locationHint: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 10 },
  mapWrap: { height: 220, borderRadius: 12, overflow: "hidden", marginTop: 5 },
  map: { flex: 1 },
  locationButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, backgroundColor: "#202B32", marginTop: 10 },
  locationButtonText: { color: C.red, fontSize: 14, fontWeight: "800" },
  coordinates: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
  upload: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, paddingHorizontal: 12, backgroundColor: "#202B32" },
  uploadText: { color: C.text, fontSize: 14, flex: 1 },
  identityThumbnail: { width: 44, height: 44, borderRadius: 7 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 20, backgroundColor: "#202B32", borderWidth: 1, borderColor: C.line },
  active: { backgroundColor: "#3A2025", borderColor: C.red },
  chipText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  activeText: { color: C.text },
  button: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.red, paddingHorizontal: 16 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  confirm: { color: C.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  muted: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
