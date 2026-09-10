import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Button, C, Info, LoadState, s, ShopScreen } from "../../components/shop-owner/ShopUI";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { logout } from "../../services/auth";
import { saveShopProfile } from "../../services/shopOwnerService";

export default function ShopProfileScreen() {
  const router = useRouter();
  const { account, profile, profileLoading, profileError, retry } = useShopDashboard();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ businessName: "", phone: "", address: "", latitude: "", longitude: "" });
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const locked = useRef(false);

  function edit() {
    if (!profile) return;
    setForm({ businessName: profile.businessName, phone: profile.phone, address: profile.address,
      latitude: String(profile.latitude), longitude: String(profile.longitude) });
    setError(null); setSaved(false); setEditing(true);
  }
  async function save() {
    if (locked.current) return;
    locked.current = true;
    setSaving(true); setError(null);
    try {
      if (!form.latitude.trim() || !form.longitude.trim()) throw new Error("Enter both shop coordinates.");
      await saveShopProfile({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) });
      setEditing(false); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your shop profile."); }
    finally { locked.current = false; setSaving(false); }
  }
  async function signOut() {
    if (locked.current) return;
    locked.current = true;
    setSigningOut(true); setError(null);
    try { await logout(); router.replace("/(auth)/login"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to log out. Try again."); }
    finally { locked.current = false; setSigningOut(false); }
  }

  return <ShopScreen title="Profile">
    <LoadState loading={profileLoading} error={profileError} retry={retry} />
    {!profileLoading && !profileError && profile && <>
      <View style={s.identity}><Feather name="home" size={36} color={C.white} />
        <Text style={s.identityName}>{profile.businessName}</Text><Text style={s.identityText}>{account.displayName} · Shop Owner</Text>
        <Text style={s.identityText}>{profile.status === "open" ? "Open" : "Closed"}</Text>
      </View>
      <Text style={s.heading}>ACCOUNT INFORMATION</Text>
      <View style={s.card}><Info label="Name" value={account.displayName} /><Info label="Email" value={account.email} /></View>
      <Text style={s.heading}>SHOP INFORMATION</Text>
      <View style={s.card}>{editing ? <>
        {([
          ["businessName", "Shop name", 120], ["phone", "Contact number", 30], ["address", "Shop address", 300],
          ["latitude", "Shop latitude", 24], ["longitude", "Shop longitude", 24],
        ] as const).map(([key, label, limit]) => <View key={key} style={s.info}>
          <Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={form[key]}
            maxLength={limit} editable={!saving} multiline={key === "address"} keyboardType={key === "phone" ? "phone-pad" : "default"}
            onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} />
        </View>)}
        <Text style={s.muted}>Use the coordinates of your shop entrance, where customers will bring their vehicles.</Text>
        <Button title={saving ? "Saving…" : "Save Shop Profile"} disabled={saving} onPress={() => void save()} />
        <Button title="Cancel" secondary disabled={saving} onPress={() => { setEditing(false); setError(null); }} />
      </> : <>
        <Info label="Shop name" value={profile.businessName} /><Info label="Contact number" value={profile.phone} />
        <Info label="Address" value={profile.address} /><Info label="Shop coordinates" value={`${profile.latitude}, ${profile.longitude}`} />
        <Button title="Edit Shop Profile" onPress={edit} />
      </>}</View>
      {saved && <Text accessibilityLiveRegion="polite" style={s.text}>Shop profile saved.</Text>}
      <Text style={s.heading}>PUBLIC LISTING</Text>
      <View style={s.card}>
        <Text style={s.text}>{profile.verified ? "Approved shop" : "Awaiting administrator approval"}</Text>
        <Text style={s.muted}>Approved shops can publish their services. Customers see your listing when the shop is Open.</Text>
        {profile.verified && <Button title="Manage Public Listing" onPress={() => router.push("/(shop-owner)/public-listing")} />}
      </View>
    </>}
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Text style={s.heading}>ACCOUNT</Text>
    <Button title={signingOut ? "Logging Out…" : "Log Out"} secondary disabled={saving || signingOut} onPress={() => void signOut()} />
  </ShopScreen>;
}
