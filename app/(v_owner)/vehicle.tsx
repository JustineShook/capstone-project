import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VehicleActions, VehicleDetailCard } from "../../components/owner/VehicleDetailCard";
import { addVehicle, deleteVehicle, subscribeToMyVehicles, updateVehicle } from "../../services/owner/vehicleService";
import type { SavedVehicle, SavedVehicleInput, SavedVehicleType } from "../../types/owner/vehicle";
import { VEHICLE_TYPES } from "../../types/owner/vehicle";

const COLORS = { primary:"#F52239",white:"#F4F6F8",background:"#0C1015",surface:"#151C23",surfaceAlt:"#1C252E",textPrimary:"#F4F6F8",textSecondary:"#AAB5C0",border:"#28313A" };
const EMPTY_FORM = { type: "Car" as SavedVehicleType, make: "", model: "", year: "", color: "", plateNumber: "" };

export default function VehicleScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      return subscribeToMyVehicles((items) => {
        setVehicles(items);
        setSelectedVehicleId((current) => current && items.some((item) => item.vehicleId === current) ? current : items[0]?.vehicleId ?? null);
        setLoading(false);
      }, (error) => { setLoading(false); Alert.alert("Vehicles unavailable", error.message); });
    } catch (error) { setLoading(false); Alert.alert("Sign in required", (error as Error).message); }
  }, []);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.vehicleId === selectedVehicleId) ?? null;
  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalVisible(true); };
  const openEdit = (vehicle: SavedVehicle) => { setEditingId(vehicle.vehicleId); setForm({ type: vehicle.type, make: vehicle.make, model: vehicle.model, year: String(vehicle.year), color: vehicle.color, plateNumber: vehicle.plateNumber }); setModalVisible(true); };

  const save = async () => {
    const year = Number(form.year);
    if (!form.make.trim() || !form.model.trim() || !form.color.trim() || !form.plateNumber.trim() || !Number.isInteger(year) || year < 1900 || year > 2100) {
      Alert.alert("Invalid vehicle", "Complete every field and enter a valid four-digit year."); return;
    }
    const input: SavedVehicleInput = { type: form.type, make: form.make, model: form.model, year, color: form.color, plateNumber: form.plateNumber };
    setSaving(true);
    try { if (editingId) await updateVehicle(editingId, input); else await addVehicle(input); setModalVisible(false); }
    catch (error) { Alert.alert("Could not save vehicle", (error as Error).message); }
    finally { setSaving(false); }
  };

  const confirmDelete = (vehicle: SavedVehicle) => Alert.alert("Delete vehicle", `Delete ${vehicle.make} ${vehicle.model}?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => void deleteVehicle(vehicle.vehicleId).catch((error) => Alert.alert("Could not delete vehicle", (error as Error).message)) },
  ]);

  return <SafeAreaView style={styles.safeArea} edges={["top","left","right"]}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.background}/>
    <View style={styles.titleRow}><View><Text style={styles.eyebrow}>GARAGE</Text><Text style={styles.pageTitle}>My Vehicles</Text></View><Pressable style={styles.addButton} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add vehicle"><Ionicons name="add" size={19} color={COLORS.white}/></Pressable></View>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {loading ? <ActivityIndicator color={COLORS.primary} style={styles.loading}/> : vehicles.length === 0 ? <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="car-outline" size={30} color={COLORS.primary}/></View><Text style={styles.emptyTitle}>No vehicles yet</Text><Text style={styles.emptyText}>Add your first vehicle to keep its details in VeResc.</Text><Pressable style={styles.emptyButton} onPress={openAdd}><Text style={styles.emptyButtonText}>Add Vehicle</Text></Pressable></View> : <>
        <View style={styles.sectionHeading}><Text style={styles.sectionLabel}>Your garage</Text><Text style={styles.vehicleCount}>{vehicles.length} {vehicles.length===1?"vehicle":"vehicles"}</Text></View>
        <View style={styles.vehicleList}>{vehicles.map((vehicle) => <Pressable key={vehicle.vehicleId} style={[styles.switcherCard,vehicle.vehicleId===selectedVehicleId&&styles.switcherCardSelected]} onPress={()=>setSelectedVehicleId(vehicle.vehicleId)} accessibilityRole="button" accessibilityState={{ selected: vehicle.vehicleId===selectedVehicleId }}><View style={[styles.switcherIconWrap,vehicle.vehicleId===selectedVehicleId&&styles.switcherIconWrapSelected]}><Ionicons name={vehicle.type==="Motorcycle"?"bicycle-outline":"car-sport-outline"} size={20} color={vehicle.vehicleId===selectedVehicleId?COLORS.white:COLORS.primary}/></View><View style={styles.switcherBody}><Text style={styles.switcherName} numberOfLines={1}>{vehicle.make} {vehicle.model}</Text><Text style={styles.switcherPlate}>{vehicle.year} · {vehicle.plateNumber}</Text></View><View style={[styles.selectorDot,vehicle.vehicleId===selectedVehicleId&&styles.selectorDotSelected]}>{vehicle.vehicleId===selectedVehicleId&&<Ionicons name="checkmark" size={12} color={COLORS.white}/>}</View></Pressable>)}</View>
        <View style={styles.sectionHeading}><Text style={styles.sectionLabel}>Selected vehicle</Text></View>
        {selectedVehicle && <VehicleDetailCard vehicle={selectedVehicle} showActions={false} onHistory={() => router.push({ pathname: "/(v_owner)/vehicle-history", params: { vehicleId: selectedVehicle.vehicleId } })} onEdit={() => openEdit(selectedVehicle)} onDelete={() => confirmDelete(selectedVehicle)} />}
      </>}
    </ScrollView>
    {!loading && selectedVehicle && <VehicleActions onHistory={() => router.push({ pathname: "/(v_owner)/vehicle-history", params: { vehicleId: selectedVehicle.vehicleId } })} onEdit={() => openEdit(selectedVehicle)} onDelete={() => confirmDelete(selectedVehicle)} />}
    <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={()=>setModalVisible(false)}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === "ios" ? "padding" : "height"}><View style={[styles.modalBackdrop,{justifyContent:"center",alignItems:"center",padding:18}]}><View style={[styles.modalCard,{width:"100%",maxWidth:520,maxHeight:"90%",borderRadius:20,borderWidth:1,borderColor:COLORS.border}]}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingId?"Edit Vehicle":"Add Vehicle"}</Text><Pressable onPress={()=>setModalVisible(false)}><Ionicons name="close" size={24} color={COLORS.textPrimary}/></Pressable></View><ScrollView style={{flexShrink:1}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.inputLabel}>Vehicle Type</Text><View style={styles.types}>{VEHICLE_TYPES.map((type)=><Pressable key={type} style={[styles.typeChip,form.type===type&&styles.typeChipActive]} onPress={()=>setForm({...form,type})}><Text style={[styles.typeChipText,form.type===type&&styles.typeChipTextActive]}>{type}</Text></Pressable>)}</View>
      <Field label="Make / Brand" value={form.make} change={(make)=>setForm({...form,make})}/><Field label="Model" value={form.model} change={(model)=>setForm({...form,model})}/><Field label="Year" value={form.year} change={(year)=>setForm({...form,year})} numeric/><Field label="Color" value={form.color} change={(color)=>setForm({...form,color})}/><Field label="Plate Number" value={form.plateNumber} change={(plateNumber)=>setForm({...form,plateNumber})} autoCapitalize="characters"/>
      <Pressable style={styles.saveButton} disabled={saving} onPress={()=>void save()}>{saving?<ActivityIndicator color={COLORS.surface}/>:<Text style={styles.saveButtonText}>{editingId?"Save Changes":"Add Vehicle"}</Text>}</Pressable>
    </ScrollView></View></View></KeyboardAvoidingView></Modal>
  </SafeAreaView>;
}

function Field({label,value,change,numeric,autoCapitalize="sentences"}:{label:string;value:string;change:(value:string)=>void;numeric?:boolean;autoCapitalize?:"none"|"sentences"|"words"|"characters"}) { return <View style={styles.field}><Text style={styles.inputLabel}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={change} keyboardType={numeric?"number-pad":"default"} autoCapitalize={autoCapitalize}/></View>; }

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:COLORS.background},container:{flex:1},contentContainer:{paddingHorizontal:18,paddingBottom:20},titleRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:18,paddingTop:12,paddingBottom:18},eyebrow:{fontSize:11,fontWeight:"800",letterSpacing:1.2,color:COLORS.primary,marginBottom:4},pageTitle:{fontSize:27,fontWeight:"800",color:COLORS.textPrimary},addButton:{width:42,height:42,borderRadius:13,backgroundColor:COLORS.primary,alignItems:"center",justifyContent:"center"},sectionHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10,marginLeft:2},sectionLabel:{fontSize:13,fontWeight:"700",color:COLORS.textSecondary,textTransform:"uppercase",letterSpacing:.7},vehicleCount:{fontSize:12,fontWeight:"600",color:COLORS.textSecondary},vehicleList:{gap:9,marginBottom:22},switcherCard:{width:"100%",flexDirection:"row",alignItems:"center",padding:13,borderRadius:15,borderWidth:1,borderColor:COLORS.border,backgroundColor:COLORS.surface},switcherCardSelected:{borderColor:COLORS.primary,backgroundColor:"#1A2027"},switcherIconWrap:{width:42,height:42,borderRadius:12,backgroundColor:"#3A2025",alignItems:"center",justifyContent:"center",marginRight:12},switcherIconWrapSelected:{backgroundColor:COLORS.primary},switcherBody:{flex:1},switcherName:{fontSize:15,fontWeight:"700",color:COLORS.textPrimary},switcherPlate:{fontSize:12.5,color:COLORS.textSecondary,marginTop:4},selectorDot:{width:22,height:22,borderRadius:11,borderWidth:1.5,borderColor:COLORS.border,alignItems:"center",justifyContent:"center",marginLeft:10},selectorDotSelected:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},loading:{marginTop:80},empty:{backgroundColor:COLORS.surface,borderWidth:1,borderColor:COLORS.border,borderRadius:16,padding:28,alignItems:"center"},emptyIcon:{width:64,height:64,borderRadius:32,backgroundColor:"#3A2025",alignItems:"center",justifyContent:"center"},emptyTitle:{fontSize:18,fontWeight:"700",color:COLORS.textPrimary,marginTop:14},emptyText:{fontSize:13,color:COLORS.textSecondary,textAlign:"center",marginTop:5},emptyButton:{backgroundColor:COLORS.primary,borderRadius:12,paddingHorizontal:20,paddingVertical:12,marginTop:18},emptyButtonText:{color:COLORS.white,fontWeight:"700"},modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.35)",justifyContent:"flex-end"},modalCard:{backgroundColor:COLORS.surface,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,maxHeight:"90%"},modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:18},modalTitle:{fontSize:18,fontWeight:"700",color:COLORS.textPrimary},inputLabel:{fontSize:13,fontWeight:"600",color:COLORS.textSecondary,marginBottom:7},types:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:16},typeChip:{borderWidth:1,borderColor:COLORS.border,borderRadius:20,paddingHorizontal:12,paddingVertical:7},typeChipActive:{backgroundColor:"#3A2025",borderColor:COLORS.primary},typeChipText:{fontSize:12.5,color:COLORS.textSecondary},typeChipTextActive:{color:COLORS.primary,fontWeight:"600"},field:{marginBottom:14},input:{borderWidth:1,borderColor:COLORS.border,borderRadius:10,paddingHorizontal:12,paddingVertical:11,fontSize:14,color:COLORS.textPrimary},saveButton:{backgroundColor:COLORS.primary,borderRadius:14,paddingVertical:14,alignItems:"center",marginTop:6,marginBottom:20},saveButtonText:{color:COLORS.white,fontSize:15,fontWeight:"700"}});
