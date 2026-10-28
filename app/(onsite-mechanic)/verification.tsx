// app/(onsite-mechanic)/verification.tsx
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";
import { getProviderProfile, saveProviderProfile, updateMechanicProviderProfile, uploadVerificationFile } from "../../services/providerProfileService";
import type { OnsiteMechanicProviderProfile } from "../../types/onsiteMechanicProfile";
// @ts-expect-error Expo Metro selects the .web or .native implementation by platform.
import DateOfBirthInput from "../../components/verification/DateOfBirthInput";

const COLORS = { primary:"#F52239", primaryMuted:"#321A20", background:"#0C1015", sectionBackground:"#101820", text:"#F4F6F8", textMuted:"#AAB5C0", border:"#2C3944", success:"#39D98A", successMuted:"#173127" };
const ID_TYPE_OPTIONS = ["Driver's License","UMID","PhilSys ID","Passport"];
const TOTAL_STEPS = 2;
type AddressSuggestion = { id: string; label: string; cityMunicipality: string };
type PhotonFeature = { geometry?: { coordinates?: number[] }; properties?: { name?: string; street?: string; housenumber?: string; district?: string; city?: string; county?: string; state?: string; country?: string; osm_type?: string; osm_id?: string | number } };

type Draft = { personal:{fullName:string;phone:string;dateOfBirth:string;address:string;cityMunicipality:string}; professional:{yearsOfExperience:string;serviceArea:string;maxTravelDistanceKm:string}; identification:{idType:string;idNumber:string}; credentials:{tesdaCertificate:string;certificationNumber:string}; consentAccepted:boolean };
type UploadKind = "valid-id" | "valid-id-back" | "profile-photo" | "face-photo" | "certificate";
type UploadedDocument = { url:string; label:string };
const initialDraft: Draft = { personal:{fullName:"",phone:"",dateOfBirth:"",address:"",cityMunicipality:""}, professional:{yearsOfExperience:"",serviceArea:"",maxTravelDistanceKm:""}, identification:{idType:"",idNumber:""}, credentials:{tesdaCertificate:"",certificationNumber:""}, consentAccepted:false };

function SectionCard({ title, children }: { title:string; children:React.ReactNode }) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{children}</View>; }
function FieldLabel({ label, required }: { label:string; required?:boolean }) { return <Text style={styles.fieldLabel}>{label}{required && <Text style={styles.requiredAsterisk}> *</Text>}</Text>; }
function ChipMultiSelect({ options, selected, onToggle }: { options:string[]; selected:string[]; onToggle:(value:string)=>void }) { return <View style={styles.chipRow}>{options.map(option => { const active=selected.includes(option); return <TouchableOpacity key={option} style={[styles.chip,active&&styles.chipActive]} onPress={()=>onToggle(option)}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{option}</Text></TouchableOpacity>; })}</View>; }
function ChipSingleSelect({ options, selected, onSelect }: { options:string[]; selected:string; onSelect:(value:string)=>void }) { return <View style={styles.chipRow}>{options.map(option => <TouchableOpacity key={option} style={[styles.chip,selected===option&&styles.chipActive]} onPress={()=>onSelect(option)}><Text style={[styles.chipText,selected===option&&styles.chipTextActive]}>{option}</Text></TouchableOpacity>)}</View>; }
function UploadBox({ label, description, required, file, uploading, onPress }: { label:string; description:string; required?:boolean; file:UploadedDocument|null; uploading:boolean; onPress:()=>void }) { return <View style={styles.fieldBlock}><FieldLabel label={label} required={required}/><TouchableOpacity disabled={uploading} style={[styles.uploadBox,file&&styles.uploadBoxDone,uploading&&styles.disabled]} onPress={onPress}><Feather name={file?"check-circle":"upload-cloud"} size={18} color={file?COLORS.success:COLORS.primary}/><Text style={[styles.uploadBoxText,file&&styles.uploadBoxTextDone]}>{uploading ? "Uploading..." : file ? file.label : "Tap to upload"}</Text></TouchableOpacity><Text style={styles.helperText}>{description}</Text></View>; }
function SegmentedYesNo({ value,onChange }:{value:boolean|null;onChange:(value:boolean)=>void}) { return <View style={styles.segmentedControl}>{[true,false].map(option=><TouchableOpacity key={String(option)} style={[styles.segment,value===option&&styles.segmentActive]} onPress={()=>onChange(option)}><Text style={[styles.segmentText,value===option&&styles.segmentTextActive]}>{option?"YES":"NO"}</Text></TouchableOpacity>)}</View>; }
function getUploadErrorMessage(error: unknown): string { const firebaseError=error as {code?:unknown;message?:unknown}; const code=typeof firebaseError.code==="string"?firebaseError.code:"unknown"; const message=typeof firebaseError.message==="string"?firebaseError.message:String(error); return `${code}: ${message}`; }

export default function VerificationScreen() {
  const router=useRouter(); const insets=useSafeAreaInsets(); const { mode }=useLocalSearchParams<{mode?:string}>(); const isEditMode=mode==="edit";
  const [step,setStep]=useState(1); const [draft,setDraft]=useState<Draft>(initialDraft);
  const [validId,setValidId]=useState<UploadedDocument|null>(null); const [validIdBack,setValidIdBack]=useState<UploadedDocument|null>(null); const [profilePhoto,setProfilePhoto]=useState<UploadedDocument|null>(null); const [facePhoto,setFacePhoto]=useState<UploadedDocument|null>(null); const [certificate,setCertificate]=useState<UploadedDocument|null>(null);
  const [uploading,setUploading]=useState<UploadKind|null>(null); const [loading,setLoading]=useState(true); const [loadError,setLoadError]=useState<string|null>(null); const [submitting,setSubmitting]=useState(false); const [submitted,setSubmitted]=useState(false); const [lockedStatus,setLockedStatus]=useState<"PENDING"|"VERIFIED"|null>(null);
  const [addressSuggestions,setAddressSuggestions]=useState<AddressSuggestion[]>([]);
  const [addressSearchError,setAddressSearchError]=useState("");
  const [addressSearching,setAddressSearching]=useState(false);
  const [addressQuery,setAddressQuery]=useState("");
  const [showAddressSuggestions,setShowAddressSuggestions]=useState(false);
  const addressSearchTimeout=useRef<ReturnType<typeof setTimeout>|null>(null);
  const addressSearchController=useRef<AbortController|null>(null);

  const loadSavedProfile=async()=>{
    const user=auth.currentUser;
    if(!user){setLoadError("You need to sign in before completing verification.");setLoading(false);return;}
    setLoading(true);setLoadError(null);
    try {
      const saved=await getProviderProfile(user.uid);
      if(saved){
        setDraft({ personal:saved.personal, professional:{yearsOfExperience:String(saved.professional.yearsOfExperience),serviceArea:saved.professional.serviceArea,maxTravelDistanceKm:saved.professional.maxTravelDistanceKm==null?"":String(saved.professional.maxTravelDistanceKm)}, identification:{idType:saved.identification.idType,idNumber:saved.identification.idNumber}, credentials:{tesdaCertificate:saved.credentials.tesdaCertificate,certificationNumber:saved.credentials.certificationNumber}, consentAccepted:false });
        setValidId(saved.identification.validIdUrl ? {url:saved.identification.validIdUrl,label:"Previously uploaded"}:null);
        setValidIdBack(saved.identification.validIdBackUrl ? {url:saved.identification.validIdBackUrl,label:"Previously uploaded"}:null);
        setProfilePhoto(saved.identification.profilePhotoUrl ? {url:saved.identification.profilePhotoUrl,label:"Previously uploaded"}:null);
        setFacePhoto(saved.identification.facePhotoUrl ? {url:saved.identification.facePhotoUrl,label:"Previously uploaded"}:null);
        setCertificate(saved.credentials.certificateUrl ? {url:saved.credentials.certificateUrl,label:"Previously uploaded"}:null);
        if(!isEditMode&&(saved.verificationStatus==="PENDING"||saved.verificationStatus==="VERIFIED")) setLockedStatus(saved.verificationStatus);
      } else if(user.displayName) setDraft(prev=>({...prev,personal:{...prev.personal,fullName:user.displayName||""}}));
    } catch (error) { console.error("Failed to load mechanic verification profile:",error); setLoadError("We couldn't load your saved verification information. Check your connection and try again."); }
    finally {setLoading(false);}
  };
  useEffect(()=>{void loadSavedProfile();},[isEditMode]);
  const searchAddress=(text:string)=>{
    if(addressSearchTimeout.current)clearTimeout(addressSearchTimeout.current);
    addressSearchController.current?.abort();setAddressSearchError("");setAddressQuery(text);
    if(text.trim().length<3){setAddressSuggestions([]);setAddressSearching(false);return;}
    addressSearchTimeout.current=setTimeout(async()=>{
      const controller=new AbortController();addressSearchController.current=controller;setAddressSearching(true);
      try{
        const response=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text.trim())}&limit=5&lang=en&lat=12.8797&lon=121.7740`,{headers:{Accept:"application/json"},signal:controller.signal});
        if(!response.ok)throw new Error(`Location search failed (${response.status}).`);
        const data=await response.json() as {features?:PhotonFeature[]};
        const results=(data.features??[]).flatMap((feature,index)=>{
          const coordinates=feature.geometry?.coordinates;const p=feature.properties;
          if(!coordinates||!Number.isFinite(coordinates[0])||!Number.isFinite(coordinates[1])||!p)return [];
          const label=[p.name,[p.housenumber,p.street].filter(Boolean).join(" "),p.district,p.city,p.county,p.state,p.country].filter(Boolean).filter((part,index,array)=>array.indexOf(part)===index).join(", ");
          return [{id:`${p.osm_type??"place"}-${p.osm_id??index}`,label,cityMunicipality:p.city||p.county||p.district||""}];
        });
        setAddressSuggestions(results);if(!results.length)setAddressSearchError("No matching locations found.");
      }catch(error){if((error as Error).name!=="AbortError"){setAddressSuggestions([]);setAddressSearchError("Location search is unavailable. Check your connection or enter the address manually.");}}
      finally{if(addressSearchController.current===controller)setAddressSearching(false);}
    },650);
  };
  useEffect(()=>()=>{if(addressSearchTimeout.current)clearTimeout(addressSearchTimeout.current);addressSearchController.current?.abort();},[]);

  const update=(section:keyof Draft,field:string,value:string|boolean|null|string[])=>setDraft(prev=>({...prev,[section]:{...(prev[section] as object),[field]:value}}));

  const uploadImage=async(kind:"valid-id"|"valid-id-back"|"profile-photo"|"face-photo")=>{
    const user=auth.currentUser; if(!user){Alert.alert("Sign in required","Please sign in before uploading documents.");return;}
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync(); if(!permission.granted){Alert.alert("Permission required","Photo library permission is required to upload this document.");return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:0.8}); if(result.canceled||!result.assets?.[0]) return;
    const asset=result.assets[0]; if(asset.fileSize&&asset.fileSize>5*1024*1024){Alert.alert("File too large","Please select an image smaller than 5 MB.");return;}
    setUploading(kind);
    try { const uploadKind=kind==="valid-id-back"?"valid-id":kind==="face-photo"?"profile-photo":kind;const url=await uploadVerificationFile(user.uid,uploadKind,{uri:asset.uri,mimeType:asset.mimeType,name:asset.fileName,size:asset.fileSize}); const file={url,label:asset.fileName||"Upload complete"}; if(kind==="valid-id")setValidId(file);else if(kind==="valid-id-back")setValidIdBack(file);else if(kind==="face-photo")setFacePhoto(file);else setProfilePhoto(file); }
    catch(error){console.error(`Failed to upload ${kind}:`,error);Alert.alert("Upload failed",getUploadErrorMessage(error));}
    finally{setUploading(null);}
  };
  const uploadCertificate=async()=>{
    const user=auth.currentUser; if(!user){Alert.alert("Sign in required","Please sign in before uploading documents.");return;}
    const result=await DocumentPicker.getDocumentAsync({type:["application/pdf","image/*"],copyToCacheDirectory:true}); if(result.canceled||!result.assets?.[0]) return;
    const asset=result.assets[0]; if(asset.size&&asset.size>10*1024*1024){Alert.alert("File too large","Please select a certificate smaller than 10 MB.");return;}
    setUploading("certificate");
    try { const url=await uploadVerificationFile(user.uid,"certificate",{uri:asset.uri,mimeType:asset.mimeType,name:asset.name,size:asset.size}); setCertificate({url,label:asset.name||"Upload complete"}); }
    catch(error){console.error("Failed to upload certificate:",error);Alert.alert("Upload failed",getUploadErrorMessage(error));}
    finally{setUploading(null);}
  };

  const positiveNumber=(value:string)=>{const number=Number(value);return Number.isFinite(number)&&number>0;};
  const validateStep1=()=>{const p=draft.personal,pro=draft.professional;if(!p.fullName.trim()||!p.phone.trim()||(!isEditMode&&(!p.dateOfBirth.trim()||!p.address.trim()||!p.cityMunicipality.trim())))return "Please complete all required Personal Information fields.";if(!positiveNumber(pro.yearsOfExperience)||!pro.serviceArea.trim()||(pro.maxTravelDistanceKm.trim()&&!positiveNumber(pro.maxTravelDistanceKm)))return "Please complete Professional Information with valid numeric values.";return null;};
  const validateStep2=()=>isEditMode?null:(!draft.identification.idType||!validId||!validIdBack||!facePhoto?"Please select an ID type and upload the front and back of your valid ID and a face photo.":null);
  const validateSubmission=()=>{const identityError=validateStep2();if(identityError)return identityError;if(!draft.consentAccepted)return "Please confirm the verification consent checkbox before submitting.";return null;};
  const validateEdit=()=>validateStep1();
  const handleContinue=()=>{const error=step===1?validateStep1():validateStep2();if(error){Alert.alert("Missing information",error);return;}setStep(current=>Math.min(current+1,TOTAL_STEPS));};
  const handleBack=()=>step===1?(isEditMode?router.replace("/(onsite-mechanic)/my-profile"):router.canGoBack()?router.back():router.replace("/(onsite-mechanic)")):setStep(current=>current-1);
  const handleSubmit=async()=>{
    const error=isEditMode?validateEdit():validateSubmission();
    if(error){Alert.alert("Missing information",error);return;}
    if(uploading){Alert.alert("Upload in progress","Please wait for document uploads to finish.");return;}
    const user=auth.currentUser;
    if(!user){Alert.alert("Sign in required","Please sign in before saving your profile.");return;}
    if(!isEditMode&&(!validId||!validIdBack||!facePhoto))return;
    setSubmitting(true);
    try {
      const existing=await getProviderProfile(user.uid);
      if(isEditMode&&!existing){throw new Error("Your mechanic profile could not be found. Please refresh and try again.");}
      const profile:OnsiteMechanicProviderProfile={
        uid:user.uid,
        role:"onsite-mechanic",
        personal:{...draft.personal,fullName:draft.personal.fullName.trim(),phone:draft.personal.phone.trim(),dateOfBirth:draft.personal.dateOfBirth.trim(),address:draft.personal.address.trim(),cityMunicipality:draft.personal.cityMunicipality.trim()},
        professional:{yearsOfExperience:Number(draft.professional.yearsOfExperience),specializations:existing?.professional.specializations??[],vehicleTypesServed:existing?.professional.vehicleTypesServed??[],serviceArea:draft.professional.serviceArea.trim(),maxTravelDistanceKm:draft.professional.maxTravelDistanceKm.trim()?Number(draft.professional.maxTravelDistanceKm):null},
        identification:isEditMode&&existing?{...existing.identification,profilePhotoUrl:profilePhoto?.url??existing.identification.profilePhotoUrl}:{idType:draft.identification.idType,idNumber:draft.identification.idNumber.trim(),validIdUrl:validId!.url,validIdBackUrl:validIdBack!.url,profilePhotoUrl:profilePhoto?.url??"",facePhotoUrl:facePhoto!.url},
        credentials:{tesdaCertificate:draft.credentials.tesdaCertificate.trim(),certificationNumber:draft.credentials.certificationNumber.trim(),certificateUrl:certificate?.url??null},
        serviceInfo:existing?.serviceInfo??{serviceRate:0,emergencyServiceAvailable:false,availableDays:[],availableHours:""},
        verificationStatus:isEditMode?(existing?.verificationStatus??"INCOMPLETE"):"PENDING"
      };
      if(isEditMode) await updateMechanicProviderProfile(user.uid,profile);
      else await saveProviderProfile(user.uid,profile);
      if(isEditMode){Alert.alert("Profile updated","Your mechanic profile has been saved.",[{text:"OK",onPress:()=>router.replace("/(onsite-mechanic)/my-profile")}]);}
      else setSubmitted(true);
    } catch(error) {
      console.error("Failed to save mechanic profile:",error);
      Alert.alert(isEditMode?"Save failed":"Submission failed",isEditMode?"We couldn't save your profile. Please try again.":"We couldn't save your verification. Please try again.");
    } finally {setSubmitting(false);}
  };

  if(loading)return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><ActivityIndicator color={COLORS.primary}/><Text style={styles.helperText}>Loading verification...</Text></View></SafeAreaView>;
  if(loadError)return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><Feather name="alert-circle" size={28} color={COLORS.primary}/><Text style={styles.errorText}>{loadError}</Text><TouchableOpacity style={styles.primaryButton} onPress={()=>void loadSavedProfile()}><Text style={styles.primaryButtonText}>Try Again</Text></TouchableOpacity></View></SafeAreaView>;
  if(submitted||lockedStatus)return <SafeAreaView style={styles.safeArea} edges={["left","right","bottom"]}><StatusBar barStyle="light-content" backgroundColor={COLORS.background}/><View style={[styles.header,{paddingTop:insets.top+14}]}><Text style={styles.headerTitle}>Verification</Text></View><View style={styles.confirmationWrap}><View style={styles.confirmationIcon}><Feather name={lockedStatus==="VERIFIED"?"check-circle":"clock"} size={40} color={COLORS.success}/></View><Text style={styles.confirmationTitle}>{lockedStatus==="VERIFIED"?"Account Verified":"Verification Submitted"}</Text><Text style={styles.confirmationText}>{lockedStatus==="VERIFIED"?"Your mechanic account is verified.":"Your documents are being reviewed. We'll notify you once your account has been verified."}</Text><View style={styles.statusPill}><Text style={styles.statusPillText}>Status: {lockedStatus||"PENDING"}</Text></View><TouchableOpacity style={styles.primaryButton} onPress={()=>router.replace("/(onsite-mechanic)/profile")}><Text style={styles.primaryButtonText}>Back to Profile</Text></TouchableOpacity></View></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea} edges={["left","right","bottom"]}><StatusBar barStyle="light-content" backgroundColor={COLORS.background}/><View style={[styles.header,{paddingTop:insets.top+14}]}><View style={styles.headerRow}><TouchableOpacity onPress={handleBack} style={styles.backButton}><Feather name="arrow-left" size={20} color="#FFFFFF"/></TouchableOpacity><Text style={styles.headerTitle}>{isEditMode?"Edit Mechanic Profile":"Complete Your Profile"}</Text><View style={styles.backButtonSpacer}/></View><Text style={styles.headerSubtitle}>{isEditMode?"Update your contact and service information.":"Finish setting up your provider profile so customers can trust and book you."}</Text>{!isEditMode&&<View style={styles.progressRow}>{Array.from({length:TOTAL_STEPS}).map((_,index)=><View key={index} style={[styles.progressSegment,index<step&&styles.progressSegmentDone]}/>)}</View>}<Text style={styles.progressLabel}>{isEditMode?"Update your contact and service details":"Step "+step+" of "+TOTAL_STEPS}</Text></View><ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    {(isEditMode||step===1)&&<>
      <SectionCard title="Contact Information"><Field label="Full Name" value={draft.personal.fullName} onChange={value=>update("personal","fullName",value)}/><Field label="Phone Number" value={draft.personal.phone} keyboardType="phone-pad" onChange={value=>update("personal","phone",value)}/>{!isEditMode&&<><View style={styles.fieldBlock}><FieldLabel label="Date of Birth" required/><DateOfBirthInput value={draft.personal.dateOfBirth} onChange={(value: string)=>update("personal","dateOfBirth",value)} placeholder="Select your date of birth" inputStyle={styles.input} textStyle={{color:draft.personal.dateOfBirth?COLORS.text:COLORS.textMuted}} /></View><View style={styles.fieldBlock}><FieldLabel label="Address" required/><TextInput style={styles.input} value={draft.personal.address} placeholder="e.g. Cebu City" placeholderTextColor={COLORS.textMuted} onFocus={()=>setShowAddressSuggestions(true)} onChangeText={value=>{update("personal","address",value);update("personal","cityMunicipality","");setShowAddressSuggestions(true);setAddressSuggestions([]);searchAddress(value);}}/>{addressSearching&&<Text style={styles.helperText}>Searching...</Text>}{showAddressSuggestions&&addressSuggestions.length>0&&<View style={styles.suggestionList}>{addressSuggestions.map(item=><TouchableOpacity key={item.id} style={styles.suggestionItem} onPress={()=>{update("personal","address",item.label);if(item.cityMunicipality)update("personal","cityMunicipality",item.cityMunicipality);setAddressSuggestions([]);setShowAddressSuggestions(false);addressSearchController.current?.abort();}}><Text style={styles.suggestionText}>{item.label}</Text></TouchableOpacity>)}</View>}{!addressSearching&&showAddressSuggestions&&addressSearchError?<Text style={styles.helperText}>{addressSearchError}</Text>:null}</View><Field label="City / Municipality" value={draft.personal.cityMunicipality} onChange={value=>update("personal","cityMunicipality",value)}/></>}</SectionCard>
      <SectionCard title="Professional Information"><Field label="Years of Experience" value={draft.professional.yearsOfExperience} keyboardType="number-pad" onChange={value=>update("professional","yearsOfExperience",value)}/><Field label="Service Area" value={draft.professional.serviceArea} onChange={value=>update("professional","serviceArea",value)}/><Field label="Maximum Travel Distance (km) (Optional)" required={false} value={draft.professional.maxTravelDistanceKm} keyboardType="number-pad" onChange={value=>update("professional","maxTravelDistanceKm",value)}/></SectionCard>
    </>}
    {!isEditMode&&step===2&&<><SectionCard title="Identification / Verification"><Text style={[styles.helperText,{marginBottom:14}]}>Enter your full name exactly as it appears on your ID so reviewers can match your details.</Text><View style={styles.fieldBlock}><FieldLabel label="ID Type" required/><ChipSingleSelect options={ID_TYPE_OPTIONS} selected={draft.identification.idType} onSelect={value=>update("identification","idType",value)}/></View><Field label="ID Number (Optional)" required={false} value={draft.identification.idNumber} onChange={value=>update("identification","idNumber",value)}/><UploadBox label="Upload Valid ID — Front" required description="Upload a clear photo of the front of your government ID (JPG or PNG, maximum 5 MB)." file={validId} uploading={uploading==="valid-id"} onPress={()=>void uploadImage("valid-id")}/><UploadBox label="Upload Valid ID — Back" required description="Upload a clear photo of the back of your government ID (JPG or PNG, maximum 5 MB)." file={validIdBack} uploading={uploading==="valid-id-back"} onPress={()=>void uploadImage("valid-id-back")}/><UploadBox label="Face Photo" required description="Upload a clear, recent photo of your face for identity verification. This is separate from your profile photo." file={facePhoto} uploading={uploading==="face-photo"} onPress={()=>void uploadImage("face-photo")}/><UploadBox label="Profile Photo (Optional)" description="Optional: choose the photo you want displayed on your mechanic profile." file={profilePhoto} uploading={uploading==="profile-photo"} onPress={()=>void uploadImage("profile-photo")}/></SectionCard><SectionCard title="Mechanic Credentials"><Text style={styles.helperText}>Optional credentials: submitting relevant training or certification documents may help reviewers verify your qualifications.</Text><Field label="TESDA / Training Certificate (Optional)" required={false} value={draft.credentials.tesdaCertificate} onChange={value=>update("credentials","tesdaCertificate",value)}/><Field label="Certification / License Number (Optional)" required={false} value={draft.credentials.certificationNumber} onChange={value=>update("credentials","certificationNumber",value)}/><UploadBox label="Upload Certificate (Optional)" description="Optional PDF or image, maximum 10 MB." file={certificate} uploading={uploading==="certificate"} onPress={()=>void uploadCertificate()}/></SectionCard><SectionCard title="Verification Consent"><TouchableOpacity style={styles.consentRow} onPress={()=>setDraft(prev=>({...prev,consentAccepted:!prev.consentAccepted}))}><View style={[styles.checkbox,draft.consentAccepted&&styles.checkboxChecked]}>{draft.consentAccepted&&<Feather name="check" size={13} color="#FFFFFF"/>}</View><Text style={styles.consentText}>I confirm that the information and documents I provided are accurate and belong to me.</Text></TouchableOpacity></SectionCard></>}
  </ScrollView><View style={styles.footer}><TouchableOpacity disabled={submitting||uploading!==null} style={[styles.primaryButton,(submitting||uploading!==null)&&styles.disabled]} onPress={isEditMode?()=>void handleSubmit():step<TOTAL_STEPS?handleContinue:()=>void handleSubmit()}>{submitting?<ActivityIndicator color="#FFFFFF"/>:<Text style={styles.primaryButtonText}>{isEditMode?"Save Profile":step<TOTAL_STEPS?"Save & Continue":"Submit for Verification"}</Text>}</TouchableOpacity></View></SafeAreaView>;
}
function Field({label,value,onChange,keyboardType="default",placeholder,required=true}:{label:string;value:string;onChange:(value:string)=>void;keyboardType?:"default"|"phone-pad"|"number-pad"|"numeric";placeholder?:string;required?:boolean}){return <View style={styles.fieldBlock}><FieldLabel label={label} required={required}/><TextInput style={styles.input} value={value} placeholder={placeholder} placeholderTextColor={COLORS.textMuted} keyboardType={keyboardType} onChangeText={onChange}/></View>;}
function Select({label,options,selected,onToggle}:{label:string;options:string[];selected:string[];onToggle:(value:string)=>void}){return <View style={styles.fieldBlock}><FieldLabel label={label} required/><ChipMultiSelect options={options} selected={selected} onToggle={onToggle}/></View>;}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:COLORS.background},scroll:{flex:1},scrollContent:{paddingHorizontal:16,paddingTop:16,paddingBottom:24},header:{paddingHorizontal:16,paddingBottom:16,backgroundColor:"#151C23",borderBottomWidth:1,borderBottomColor:COLORS.border},headerRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},backButton:{padding:4},backButtonSpacer:{width:28},headerTitle:{fontSize:17,fontWeight:"700",color:"#FFFFFF"},headerSubtitle:{fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:10,lineHeight:17},progressRow:{flexDirection:"row",gap:6,marginTop:16},progressSegment:{flex:1,height:4,borderRadius:2,backgroundColor:"rgba(255,255,255,0.3)"},progressSegmentDone:{backgroundColor:"#FFFFFF"},progressLabel:{fontSize:11,fontWeight:"600",color:"rgba(255,255,255,0.9)",marginTop:8},readOnlySection:{opacity:0.72},card:{backgroundColor:"#151C23",borderWidth:1,borderColor:COLORS.border,borderRadius:12,padding:16,marginTop:16},cardTitle:{fontSize:13,fontWeight:"700",color:COLORS.text,marginBottom:14},fieldBlock:{marginBottom:16},fieldLabel:{fontSize:12,fontWeight:"600",color:COLORS.text,marginBottom:6},requiredAsterisk:{color:COLORS.primary},suggestionList:{marginTop:4,borderWidth:1,borderColor:COLORS.border,borderRadius:10,overflow:"hidden",backgroundColor:COLORS.sectionBackground},suggestionItem:{padding:10,borderBottomWidth:1,borderBottomColor:COLORS.border},suggestionText:{fontSize:12,color:COLORS.text,lineHeight:18},input:{borderWidth:1,borderColor:COLORS.border,borderRadius:10,paddingHorizontal:12,paddingVertical:10,fontSize:13,color:COLORS.text,backgroundColor:COLORS.sectionBackground},chipRow:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderColor:COLORS.border,borderRadius:12,paddingHorizontal:12,paddingVertical:7,backgroundColor:COLORS.sectionBackground},chipActive:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},chipText:{fontSize:12,fontWeight:"600",color:COLORS.textMuted},chipTextActive:{color:"#FFFFFF"},uploadBox:{flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderStyle:"dashed",borderColor:COLORS.primary,borderRadius:10,paddingVertical:14,paddingHorizontal:14,backgroundColor:COLORS.primaryMuted},uploadBoxDone:{borderStyle:"solid",borderColor:COLORS.success,backgroundColor:COLORS.successMuted},uploadBoxText:{fontSize:13,fontWeight:"600",color:COLORS.primary},uploadBoxTextDone:{color:COLORS.success},helperText:{fontSize:11,color:COLORS.textMuted,marginTop:6,lineHeight:15},disabled:{opacity:0.6},segmentedControl:{flexDirection:"row",backgroundColor:COLORS.sectionBackground,borderRadius:8,padding:3},segment:{flex:1,paddingVertical:9,borderRadius:6,alignItems:"center"},segmentActive:{backgroundColor:COLORS.primary},segmentText:{fontSize:12,fontWeight:"600",color:COLORS.textMuted},segmentTextActive:{color:"#FFFFFF"},consentRow:{flexDirection:"row",alignItems:"flex-start",gap:10},checkbox:{width:20,height:20,borderRadius:5,borderWidth:1.5,borderColor:COLORS.border,alignItems:"center",justifyContent:"center",marginTop:1},checkboxChecked:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},consentText:{flex:1,fontSize:12,color:COLORS.text,lineHeight:18},footer:{paddingHorizontal:16,paddingVertical:14,borderTopWidth:1,borderTopColor:COLORS.border,backgroundColor:"#111820"},primaryButton:{backgroundColor:COLORS.primary,borderRadius:10,paddingVertical:14,alignItems:"center",minWidth:150},primaryButtonText:{fontSize:14,fontWeight:"700",color:"#FFFFFF"},loading:{flex:1,alignItems:"center",justifyContent:"center",padding:28,gap:12},errorText:{fontSize:14,color:COLORS.text,textAlign:"center",lineHeight:20},confirmationWrap:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:32},confirmationIcon:{width:76,height:76,borderRadius:38,backgroundColor:COLORS.successMuted,alignItems:"center",justifyContent:"center",marginBottom:18},confirmationTitle:{fontSize:19,fontWeight:"700",color:COLORS.text,textAlign:"center"},confirmationText:{fontSize:13,color:COLORS.textMuted,textAlign:"center",marginTop:8,lineHeight:19},statusPill:{marginTop:18,marginBottom:18,backgroundColor:COLORS.sectionBackground,borderRadius:999,paddingHorizontal:14,paddingVertical:6},statusPillText:{fontSize:11,fontWeight:"700",color:COLORS.textMuted}});
