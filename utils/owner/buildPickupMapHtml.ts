// utils/owner/buildPickupMapHtml.ts

// ---------------------------------------------------------------------------
// LEAFLET MAP HTML (real OSM tiles inside a WebView — no API key needed,
// no native map module — works in Expo Go)
// ---------------------------------------------------------------------------

type LatLng = { lat: number; lng: number };

export function buildPickupMapHtml(
  center: LatLng,
  currentLocation: LatLng | null,
  accentColor: string
) {
  // Only draw the pulsing "current GPS position" marker if we have a fix.
  // Exposed as window.setCurrentLocation(lat, lng) so it can be moved later
  // (e.g. re-fetching a fresh GPS position) without reloading the WebView.
  const currentMarkerScript = currentLocation
    ? `
    var currentIcon = L.divIcon({
      className: '',
      html: '<div class="current-wrap"><div class="current-ring"></div><div class="current-dot"></div></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    var currentMarker = L.marker([${currentLocation.lat}, ${currentLocation.lng}], {
      icon: currentIcon,
      zIndexOffset: 1000,
      interactive: false,
    }).addTo(map);
    window.setCurrentLocation = function(lat, lng) {
      currentMarker.setLatLng([lat, lng]);
    };
  `
    : `
    var currentMarker = null;
    window.setCurrentLocation = function(lat, lng) {
      if (currentMarker) {
        currentMarker.setLatLng([lat, lng]);
        return;
      }
      var currentIcon = L.divIcon({
        className: '',
        html: '<div class="current-wrap"><div class="current-ring"></div><div class="current-dot"></div></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      currentMarker = L.marker([lat, lng], { icon: currentIcon, zIndexOffset: 1000, interactive: false }).addTo(map);
    };
  `;

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
    }).setView([${center.lat}, ${center.lng}], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    ${currentMarkerScript}

    // Fires whenever the user finishes dragging/zooming the map. The RN side
    // treats the map's current center as the selected pickup point, since the
    // pin overlay is rendered natively and stays fixed in the middle of the screen.
    function postCenter() {
      var c = map.getCenter();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'region', lat: c.lat, lng: c.lng }));
    }
    map.on('moveend', postCenter);

    // Called from React Native (injectJavaScript) to recenter the map,
    // e.g. when the user taps "Use Current Location".
    window.setMapCenter = function(lat, lng, zoom) {
      map.setView([lat, lng], zoom || map.getZoom());
    };

    true;
  </script>
</body>
</html>`;
}