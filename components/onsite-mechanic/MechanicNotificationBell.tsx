import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { subscribeToMechanicNotifications } from "../../services/mechanicNotificationService";

export function MechanicNotificationBell({
  style,
  size = 22,
  color = "#FFFFFF",
}: {
  style?: StyleProp<ViewStyle>;
  size?: number;
  color?: string;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => subscribeToMechanicNotifications(
    (items) => setUnreadCount(items.filter((item) => !item.isRead).length),
    () => setUnreadCount(0),
  ), []);

  return (
    <Pressable
      style={[styles.button, style]}
      onPress={() => router.push("/(onsite-mechanic)/notifications")}
      accessibilityRole="button"
      accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Feather name="bell" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", top: 2, right: 1, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#F51F3B", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#090A0C" },
  badgeText: { color: "#FFFFFF", fontSize: 9, lineHeight: 12, fontWeight: "800" },
});
