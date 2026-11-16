import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera } from 'lucide-react';
import { BOOKING_COPY as T } from '../content/booking';

const wantsNativeCamera = () => {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  return coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
};

const openStream = async () => {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) {
    const error = new Error('unsupported');
    error.name = 'NotSupportedError';
    throw error;
  }
  try {
    return await devices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
  } catch (error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') throw error;
    return devices.getUserMedia({ audio: false, video: true });
  }
};

export default function RecordPhotoButton({ disabled, onPhoto }) {
  const fileRef = useRef(null);
  const fallbackRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const bindVideo = useCallback((node) => {
    videoRef.current = node;
    const stream = streamRef.current;
    if (!node || !stream) return;
    if (node.srcObject !== stream) node.srcObject = stream;
    node
      .play()
      .then(() => {
        if (videoRef.current === node) setReady(true);
      })
      .catch((playError) => {
        if (playError?.name === 'AbortError' || videoRef.current !== node) return;
        if (node.videoWidth) setReady(true);
      });
  }, []);

  const close = () => {
    stopStream();
    setOpen(false);
    setReady(false);
    setError('');
  };

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const stream = await openStream();
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!cancelled) bindVideo(videoRef.current);
      } catch (err) {
        if (cancelled) return;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        setError(denied ? T.cameraDenied : T.cameraMissing);
      }
    })();

    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      stopStream();
    };
  }, [open]);

  const takePhoto = () => {
    if (disabled) return;
    if (wantsNativeCamera() && fileRef.current) {
      fileRef.current.click();
      return;
    }
    setError('');
    setReady(false);
    setOpen(true);
  };

  const useFile = (file) => {
    if (!file) return;
    close();
    onPhoto(file);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        useFile(new File([blob], `record-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <>
      <button
        type="button"
        className={`bk-upload am-btn am-btn--secondary am-btn--sm${disabled ? ' is-loading' : ''}`}
        disabled={disabled}
        onClick={takePhoto}
      >
        <Camera size={16} aria-hidden />
        <span className="am-btn__label">{T.takePhoto}</span>
      </button>
      <input
        ref={fileRef}
        className="bk-camera-file"
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onPhoto(file);
        }}
      />
      <input
        ref={fallbackRef}
        className="bk-camera-file"
        type="file"
        accept="image/*"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) useFile(file);
        }}
      />
      {open
        ? createPortal(
            <div className="web-modal" role="dialog" aria-modal="true" aria-labelledby="bk-camera-title">
              <div className="web-modal-card bk-camera">
                <h3 id="bk-camera-title">{T.cameraTitle}</h3>
                <p className="muted">{error || T.cameraHint}</p>
                {error ? null : (
                  <video ref={bindVideo} className="bk-camera__video" autoPlay playsInline muted />
                )}
                {!error && !ready ? <p className="bk-card__hint">{T.cameraStarting}</p> : null}
                <div className="detail-cta">
                  <button type="button" className="ghost" onClick={close}>
                    {T.uploadCancel}
                  </button>
                  {error ? (
                    <button type="button" className="cta" onClick={() => fallbackRef.current?.click()}>
                      {T.cameraChoose}
                    </button>
                  ) : (
                    <button type="button" className="cta" disabled={!ready} onClick={capture}>
                      {T.cameraCapture}
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
