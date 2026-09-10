// utils/owner/buildDestinationMapHtml.ts
//
// Builds the static HTML for the Destination Leaflet map.
// Unlike the pickup map (fixed center pin, map moves underneath it), this
// map keeps a real Leaflet marker at a specific lat/lng:
//   - Tap the map  -> marker moves there, posts {type: "select", lat, lng}
//   - window.setMarker(lat, lng, zoom) -> programmatic placement (used when
//     the owner taps an autocomplete suggestion)
//
// No external marker icon assets are used (avoids 404s inside the WebView) —
// the pin is a self-contained inline SVG divIcon colored with markerColor.

type LatLng = { lat: number; lng: number };

export function buildDestinationMapHtml(
  center: LatLng,
  markerColor: string,
  initialMarker: LatLng | null = null
): string {
  const initialMarkerJson = initialMarker ? JSON.stringify(initialMarker) : "null";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; touch-action: none; }
      .dest-pin {
        display: block;
        transform: translate(-50%, -100%);
      }
      .leaflet-control-attribution { font-size: 9px; }
      .leaflet-control-zoom a {
        width: 40px;
        height: 40px;
        line-height: 40px;
        font-size: 22px;
      }
      .leaflet-control-zoom { margin-top: 14px !important; margin-left: 14px !important; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function () {
        var markerColor = ${JSON.stringify(markerColor)};
        var initialMarker = ${initialMarkerJson};
        var currentMarker = null;

        var map = L.map("map", {
          zoomControl: true,
          attributionControl: true,
        }).setView([${center.lat}, ${center.lng}], initialMarker ? 16 : 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        function pinIcon() {
          var svg =
            '<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 25 17 25s17-12.3 17-25C34 7.6 26.4 0 17 0z" fill="' +
            markerColor +
            '"/>' +
            '<circle cx="17" cy="17" r="7" fill="white"/>' +
            "</svg>";
          return L.divIcon({
            html: svg,
            className: "dest-pin",
            iconSize: [34, 42],
            iconAnchor: [17, 42],
          });
        }

        function setMarker(lat, lng, zoom) {
          var latLng = [lat, lng];
          if (currentMarker) {
            currentMarker.setLatLng(latLng);
          } else {
            currentMarker = L.marker(latLng, { icon: pinIcon(), interactive: false }).addTo(map);
          }
          map.setView(latLng, typeof zoom === "number" ? zoom : map.getZoom());
        }

        // Exposed for React Native to call via injectJavaScript
        window.setMarker = function (lat, lng, zoom) {
          setMarker(lat, lng, zoom);
          return true;
        };

        if (initialMarker) {
          setMarker(initialMarker.lat, initialMarker.lng, 16);
        }

        map.on("click", function (e) {
          setMarker(e.latlng.lat, e.latlng.lng);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: "select", lat: e.latlng.lat, lng: e.latlng.lng })
            );
          }
        });
      })();
    </script>
  </body>
</html>
`;
}
