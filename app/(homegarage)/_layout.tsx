import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs, usePathname } from "expo-router";
import { ActivityIndicator, View, useWindowDimensions } from "react-native";
import { useAuth } from "../../hooks/useAuth";

const C = { bg: "#10191F", active: "#F51F3B", inactive: "#9AA6AE" };

export default function HomeGarageLayout() {
  const { user, userProfile, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const parkingRoute = pathname.includes("parking-sessions") || pathname.includes("parking-session-detail");
  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.active} /></View>;
  if (!user || !userProfile) return <Redirect href="/(auth)/login" />;
  if (userProfile.role !== "homegarage") return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: parkingRoute ? undefined : "#FFFFFF" }}><Tabs screenOptions={parkingRoute ? { headerShown: false, tabBarActiveTintColor: C.active, tabBarInactiveTintColor: C.inactive, tabBarStyle: { backgroundColor: C.bg, borderTopWidth: 0, height: 64, paddingTop: 8, paddingBottom: 9 }, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" } } : { headerShown: false, tabBarActiveTintColor: "#FFFFFF", tabBarInactiveTintColor: "#D6E4FA", tabBarStyle: { backgroundColor: "#0F52BA", borderColor: "#0F52BA", borderWidth: 1, borderTopWidth: 1, borderRadius: 22, marginLeft: Math.max(insets.left, width < 360 ? 8 : 16), marginRight: Math.max(insets.right, width < 360 ? 8 : 16), marginTop: 8, marginBottom: Math.max(insets.bottom, 12), height: 70, paddingTop: 8, paddingBottom: 8, shadowColor: "#172B4D", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" } }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size, focused }) => parkingRoute ? <Feather name="home" size={size ?? 20} color={color} /> : <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} /> }} />
    <Tabs.Screen name="repair-requests" options={{ title: "Bookings", tabBarIcon: ({ color, size, focused }) => parkingRoute ? <Feather name="clipboard" size={size ?? 20} color={color} /> : <Ionicons name={focused ? "clipboard" : "clipboard-outline"} size={size} color={color} /> }} />
    <Tabs.Screen name="parking-sessions" options={{ href: null }} />
    <Tabs.Screen name="repair-request-detail" options={{ href: null }} />

    <Tabs.Screen name="requests" options={{ href: null }} />
    <Tabs.Screen name="parking-session-detail" options={{ href: null }} />
    <Tabs.Screen name="earnings" options={{ href: null }} />
    <Tabs.Screen name="history" options={{ title: "History", tabBarIcon: ({ color, size, focused }) => parkingRoute ? <Feather name="clock" size={size ?? 20} color={color} /> : <Ionicons name={focused ? "time" : "time-outline"} size={size} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size, focused }) => parkingRoute ? <Feather name="user" size={size ?? 20} color={color} /> : <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} /> }} />
    <Tabs.Screen name="notifications" options={parkingRoute ? { href: null } : { title: "Notifications", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "notifications" : "notifications-outline"} size={size} color={color} /> }} />
    <Tabs.Screen name="subscription" options={parkingRoute ? { title: "Subscription", tabBarIcon: ({ color, size }) => <Feather name="credit-card" size={size ?? 20} color={color} /> } : { href: null }} />
    <Tabs.Screen name="public-listing" options={{ href: null }} />
    <Tabs.Screen name="verification" options={{ href: null }} />
    <Tabs.Screen name="account-updates" options={{ href: null }} />
  </Tabs></View>;
}
