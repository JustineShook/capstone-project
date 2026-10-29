// app/(v_owner)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Link, Redirect, Tabs, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { subscribeToCustomerNotifications } from "../../services/customerNotificationService";
import { useAuth } from "../../hooks/useAuth";

const colors = {
  primary: "#F52239",
  inactive: "#7E8B97",
  background: "#0C1015",
  border: "#28313A",
};

export default function VOwnerLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const guest = !user;
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => user ? subscribeToCustomerNotifications(
    (items) => setUnreadNotificationCount(items.filter((item) => !item.isRead).length),
    () => setUnreadNotificationCount(0),
  ) : undefined, [user]);

  const ownerScreen = segments[1];
  if (loading) return null;
  if (guest && ownerScreen) return <Redirect href="/(v_owner)" />;

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
          tabBarButton: guest ? (props) => {
            const homeColor = props.accessibilityState?.selected ? colors.primary : colors.inactive;
            return (
              <View style={[props.style, { flexDirection: "row", alignItems: "stretch" }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Home"
                  accessibilityState={props.accessibilityState}
                  onPress={props.onPress}
                  onLongPress={props.onLongPress}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
                >
                  <Ionicons name={props.accessibilityState?.selected ? "home" : "home-outline"} size={22} color={homeColor} />
                  <Text style={{ color: homeColor, fontSize: 11, fontWeight: "600" }}>Home</Text>
                </Pressable>
                <Link href="/(auth)/login" asChild>
                  <Pressable accessibilityRole="button" accessibilityLabel="Log In" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
                    <Ionicons name="log-in-outline" size={22} color={colors.inactive} />
                    <Text style={{ color: colors.inactive, fontSize: 11, fontWeight: "600" }}>Log In</Text>
                  </Pressable>
                </Link>
                <Link href="/(auth)/register" asChild>
                  <Pressable accessibilityRole="button" accessibilityLabel="Sign Up" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
                    <Ionicons name="person-add-outline" size={22} color={colors.inactive} />
                    <Text style={{ color: colors.inactive, fontSize: 11, fontWeight: "600" }}>Sign Up</Text>
                  </Pressable>
                </Link>
              </View>
            );
          } : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="vehicle"
        options={{
          href: guest ? null : undefined,
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
          href: guest ? null : undefined,
          title: "History",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: guest ? null : undefined,
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
          href: guest ? null : undefined,
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
