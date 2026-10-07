// utils/buildMapHtml.ts
import { MockProvider } from "../../data/owner/mockProviders";

function markerIcon(provider: MockProvider) {
  switch (provider.category) {
    case "Towing": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="18" cy="17" r="2"/></svg>';
    case "Auto Shops": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 6h18l-2 4H5zM7 6v4m5-4v4m5-4v4M8 20v-5h8v5"/></svg>';
    case "Onsite Mechanics": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5.5a5 5 0 0 1-6.7 4.7L6 18.5a2.1 2.1 0 0 1-3-3l8.3-8.3A5 5 0 0 1 16.5 1l-2.2 2.2 2.5 2.5z"/></svg>';
    case "Parking Lots": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h7a5 5 0 0 1 0 10H9v8H6zm3 3v4h4a2 2 0 0 0 0-4z"/></svg>';
  }
}

// ---------------------------------------------------------------------------
// LEAFLET MAP HTML (real OSM tiles inside a WebView — no API key needed)
// ---------------------------------------------------------------------------

export interface MapRoute {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  distanceKm: number;
  etaMinutes: number;
}

export function buildMapHtml(
  center: { lat: number; lng: number },
  providers: MockProvider[],
  accentColor: string,
  userLocation?: { lat: number; lng: number } | null,
  route?: MapRoute | null
) {
  const markerScript = providers
    .map(
      (p) => `
    (function() {
      var icon = L.divIcon({
        className: '',
        html: '<div class="provider-pin" style="color:${p.color}">${markerIcon(p)}</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      var m = L.marker([${p.lat}, ${p.lng}], { icon: icon }).addTo(map);
      m.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: "${p.id}" }));
      });
    })();
  `
    )
    .join("\n");

  // Real GPS wins over the map-center placeholder; caller falls back to
  // MOCK_CENTER when permission is missing/denied.
  const userCenter = userLocation ?? center;

  // Initial route polyline + midpoint label (only when a route is provided).
  const initialRouteScript = route
    ? `
    var routeLine = L.polyline(
      [[${route.from.lat}, ${route.from.lng}], [${route.to.lat}, ${route.to.lng}]],
      { color: '${accentColor}', weight: 3, dashArray: '6,6', opacity: 0.9 }
    ).addTo(map);

    var routeLabel = L.marker(
      [${(route.from.lat + route.to.lat) / 2}, ${(route.from.lng + route.to.lng) / 2}],
      {
        icon: L.divIcon({
          className: '',
          html: '<div class="route-label">${route.distanceKm.toFixed(1)} km · ~${route.etaMinutes} min</div>',
          iconSize: [0, 0],
        }),
      }
    ).addTo(map);
  `
    : `
    var routeLine = null;
    var routeLabel = null;
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

    .provider-pin {
      width: 34px; height: 34px;
      background: transparent;
      display: flex; align-items: center; justify-content: center;
    }
    .provider-pin svg {
      width: 28px; height: 28px;
      fill: none; stroke: currentColor; stroke-width: 1.8;
      stroke-linecap: round; stroke-linejoin: round;
    }
    .provider-pin svg path:first-child { fill: none; }

    .route-label {
      background: #1A1A1A;
      color: #fff;
      font-family: -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 999px;
      white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
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
    }).setView([${userCenter.lat}, ${userCenter.lng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var currentIcon = L.divIcon({
      className: '',
      html: '<div class="current-wrap"><div class="current-ring"></div><div class="current-dot"></div></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    var currentMarker = L.marker([${userCenter.lat}, ${userCenter.lng}], {
      icon: currentIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    // Bridge from React Native: move the live GPS dot and optionally recenter.
    window.updateUserLocation = function(lat, lng, recenter) {
      currentMarker.setLatLng([lat, lng]);
      if (recenter) {
        map.setView([lat, lng], map.getZoom());
      }
    };

    // Bridge from React Native: move the map back onto the user.
    window.recenterToUser = function() {
      if (currentMarker) {
        map.setView(currentMarker.getLatLng(), 14);
      }
    };

    // Bridge from React Native: draw/update the route line + distance/ETA label.
    window.updateRoute = function(fromLat, fromLng, toLat, toLng, distanceKm, etaMinutes) {
      if (routeLine) {
        routeLine.setLatLngs([[fromLat, fromLng], [toLat, toLng]]);
      } else {
        routeLine = L.polyline(
          [[fromLat, fromLng], [toLat, toLng]],
          { color: '${accentColor}', weight: 3, dashArray: '6,6', opacity: 0.9 }
        ).addTo(map);
      }

      var midLat = (fromLat + toLat) / 2;
      var midLng = (fromLng + toLng) / 2;
      var labelHtml = '<div class="route-label">' + distanceKm.toFixed(1) + ' km · ~' + etaMinutes + ' min</div>';

      if (routeLabel) {
        routeLabel.setLatLng([midLat, midLng]);
        routeLabel.setIcon(L.divIcon({ className: '', html: labelHtml, iconSize: [0, 0] }));
      } else {
        routeLabel = L.marker([midLat, midLng], {
          icon: L.divIcon({ className: '', html: labelHtml, iconSize: [0, 0] }),
        }).addTo(map);
      }
    };

    // Bridge from React Native: remove the route when no provider is selected
    // or GPS becomes unavailable.
    window.clearRoute = function() {
      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      if (routeLabel) {
        map.removeLayer(routeLabel);
        routeLabel = null;
      }
    };

    ${initialRouteScript}
    ${markerScript}
  </script>
</body>
</html>`;
}
