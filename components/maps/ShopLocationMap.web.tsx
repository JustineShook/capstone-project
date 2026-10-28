import React, { useEffect, useRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type Coordinate = { latitude: number; longitude: number };
type Region = Coordinate & { latitudeDelta: number; longitudeDelta: number };
type Props = { style?: StyleProp<ViewStyle>; region: Region; pin: Coordinate | null; onSelect: (point: Coordinate) => void };
type EvalWindow = Window & { eval: (script: string) => unknown };

function htmlFor(region: Region) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>html,body,#map{height:100%;margin:0}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>(function(){var map=L.map('map',{attributionControl:true}).setView([${region.latitude},${region.longitude}],12);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);var pin=L.marker([${region.latitude},${region.longitude}]).addTo(map);window.moveShopPin=function(lat,lng,zoom){pin.setLatLng([lat,lng]);map.setView([lat,lng],zoom||map.getZoom())};map.on('click',function(e){pin.setLatLng(e.latlng);parent.postMessage({__shopMap:true,lat:e.latlng.lat,lng:e.latlng.lng},'*')});})();</script></body></html>`;
}

export default function ShopLocationMap({ style, region, pin, onSelect }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlRef = useRef(htmlFor(region));
  const callbackRef = useRef(onSelect);
  const pinLatitude = pin?.latitude;
  const pinLongitude = pin?.longitude;
  callbackRef.current = onSelect;

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !event.data?.__shopMap) return;
      callbackRef.current({ latitude: Number(event.data.lat), longitude: Number(event.data.lng) });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    if (pinLatitude !== undefined && pinLongitude !== undefined) {
      (iframeRef.current?.contentWindow as EvalWindow | null)?.eval(`window.moveShopPin(${pinLatitude},${pinLongitude},16)`);
    }
  }, [pinLatitude, pinLongitude]);

  return (
    <View style={[{ flex: 1 }, style]}>
    <iframe
      ref={iframeRef}
      title="Select shop location"
      srcDoc={htmlRef.current}
      onLoad={() => { if (pin) (iframeRef.current?.contentWindow as EvalWindow | null)?.eval(`window.moveShopPin(${pin.latitude},${pin.longitude},16)`); }}
      sandbox="allow-scripts allow-same-origin"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block" }}
    />
    </View>
  );
}
