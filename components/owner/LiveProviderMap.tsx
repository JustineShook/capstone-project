import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMyLocation } from "../../hooks/useMyLocation";
import { homeColors as colors } from "../../constants/owner/homeTheme";
// @ts-expect-error Expo Metro selects the .web or .native implementation by platform.
import MapHtmlSurface, { type MapHtmlSurfaceHandle } from "../maps/MapHtmlSurface";

type Props = { customerLatitude: number; customerLongitude: number; providerLatitude?: number; providerLongitude?: number; providerName: string; updatedAt?: string; fullScreen?: boolean; overlayInsets?: { top: number; bottom: number }; };

function mapHtml(latitude: number, longitude: number) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>html,body,#map{height:100%;margin:0}.leaflet-control-attribution{display:none}.provider{width:22px;height:22px;background:#1478e8;border:3px solid white;border-radius:50%;box-shadow:0 1px 5px #333}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var home=[${latitude},${longitude}],map=L.map('map',{zoomControl:false,attributionControl:false}).setView(home,14);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);var provider=null,current=null;var cameraInsets={top:24,bottom:24};function frameMarkers(){map.invalidateSize();var size=map.getSize();var top=Math.min(cameraInsets.top,Math.max(0,size.y-cameraInsets.bottom-24));var points=[];if(provider)points.push(provider.getLatLng());if(current)points.push(current.getLatLng());if(!points.length)return;map.fitBounds(points,{paddingTopLeft:[24,top],paddingBottomRight:[24,cameraInsets.bottom],maxZoom:16,animate:false});}window.setOverlayInsets=function(top,bottom){cameraInsets={top:top,bottom:bottom};frameMarkers();};window.updateCurrentLocation=function(lat,lng){var point=[lat,lng];if(!current)current=L.marker(point,{zIndexOffset:1000,icon:L.divIcon({className:'',html:'<div style="width:16px;height:16px;background:#0F52BA;border:3px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(15,82,186,.2)"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map).bindPopup('Your current GPS location');else current.setLatLng(point);frameMarkers();};window.updateProviderLocation=function(lat,lng){var point=[lat,lng];if(!provider)provider=L.marker(point,{icon:L.divIcon({className:'',html:'<div class="provider"></div>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);else provider.setLatLng(point);frameMarkers();};</script></body></html>`;
}

export function LiveProviderMap({ customerLatitude, customerLongitude, providerLatitude, providerLongitude, providerName, updatedAt, fullScreen = false, overlayInsets }: Props) {
  const { location: currentLocation, error: locationError } = useMyLocation();
  const [headingHeight, setHeadingHeight] = useState(56);
  const mapRef = useRef<MapHtmlSurfaceHandle>(null);
  const hasLocation = Number.isFinite(providerLatitude) && Number.isFinite(providerLongitude);
  const updateMarker = useCallback(() => {
    mapRef.current?.injectJavaScript(`window.setOverlayInsets(${fullScreen ? (overlayInsets?.top ?? 0) + headingHeight + 24 : 24},${fullScreen ? (overlayInsets?.bottom ?? 0) + 24 : 24}); true;`);
    if (currentLocation) mapRef.current?.injectJavaScript(`window.updateCurrentLocation(${currentLocation.lat},${currentLocation.lng}); true;`);
    if (hasLocation) mapRef.current?.injectJavaScript(`window.updateProviderLocation(${providerLatitude},${providerLongitude}); true;`);
  }, [hasLocation, providerLatitude, providerLongitude, fullScreen, overlayInsets?.top, overlayInsets?.bottom, headingHeight, currentLocation?.lat, currentLocation?.lng]);
  useEffect(() => { updateMarker(); }, [updateMarker]);
  const freshness = updatedAt ? `Last update ${new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Waiting for the provider's first location update";
  return <View style={fullScreen ? styles.fullScreen : styles.card}><View onLayout={event => setHeadingHeight(event.nativeEvent.layout.height)} style={[styles.heading, fullScreen && styles.floatingHeading, fullScreen && { top: (overlayInsets?.top ?? 0) + 8 }]}><View style={styles.dot}/><View style={styles.copy}><Text style={[styles.title, fullScreen && styles.compactTitle]}>Live {providerName} location</Text><Text style={[styles.freshness, fullScreen && styles.compactFreshness]}>{freshness} · Approximate GPS</Text><Text style={styles.locationLegend}>{locationError ? `Your GPS: ${locationError}` : currentLocation ? `You: sapphire dot | ${providerName}: light-blue dot` : "Getting your current GPS location..."}</Text></View></View><MapHtmlSurface ref={mapRef} sourceHtml={mapHtml(customerLatitude, customerLongitude)} style={styles.map} accessibilityLabel={`Live map showing ${providerName} location`} onLoadEnd={updateMarker}/></View>;
}

const styles = StyleSheet.create({
  fullScreen: { ...StyleSheet.absoluteFillObject },
  floatingHeading: { position: "absolute", left: 16, right: 16, zIndex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 50, paddingVertical: 8 },
  compactTitle: { fontSize: 14, lineHeight: 19 },
  compactFreshness: { fontSize: 11, lineHeight: 16 },
  card: { height: 250, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 13, backgroundColor: colors.surface, shadowColor: "#000000", shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  heading: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1478E8" },
  copy: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  freshness: { marginTop: 2, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  locationLegend: { marginTop: 2, color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  map: { flex: 1 },
});
