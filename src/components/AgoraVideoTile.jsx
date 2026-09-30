import { useEffect, useRef } from 'react';

export default function AgoraVideoTile({ track, className, mirror }) {
  const elRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !track) return undefined;
    track.play(el, { mirror: Boolean(mirror), fit: 'contain' });
    return () => {
      try {
        track.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [track, mirror]);

  return <div ref={elRef} className={className} />;
}
