// app/(v_owner)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { subscribeToCustomerNotifications } from "../../services/customerNotificationService";

const colors = {
  primary: "#F52239",
  inactive: "#7E8B97",
  background: "#0C1015",
  border: "#28313A",
};

export default function VOwnerLayout() {
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => subscribeToCustomerNotifications(
    (items) => setUnreadNotificationCount(items.filter((item) => !item.isRead).length),
    () => setUnreadNotificationCount(0),
  ), []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen name="towing-booking/book-towing" options={{ href: null }} />
      <Tabs.Screen name="towing-booking/booking-confirmation" options={{ href: null }} />
      <Tabs.Screen name="towing-booking/booking-detail" options={{ href: null }} />
      <Tabs.Screen name="mechanic-booking/book-mechanic" options={{ href: null }} />
      <Tabs.Screen name="mechanic-booking/booking-confirmation" options={{ href: null }} />
      <Tabs.Screen name="mechanic-booking/booking-detail" options={{ href: null }} />
      <Tabs.Screen name="shop-booking" options={{ href: null }} />
      <Tabs.Screen name="homegarage-booking/book-homegarage" options={{ href: null }} />
      <Tabs.Screen name="homegarage-booking/booking-detail" options={{ href: null }} />
      <Tabs.Screen name="parking-booking/book-parking" options={{ href: null }} />
      <Tabs.Screen name="parking-booking/parking-detail" options={{ href: null }} />
      <Tabs.Screen name="personal-information" options={{ href: null }} />
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="vehicle-history" options={{ href: null }} />
      <Tabs.Screen name="provider-reviews" options={{ href: null }} />
      <Tabs.Screen name="help-support" options={{ href: null }} />
      <Tabs.Screen name="privacy-security" options={{ href: null }} />
      
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
        name="vehicle"
        options={{
          title: "Vehicles",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "car-sport" : "car-sport-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarBadge: unreadNotificationCount > 0
            ? unreadNotificationCount > 99 ? "99+" : unreadNotificationCount
            : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: "#FFFFFF" },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
