import { useState } from "react";
import { TextInput, View } from "react-native";
import { RequestList } from "../../components/shop-owner/ShopRequests";
import { Button, LoadState, s, ShopScreen } from "../../components/shop-owner/ShopUI";
import { useShopDashboard } from "../../hooks/useShopDashboard";
import { isActiveShopService } from "../../types/shopBooking";

const FILTERS = ["Incoming", "Active", "Completed", "Rejected", "Cancelled"] as const;
export default function ShopRequestsScreen() {
  const { requests, requestsLoading, requestsError, retry } = useShopDashboard();
  const [filter, setFilter] = useState<typeof FILTERS[number]>("Incoming");
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const filtered = requests.filter((request) => {
    const matches = filter === "Incoming" ? request.status === "pending" : filter === "Active" ? isActiveShopService(request.status)
      : filter === "Completed" ? request.status === "completed" : filter === "Rejected" ? request.status === "rejected" : request.status === "cancelled";
    return matches && `${request.customerName} ${request.vehicle} ${request.vehiclePlate} ${request.problem}`.toLowerCase().includes(needle);
  });
  return <ShopScreen title="Service Requests">
    <TextInput accessibilityLabel="Search service requests" style={s.input} value={search} onChangeText={setSearch} placeholder="Search customer, vehicle or problem" />
    <View style={s.row}>{FILTERS.map((item) => <Button key={item} title={item} secondary={filter !== item} onPress={() => setFilter(item)} />)}</View>
    <LoadState loading={requestsLoading} error={requestsError} retry={retry} />
    {!requestsLoading && !requestsError && <RequestList requests={filtered} empty={needle ? "No requests match your search." : `No ${filter.toLowerCase()} requests.`} actions={filter === "Incoming"} />}
  </ShopScreen>;
}
