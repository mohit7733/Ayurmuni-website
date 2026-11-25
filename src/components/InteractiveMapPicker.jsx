import { useEffect, useMemo, useRef } from 'react';
import { buildMapHtml } from '../utils/mapHtml';

export default function InteractiveMapPicker({ center, onCenterChange, loading, children }) {
  const frameRef = useRef(null);
  const lastCoords = useRef(center);
  const html = useMemo(() => buildMapHtml(center), []);

  useEffect(() => {
    const onMessage = (event) => {
      const data = event?.data;
      if (!data || data.type !== 'ayurmuni-map') return;
      const coords = { latitude: data.lat, longitude: data.lng };
      lastCoords.current = coords;
      onCenterChange?.(coords);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onCenterChange]);

  useEffect(() => {
    const lat = Number(center?.latitude);
    const lng = Number(center?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const moved =
      !lastCoords.current ||
      Math.abs(lat - lastCoords.current.latitude) > 0.00001 ||
      Math.abs(lng - lastCoords.current.longitude) > 0.00001;
    if (!moved) return;
    lastCoords.current = { latitude: lat, longitude: lng };

    // Iframe map may still be booting — retry briefly so GPS recenter is not lost.
    let tries = 0;
    const zoom = Number(center?.zoom);
    const push = () => {
      try {
        const win = frameRef.current?.contentWindow;
        if (typeof win?.moveMapTo === 'function') {
          win.moveMapTo(lat, lng, Number.isFinite(zoom) ? zoom : undefined);
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };
    if (push()) return undefined;
    const timer = window.setInterval(() => {
      tries += 1;
      if (push() || tries >= 20) window.clearInterval(timer);
    }, 150);
    return () => window.clearInterval(timer);
  }, [center.latitude, center.longitude, center.zoom, center]);

  return (
    <div className="map-picker-wrap">
      <iframe
        ref={frameRef}
        className="map-picker"
        title="Pin your location"
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
      />
      {loading ? <div className="map-picker-overlay">Finding your location…</div> : null}
      {children}
    </div>
  );
}
