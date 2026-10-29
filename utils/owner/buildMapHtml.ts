// utils/buildMapHtml.ts
import { MockProvider } from "../../data/owner/mockProviders";

function markerIcon(provider: MockProvider) {
  switch (provider.category) {
    case "Towing": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="18" cy="17" r="2"/></svg>';
    case "Auto Shops": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 6h18l-2 4H5zM7 6v4m5-4v4m5-4v4M8 20v-5h8v5"/></svg>';
    case "Onsite Mechanics": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5.5a5 5 0 0 1-6.7 4.7L6 18.5a2.1 2.1 0 0 1-3-3l8.3-8.3A5 5 0 0 1 16.5 1l-2.2 2.2 2.5 2.5z"/></svg>';
    case "Parking Lots": return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h4v6"/><path d="M20 4.5a3 3 0 0 1-4 2.8l-4 4-1.8-1.8 4-4a3 3 0 0 1 4-3.8l-1.7 1.7 1.8 1.8z"/></svg>';
  }
}

function markerColor(provider: MockProvider) {
  switch (provider.category) {
    case "Onsite Mechanics": return "#2878E5";
    case "Towing": return "#F28A24";
    case "Auto Shops": return "#E53945";
    case "Parking Lots": return "#8451C7";
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
  const coordinateGroups = new Map<string, MockProvider[]>();
  providers.forEach((provider) => {
    const key = `${provider.lat},${provider.lng}`;
    const group = coordinateGroups.get(key) ?? [];
    group.push(provider);
    coordinateGroups.set(key, group);
  });

  const markerScript = [...coordinateGroups.values()]
    .map((group, groupIndex) => {
      const groupId = `provider-group-${groupIndex}`;
      const ids = group.map((provider) => JSON.stringify(provider.id)).join(",");
      const markers = group.map((provider) => `
        (function() {
          var providerId = ${JSON.stringify(provider.id)};
          var originalLocation = [${provider.lat}, ${provider.lng}];
          var icon = L.divIcon({
            className: '',
            html: '<div class="provider-marker"><div class="provider-pin" style="background:${markerColor(provider)}"><span class="provider-pin-icon">${markerIcon(provider)}</span></div></div>',
            iconSize: [38, 46],
            iconAnchor: [19, 43],
          });
          var marker = L.marker(originalLocation, { icon: icon });
          providerMarkers[providerId] = marker;
          providerLocations[providerId] = { original: originalLocation, groupId: ${JSON.stringify(groupId)} };
          marker.on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ id: providerId }));
          });
          ${group.length === 1 ? "marker.addTo(map);" : ""}
        })();
      `).join("\n");

      if (group.length === 1) return markers;

      const categoryColors = [...new Set(group.map(markerColor))]
        .map((color) => `<i style="background:${color}"></i>`)
        .join("");
      const first = group[0];
      return `
        (function() {
          var groupId = ${JSON.stringify(groupId)};
          var groupIds = [${ids}];
          var group = {
            ids: groupIds,
            center: [${first.lat}, ${first.lng}],
            isOpen: false,
            marker: L.marker([${first.lat}, ${first.lng}], {
              icon: L.divIcon({
                className: '',
                html: '<div class="provider-group-marker"><b>${group.length}</b><span class="provider-group-colors">${categoryColors}</span></div>',
                iconSize: [46, 46],
                iconAnchor: [23, 23],
              }),
            }).addTo(map),
          };
          providerGroups[groupId] = group;
          ${markers}
          group.marker.on('click', function() {
            if (group.isOpen) collapseProviderGroup(groupId);
            else openProviderGroup(groupId);
          });
        })();
      `;
    })
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

    .provider-marker {
      width: 38px; height: 46px;
      display: flex; align-items: flex-start; justify-content: center;
    }
    .provider-pin {
      position: relative;
      margin-top: 1px;
      width: 34px; height: 34px;
      border: 2px solid #fff;
      border-radius: 50% 50% 50% 0;
      box-shadow: 0 2px 5px rgba(0,0,0,0.35);
      transform: rotate(-45deg);
      display: flex; align-items: center; justify-content: center;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .provider-pin-icon {
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      transform: rotate(45deg);
    }
    .provider-pin-icon svg {
      width: 19px; height: 19px;
      fill: none; stroke: #fff; stroke-width: 1.8;
      stroke-linecap: round; stroke-linejoin: round;
    }
    .provider-pin-icon svg path:first-child { fill: none; }
    .provider-marker.is-selected .provider-pin {
      transform: rotate(-45deg) scale(1.14);
      box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 3px 8px rgba(0,0,0,0.42);
    }
    .provider-group-marker {
      width: 42px; height: 42px;
      border: 3px solid #fff; border-radius: 50%;
      background: #202832; color: #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font: 700 15px -apple-system, sans-serif;
    }
    .provider-group-marker.is-selected {
      box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 3px 8px rgba(0,0,0,0.42);
      transform: scale(1.08);
    }
    .provider-group-colors { display: flex; gap: 2px; margin-top: 2px; }
    .provider-group-colors i { width: 5px; height: 5px; border-radius: 50%; }

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

    var providerMarkers = {};
    var providerLocations = {};
    var providerGroups = {};
    var selectedProviderId = null;

    function updateProviderSelection() {
      Object.keys(providerMarkers).forEach(function(providerId) {
        var marker = providerMarkers[providerId];
        var element = marker.getElement();
        var pin = element && element.querySelector('.provider-marker');
        if (pin) pin.classList.toggle('is-selected', providerId === selectedProviderId);
        marker.setZIndexOffset(providerId === selectedProviderId ? 600 : 0);
      });
      Object.keys(providerGroups).forEach(function(groupId) {
        var group = providerGroups[groupId];
        var element = group.marker.getElement();
        var badge = element && element.querySelector('.provider-group-marker');
        var containsSelection = group.ids.indexOf(selectedProviderId) >= 0;
        if (badge) badge.classList.toggle('is-selected', containsSelection && !group.isOpen);
        group.marker.setZIndexOffset(containsSelection ? 600 : 0);
      });
    }

    function collapseProviderGroup(groupId) {
      var group = providerGroups[groupId];
      if (!group || !group.isOpen) return;
      group.ids.forEach(function(providerId) {
        var marker = providerMarkers[providerId];
        marker.remove();
        marker.setLatLng(providerLocations[providerId].original);
      });
      group.marker.addTo(map);
      group.isOpen = false;
      updateProviderSelection();
    }

    function collapseAllProviderGroups() {
      Object.keys(providerGroups).forEach(collapseProviderGroup);
    }

    function openProviderGroup(groupId) {
      var group = providerGroups[groupId];
      if (!group || group.isOpen) return;
      Object.keys(providerGroups).forEach(function(otherId) {
        if (otherId !== groupId) collapseProviderGroup(otherId);
      });
      group.marker.remove();
      var origin = map.latLngToLayerPoint(group.center);
      var count = group.ids.length;
      group.ids.forEach(function(providerId, index) {
        var ring = Math.floor(index / 10);
        var indexOnRing = index % 10;
        var ringCount = Math.min(10, count - ring * 10);
        var angle = -Math.PI / 2 + (2 * Math.PI * indexOnRing / ringCount);
        var radius = 48 + ring * 34;
        var point = L.point(origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius);
        providerMarkers[providerId].setLatLng(map.layerPointToLatLng(point)).addTo(map);
      });
      group.isOpen = true;
      updateProviderSelection();
    }

    window.setSelectedProvider = function(id) {
      selectedProviderId = id;
      var selectedLocation = providerLocations[id];
      if (selectedLocation) openProviderGroup(selectedLocation.groupId);
      if (!id) collapseAllProviderGroups();
      updateProviderSelection();
    };

    map.on('movestart zoomstart', collapseAllProviderGroups);

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
