import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SavedVehicle } from "../../types/owner/vehicle";

const COLORS = { primary: "#D32F2F", darkRed: "#B71C1C", white: "#FFFFFF", textPrimary: "#1A1A1A", textSecondary: "#7A7A7A", border: "#EDEDED" };

function DetailRow({ icon, label, value, isLast }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; isLast?: boolean }) {
  return <View style={[styles.row, isLast && styles.rowLast]}><View style={styles.rowIconWrap}><Ionicons name={icon} size={18} color={COLORS.primary} /></View><View><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View></View>;
}

export function VehicleDetailCard({ vehicle, onEdit, onDelete, onHistory }: { vehicle: SavedVehicle; onEdit: () => void; onDelete: () => void; onHistory: () => void }) {
  return <>
    <View style={styles.identityCard}>
      <View style={styles.vehicleIconWrap}><Ionicons name={vehicle.type === "Motorcycle" ? "bicycle-outline" : "car-sport-outline"} size={38} color={COLORS.white} /></View>
      <Text style={styles.vehicleName}>{vehicle.make} {vehicle.model}</Text>
      <Text style={styles.vehiclePlate}>{vehicle.plateNumber}</Text>
      <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{vehicle.type}</Text></View>
    </View>
    <View style={styles.card}>
      <DetailRow icon="business-outline" label="Brand" value={vehicle.make} />
      <DetailRow icon="car-outline" label="Model" value={vehicle.model} />
      <DetailRow icon="calendar-outline" label="Year" value={String(vehicle.year)} />
      <DetailRow icon="color-palette-outline" label="Color" value={vehicle.color} />
      <DetailRow icon="card-outline" label="Plate Number" value={vehicle.plateNumber} isLast />
    </View>
    <View style={styles.actions}>
      <Pressable style={styles.historyButton} onPress={onHistory} accessibilityLabel="Vehicle history"><Ionicons name="time-outline" size={17} color={COLORS.primary} /><Text style={styles.historyText}>History</Text></Pressable>
      <Pressable style={styles.editButton} onPress={onEdit}><Ionicons name="create-outline" size={17} color={COLORS.white} /><Text style={styles.editText}>Edit Vehicle</Text></Pressable>
      <Pressable style={styles.deleteButton} onPress={onDelete}><Ionicons name="trash-outline" size={17} color={COLORS.primary} /><Text style={styles.deleteText}>Delete</Text></Pressable>
    </View>
  </>;
}

const styles = StyleSheet.create({
  identityCard:{backgroundColor:COLORS.white,borderRadius:16,paddingVertical:28,paddingHorizontal:16,alignItems:"center",marginBottom:24,borderWidth:1,borderColor:COLORS.border},vehicleIconWrap:{width:76,height:76,borderRadius:38,backgroundColor:COLORS.primary,alignItems:"center",justifyContent:"center",marginBottom:14},vehicleName:{fontSize:18,fontWeight:"700",color:COLORS.textPrimary},vehiclePlate:{fontSize:13,color:COLORS.textSecondary,marginTop:4},typeBadge:{marginTop:14,backgroundColor:"#FDECEC",paddingHorizontal:14,paddingVertical:6,borderRadius:20},typeBadgeText:{fontSize:12,fontWeight:"600",color:COLORS.darkRed},card:{backgroundColor:COLORS.white,borderRadius:14,marginBottom:16,borderWidth:1,borderColor:COLORS.border,overflow:"hidden"},row:{flexDirection:"row",alignItems:"center",paddingVertical:14,paddingHorizontal:14,borderBottomWidth:1,borderBottomColor:COLORS.border},rowLast:{borderBottomWidth:0},rowIconWrap:{width:32,height:32,borderRadius:8,backgroundColor:"#FDECEC",alignItems:"center",justifyContent:"center",marginRight:12},rowLabel:{fontSize:14.5,fontWeight:"500",color:COLORS.textPrimary},rowValue:{fontSize:12.5,color:COLORS.textSecondary,marginTop:2},actions:{flexDirection:"row",gap:10,marginBottom:24},historyButton:{paddingHorizontal:13,borderWidth:1,borderColor:COLORS.primary,borderRadius:14,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:5},historyText:{color:COLORS.primary,fontSize:14,fontWeight:"700"},editButton:{flex:1,backgroundColor:COLORS.primary,borderRadius:14,paddingVertical:13,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7},editText:{color:COLORS.white,fontSize:14,fontWeight:"700"},deleteButton:{paddingHorizontal:13,borderWidth:1,borderColor:COLORS.primary,borderRadius:14,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:6},deleteText:{color:COLORS.primary,fontSize:14,fontWeight:"700"}
});
