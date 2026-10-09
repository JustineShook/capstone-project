// app/(towing-company)/_layout.tsx
import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const COLORS = {
  background: "#090A0C",
  active: "#F51F3B",
  inactive: "#9AA6AE",
};

export default function TowingCompanyLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          paddingTop: 5,
          paddingBottom: 4,
          height: 57,
          borderTopColor: "#252629",
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clipboard" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="towing-history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clock" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size ?? 20} color={color} />
          ),
        }}
      />

      {/* Hidden from the tab bar, but still reachable via router.push */}
      <Tabs.Screen
        name="verification"
        options={{ href: null }}
      />
      <Tabs.Screen name="public-listing" options={{ href: null }} />
      <Tabs.Screen name="towing-pricing" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen
        name="request-details"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
