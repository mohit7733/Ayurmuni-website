import { useEffect, useRef } from 'react';

const CLIPS = [
  '/videos/Create_ancient_Ayurveda_video_20261013142410.mp4',
  '/videos/Create_ancient_Ayurveda_video_20261013142521.mp4',
];

export default function HomeSideVideos() {
  const videoRef = useRef(null);
  const indexRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let idleId = 0;
    let timeoutId = 0;
    let cancelled = false;

    const start = () => {
      if (cancelled || media.matches) return;
      if (!video.currentSrc) video.src = CLIPS[0];
      video.play().catch(() => {});
    };

    const sync = () => {
      if (media.matches) {
        video.pause();
        return;
      }
      start();
    };

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(start, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(start, 600);
    }
    media.addEventListener?.('change', sync);
    return () => {
      cancelled = true;
      if (idleId) window.cancelIdleCallback?.(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
      media.removeEventListener?.('change', sync);
    };
  }, []);

  const playNext = () => {
    const video = videoRef.current;
    if (!video) return;
    indexRef.current = (indexRef.current + 1) % CLIPS.length;
    video.src = CLIPS[indexRef.current];
    video.play().catch(() => {});
  };

  return (
    <video
      ref={videoRef}
      className="hm-side-video"
      muted
      playsInline
      preload="none"
      aria-label="Ayurveda video"
      onEnded={playNext}
    />
  );
}
