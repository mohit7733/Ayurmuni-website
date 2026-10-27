export const buildMapHtml = (center) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""
  ></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .pin-wrap {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -100%);
      pointer-events: none; z-index: 1000;
      display: flex; flex-direction: column; align-items: center;
      filter: drop-shadow(0 6px 8px rgba(11,65,54,0.35));
    }
    .pin-dot {
      width: 30px; height: 30px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: linear-gradient(135deg, #17634f 0%, #0b4136 100%);
      border: 3px solid #e4c47a; box-shadow: 0 0 0 3px rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
    }
    .pin-dot::after {
      content: ''; width: 9px; height: 9px; border-radius: 50%;
      background: #fbf6ea; transform: rotate(45deg);
    }
    .pin-stem { width: 0; height: 6px; }
    .pin-shadow {
      position: absolute; top: 50%; left: 50%; width: 14px; height: 5px;
      transform: translate(-50%, -50%); border-radius: 50%;
      background: rgba(11,65,54,0.35); pointer-events: none; z-index: 999;
    }
    .leaflet-control-zoom a { color: #0b4136 !important; }
    .leaflet-bar { border: 1px solid rgba(201,165,90,0.6) !important; border-radius: 10px !important; overflow: hidden; }
    .map-error {
      display:none;position:absolute;inset:0;align-items:center;justify-content:center;
      background:#F8FAFC;color:#64748B;font:14px sans-serif;text-align:center;padding:20px;z-index:2000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="mapError" class="map-error">
    Map tiles could not load.<br/>Use pincode or search instead.
  </div>
  <div class="pin-shadow"></div><div class="pin-wrap"><div class="pin-dot"></div><div class="pin-stem"></div></div>
  <script>
    let map, idleTimer, skipNextIdle = false;
    const startLat = ${center.latitude};
    const startLng = ${center.longitude};

    function postLocation(lat, lng) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'ayurmuni-map', lat: lat, lng: lng }, '*');
      }
    }

    function onMapIdle() {
      if (skipNextIdle) {
        skipNextIdle = false;
        return;
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function() {
        if (!map) return;
        var c = map.getCenter();
        postLocation(c.lat, c.lng);
      }, 350);
    }

    function showMapError() {
      var el = document.getElementById('mapError');
      if (el) el.style.display = 'flex';
    }

    function initMap() {
      try {
        if (typeof L === 'undefined') {
          showMapError();
          return;
        }
        map = L.map('map', { zoomControl: true, attributionControl: true }).setView([startLat, startLng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);
        map.on('moveend', onMapIdle);
        // moveend already fires after zoom; zoomend removed to avoid duplicate geocodes.
        // Make sure tiles fill the frame once layout settles (iframe may mount at 0 size).
        setTimeout(function() { if (map) map.invalidateSize(); }, 0);
        setTimeout(function() { if (map) map.invalidateSize(); }, 300);
        window.addEventListener('resize', function() { if (map) map.invalidateSize(); });
      } catch (e) {
        showMapError();
      }
    }

    window.moveMapTo = function(lat, lng) {
      if (!map) return;
      skipNextIdle = true;
      map.setView([lat, lng], map.getZoom(), { animate: true });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMap);
    } else {
      initMap();
    }
  </script>
</body>
</html>`;
