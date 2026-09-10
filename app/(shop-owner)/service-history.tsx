import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { RequestList } from "../../components/shop-owner/ShopRequests";
import { LoadState, s, ShopScreen } from "../../components/shop-owner/ShopUI";
import { useShopDashboard } from "../../hooks/useShopDashboard";

export default function ShopServiceHistory() {
  const { requests, requestsLoading, requestsError, retry } = useShopDashboard();
  const [search, setSearch] = useState("");
  const completed = requests.filter((request) => request.status === "completed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const needle = search.trim().toLowerCase();
  const filtered = completed.filter((request) => `${request.customerName} ${request.vehicle} ${request.vehiclePlate} ${request.problem}`.toLowerCase().includes(needle));
  return <ShopScreen title="Service History">
    <LoadState loading={requestsLoading} error={requestsError} retry={retry} />
    {!requestsLoading && !requestsError && <>
      <View style={s.stat}><Text style={s.statValue}>{completed.length}</Text><Text style={s.statLabel}>Completed services</Text></View>
      <TextInput accessibilityLabel="Search completed services" style={s.input} placeholder="Search customer, vehicle or problem" value={search} onChangeText={setSearch} />
      <Text style={s.heading}>COMPLETED SERVICES</Text>
      <RequestList requests={filtered} empty={needle ? "No completed services match your search." : "No completed services yet."} />
    </>}
  </ShopScreen>;
}
