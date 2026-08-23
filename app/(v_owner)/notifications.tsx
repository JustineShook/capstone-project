import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsScreen() {
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.title}>Notifications</Text>
				<Text style={styles.subtitle}>You have no new notifications.</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#FFFFFF" },
	content: { flex: 1, padding: 24 },
	title: { color: "#1A1A1A", fontSize: 28, fontWeight: "700" },
	subtitle: { color: "#6B6B6B", fontSize: 16, marginTop: 8 },
});