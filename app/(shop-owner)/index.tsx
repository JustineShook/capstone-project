import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import { RequestList } from "../../components/shop-owner/ShopRequests";
import { Button, C, LoadState, s, ShopScreen } from "../../components/shop-owner/ShopUI";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { setShopAvailability } from "../../services/shopOwnerService";
import { isActiveShopService } from "../../types/shopBooking";

export default function ShopOwnerDashboard() {
  const router = useRouter();
  const { account, profile, requests, profileLoading, requestsLoading, profileError, requestsError, retry } = useShopDashboard();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const incoming = requests.filter((request) => request.status === "pending");
  const active = requests.filter((request) => isActiveShopService(request.status));
  const completed = requests.filter((request) => request.status === "completed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function toggle(open: boolean) {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setError(null);
    try { await setShopAvailability(open ? "open" : "closed"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save availability."); }
    finally { locked.current = false; setSaving(false); }
  }

  return <ShopScreen title="Home">
    <LoadState loading={profileLoading} error={profileError} retry={retry} />
    {!profileLoading && !profileError && profile && <>
      <View style={s.card}>
        <Text style={s.title}>{profile.businessName}</Text>
        <Text style={s.muted}>Welcome, {account.displayName}</Text>
        <Text style={s.text}>{profile.address || "Add your shop address in Profile."}</Text>
        <Button title="View Shop Profile" secondary onPress={() => router.navigate("/(shop-owner)/profile")} />
      </View>
      <View style={s.card}>
        <View style={s.between}><View style={s.flex}><Text style={s.title}>{profile.status === "open" ? "Open" : "Closed"}</Text>
          <Text style={s.muted}>{saving ? "Saving availability…" : "Shop availability"}</Text></View>
          <Switch accessibilityLabel="Shop open for emergency requests" value={profile.status === "open"} disabled={saving}
            trackColor={{ false: C.border, true: C.primary }} onValueChange={(value) => void toggle(value)} />
        </View>
        <Text style={s.muted}>{profile.status === "open" ? "Accepting emergency repairs. Customers bring their vehicles to the shop."
          : "New requests and acceptance are paused. You can still finish active services or reject pending requests."}</Text>
        {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      </View>
    </>}
    <LoadState loading={requestsLoading} error={requestsError} retry={retry} />
    {!requestsLoading && !requestsError && <>
      <View style={s.row}>{[{ label: "Incoming", count: incoming.length }, { label: "Active", count: active.length }, { label: "Completed", count: completed.length }].map((stat) =>
        <View key={stat.label} style={s.stat}><Text style={s.statValue}>{stat.count}</Text><Text style={s.statLabel}>{stat.label}</Text></View>)}</View>
      <Text style={s.heading}>INCOMING SERVICE REQUESTS</Text>
      <RequestList requests={incoming.slice(0, 3)} empty="No incoming requests. New customer requests will appear here." actions />
      <Button title="View All Requests" secondary onPress={() => router.navigate("/(shop-owner)/requests")} />
      <Text style={s.heading}>ACTIVE SERVICES</Text>
      <RequestList requests={active.slice(0, 3)} empty="No active services. Accepted requests will appear here." />
      <Button title="View All Active Services" secondary onPress={() => router.push({ pathname: "/(shop-owner)/active-service", params: { id: "" } })} />
      <Text style={s.heading}>RECENTLY COMPLETED</Text>
      <RequestList requests={completed.slice(0, 2)} empty="Completed services will appear here." />
      <Button title="View Service History" secondary onPress={() => router.navigate("/(shop-owner)/service-history")} />
    </>}
  </ShopScreen>;
}
