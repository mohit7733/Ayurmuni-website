import { useEffect, useMemo, useRef } from 'react';
import { buildMapHtml } from '../utils/mapHtml';

export default function InteractiveMapPicker({ center, onCenterChange, loading }) {
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
    const moved =
      Math.abs(center.latitude - lastCoords.current.latitude) > 0.00001 ||
      Math.abs(center.longitude - lastCoords.current.longitude) > 0.00001;
    if (!moved) return;
    lastCoords.current = center;
    try {
      frameRef.current?.contentWindow?.moveMapTo?.(center.latitude, center.longitude);
    } catch {
      // ignore
    }
  }, [center.latitude, center.longitude, center]);

  return (
    <div className="map-picker-wrap">
      <iframe
        ref={frameRef}
        className="map-picker"
        title="Pin your location"
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
      />
      {loading ? <div className="map-picker-overlay">Finding location…</div> : null}
    </div>
  );
}
