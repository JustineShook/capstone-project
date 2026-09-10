import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../../components/shop-owner/ShopUI";
import { useAuth } from "../../hooks/useAuth";
import { ShopDashboardProvider } from "../../hooks/useShopDashboard";

export default function ShopOwnerLayout() {
  const { user, userProfile, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.primary} /></View>;
  if (!user || !userProfile) return <Redirect href="/(auth)/login" />;
  if (userProfile.role !== "shop-owner") return <Redirect href="/" />;

  return <ShopDashboardProvider key={user.uid} account={userProfile}>
    <Tabs backBehavior="history" screenOptions={{
      headerShown: false, tabBarActiveTintColor: C.white, tabBarInactiveTintColor: "rgba(255,255,255,.65)",
      tabBarStyle: { backgroundColor: C.primary, borderTopWidth: 0, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), height: 48 + Math.max(insets.bottom, 10) },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="requests" options={{ title: "Requests", tabBarIcon: ({ color, size }) => <Feather name="file-text" color={color} size={size} /> }} />
      <Tabs.Screen name="service-history" options={{ title: "History", tabBarIcon: ({ color, size }) => <Feather name="clock" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />
      <Tabs.Screen name="request-details" options={{ href: null }} />
      <Tabs.Screen name="active-service" options={{ href: null }} />
      <Tabs.Screen name="public-listing" options={{ href: null }} />
    </Tabs>
  </ShopDashboardProvider>;
}
