// utils/buildMapHtml.ts
import { MockProvider } from "../../data/owner/mockProviders";

// ---------------------------------------------------------------------------
// LEAFLET MAP HTML (real OSM tiles inside a WebView — no API key needed)
// ---------------------------------------------------------------------------
export function buildMapHtml(
  center: { lat: number; lng: number },
  providers: MockProvider[],
  accentColor: string
) {
  const markerScript = providers
    .map(
      (p) => `
    (function() {
      var icon = L.divIcon({
        className: '',
        html: '<div class="provider-pin" style="border-color:${p.color}"><div class="provider-pin-dot" style="background:${p.color}"></div></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      var m = L.marker([${p.lat}, ${p.lng}], { icon: icon }).addTo(map);
      m.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: "${p.id}" }));
      });
    })();
  `
    )
    .join("\n");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F5EFEE; }
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }

    .current-wrap { position: relative; width: 26px; height: 26px; }
    .current-ring {
      position: absolute; top: 50%; left: 50%;
      width: 56px; height: 56px;
      margin-left: -28px; margin-top: -28px;
      border-radius: 50%;
      background: ${accentColor};
      opacity: 0.22;
      animation: pulse 1.8s ease-out infinite;
    }
    .current-dot {
      position: absolute; top: 50%; left: 50%;
      width: 20px; height: 20px;
      margin-left: -10px; margin-top: -10px;
      border-radius: 50%;
      background: ${accentColor};
      border: 3px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    @keyframes pulse {
      0%   { transform: scale(0.4); opacity: 0.35; }
      70%  { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    .provider-pin {
      width: 30px; height: 30px;
      border-radius: 15px;
      background: #fff;
      border: 2px solid #D32F2F;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }
    .provider-pin-dot { width: 10px; height: 10px; border-radius: 5px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([${center.lat}, ${center.lng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var currentIcon = L.divIcon({
      className: '',
      html: '<div class="current-wrap"><div class="current-ring"></div><div class="current-dot"></div></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker([${center.lat}, ${center.lng}], { icon: currentIcon, zIndexOffset: 1000 }).addTo(map);

    ${markerScript}
  </script>
</body>
</html>`;
}