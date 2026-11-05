// app/(towing-company)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  background: "#0F52BA",
  active: "#FFFFFF",
  inactive: "#D6E4FA",
  border: "#D5DEE9",
  shadow: "#172B4D",
};

export default function TowingCompanyLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderColor: COLORS.background,
          borderWidth: 1,
          borderTopWidth: 1,
          borderRadius: 22,
          marginLeft: Math.max(insets.left, width < 360 ? 8 : 16),
          marginRight: Math.max(insets.right, width < 360 ? 8 : 16),
          marginTop: 8,
          marginBottom: Math.max(insets.bottom, 12),
          height: 70,
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: COLORS.shadow,
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "clipboard" : "clipboard-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="towing-history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="notifications" options={{ title: "Notifications", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "notifications" : "notifications-outline"} size={size} color={color} /> }} />

      {/* Hidden from the tab bar, but still reachable via router.push */}
      <Tabs.Screen
        name="verification"
        options={{ href: null }}
      />
      <Tabs.Screen name="public-listing" options={{ href: null }} />
      <Tabs.Screen name="towing-pricing" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="account-updates" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen
        name="request-details"
        options={{
          href: null,
        }}
      />
    </Tabs>
    </View>
  );
}
