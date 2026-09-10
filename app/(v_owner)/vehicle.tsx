import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VehicleDetailCard } from "../../components/owner/VehicleDetailCard";
import { addVehicle, deleteVehicle, subscribeToMyVehicles, updateVehicle } from "../../services/owner/vehicleService";
import type { SavedVehicle, SavedVehicleInput, SavedVehicleType } from "../../types/owner/vehicle";
import { VEHICLE_TYPES } from "../../types/owner/vehicle";

const COLORS = { primary:"#D32F2F",white:"#FFFFFF",background:"#F7F7F7",textPrimary:"#1A1A1A",textSecondary:"#7A7A7A",border:"#EDEDED" };
const EMPTY_FORM = { type: "Car" as SavedVehicleType, make: "", model: "", year: "", color: "", plateNumber: "" };

export default function VehicleScreen() {
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
    <StatusBar barStyle="dark-content" backgroundColor={COLORS.background}/>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}><Text style={styles.pageTitle}>My Vehicles</Text><Pressable style={styles.addButton} onPress={openAdd} accessibilityLabel="Add vehicle"><Ionicons name="add" size={18} color={COLORS.white}/></Pressable></View>
      {loading ? <ActivityIndicator color={COLORS.primary} style={styles.loading}/> : vehicles.length === 0 ? <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="car-outline" size={30} color={COLORS.primary}/></View><Text style={styles.emptyTitle}>No vehicles yet</Text><Text style={styles.emptyText}>Add your first vehicle to keep its details in VeResc.</Text><Pressable style={styles.emptyButton} onPress={openAdd}><Text style={styles.emptyButtonText}>Add Vehicle</Text></Pressable></View> : <>
        <Text style={styles.sectionLabel}>Select Vehicle</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcherRow}>{vehicles.map((vehicle) => <Pressable key={vehicle.vehicleId} style={[styles.switcherCard,vehicle.vehicleId===selectedVehicleId&&styles.switcherCardSelected]} onPress={()=>setSelectedVehicleId(vehicle.vehicleId)}><View style={styles.switcherIconWrap}><Ionicons name={vehicle.type==="Motorcycle"?"bicycle-outline":"car-outline"} size={18} color={COLORS.primary}/></View><View style={styles.switcherBody}><Text style={styles.switcherName} numberOfLines={1}>{vehicle.make} {vehicle.model}</Text><Text style={styles.switcherPlate}>{vehicle.plateNumber}</Text></View></Pressable>)}</ScrollView>
        <Text style={styles.sectionLabel}>Vehicle Details</Text>
        {selectedVehicle && <VehicleDetailCard vehicle={selectedVehicle} onEdit={() => openEdit(selectedVehicle)} onDelete={() => confirmDelete(selectedVehicle)} />}
      </>}
    </ScrollView>
    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={()=>setModalVisible(false)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingId?"Edit Vehicle":"Add Vehicle"}</Text><Pressable onPress={()=>setModalVisible(false)}><Ionicons name="close" size={24} color={COLORS.textPrimary}/></Pressable></View><ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.inputLabel}>Vehicle Type</Text><View style={styles.types}>{VEHICLE_TYPES.map((type)=><Pressable key={type} style={[styles.typeChip,form.type===type&&styles.typeChipActive]} onPress={()=>setForm({...form,type})}><Text style={[styles.typeChipText,form.type===type&&styles.typeChipTextActive]}>{type}</Text></Pressable>)}</View>
      <Field label="Make / Brand" value={form.make} change={(make)=>setForm({...form,make})}/><Field label="Model" value={form.model} change={(model)=>setForm({...form,model})}/><Field label="Year" value={form.year} change={(year)=>setForm({...form,year})} numeric/><Field label="Color" value={form.color} change={(color)=>setForm({...form,color})}/><Field label="Plate Number" value={form.plateNumber} change={(plateNumber)=>setForm({...form,plateNumber})} autoCapitalize="characters"/>
      <Pressable style={styles.saveButton} disabled={saving} onPress={()=>void save()}>{saving?<ActivityIndicator color={COLORS.white}/>:<Text style={styles.saveButtonText}>{editingId?"Save Changes":"Add Vehicle"}</Text>}</Pressable>
    </ScrollView></View></View></Modal>
  </SafeAreaView>;
}

function Field({label,value,change,numeric,autoCapitalize="sentences"}:{label:string;value:string;change:(value:string)=>void;numeric?:boolean;autoCapitalize?:"none"|"sentences"|"words"|"characters"}) { return <View style={styles.field}><Text style={styles.inputLabel}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={change} keyboardType={numeric?"number-pad":"default"} autoCapitalize={autoCapitalize}/></View>; }

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:COLORS.background},container:{flex:1},contentContainer:{paddingHorizontal:16,paddingBottom:32},titleRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:8,marginBottom:16},pageTitle:{fontSize:24,fontWeight:"700",color:COLORS.textPrimary},addButton:{width:34,height:34,borderRadius:10,backgroundColor:COLORS.primary,alignItems:"center",justifyContent:"center"},sectionLabel:{fontSize:13,fontWeight:"600",color:COLORS.textSecondary,marginBottom:8,marginLeft:4,textTransform:"uppercase",letterSpacing:.4},switcherRow:{gap:10,paddingBottom:24},switcherCard:{minWidth:174,flexDirection:"row",alignItems:"center",padding:12,borderRadius:14,borderWidth:1,borderColor:COLORS.border,backgroundColor:COLORS.white},switcherCardSelected:{borderColor:COLORS.primary},switcherIconWrap:{width:32,height:32,borderRadius:8,backgroundColor:"#FDECEC",alignItems:"center",justifyContent:"center",marginRight:10},switcherBody:{flex:1},switcherName:{fontSize:14.5,fontWeight:"500",color:COLORS.textPrimary},switcherPlate:{fontSize:12.5,color:COLORS.textSecondary,marginTop:2},loading:{marginTop:80},empty:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.border,borderRadius:16,padding:28,alignItems:"center"},emptyIcon:{width:64,height:64,borderRadius:32,backgroundColor:"#FDECEC",alignItems:"center",justifyContent:"center"},emptyTitle:{fontSize:18,fontWeight:"700",color:COLORS.textPrimary,marginTop:14},emptyText:{fontSize:13,color:COLORS.textSecondary,textAlign:"center",marginTop:5},emptyButton:{backgroundColor:COLORS.primary,borderRadius:12,paddingHorizontal:20,paddingVertical:12,marginTop:18},emptyButtonText:{color:COLORS.white,fontWeight:"700"},modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.35)",justifyContent:"flex-end"},modalCard:{backgroundColor:COLORS.white,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,maxHeight:"90%"},modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:18},modalTitle:{fontSize:18,fontWeight:"700",color:COLORS.textPrimary},inputLabel:{fontSize:13,fontWeight:"600",color:COLORS.textSecondary,marginBottom:7},types:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:16},typeChip:{borderWidth:1,borderColor:COLORS.border,borderRadius:20,paddingHorizontal:12,paddingVertical:7},typeChipActive:{backgroundColor:"#FDECEC",borderColor:COLORS.primary},typeChipText:{fontSize:12.5,color:COLORS.textSecondary},typeChipTextActive:{color:COLORS.primary,fontWeight:"600"},field:{marginBottom:14},input:{borderWidth:1,borderColor:COLORS.border,borderRadius:10,paddingHorizontal:12,paddingVertical:11,fontSize:14,color:COLORS.textPrimary},saveButton:{backgroundColor:COLORS.primary,borderRadius:14,paddingVertical:14,alignItems:"center",marginTop:6,marginBottom:20},saveButtonText:{color:COLORS.white,fontSize:15,fontWeight:"700"}});
