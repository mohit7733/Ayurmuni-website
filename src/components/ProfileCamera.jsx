import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal } from './ui';
import { PROFILE_COPY as T } from '../content/profile';

export const wantsNativeCamera = () => {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  return coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
};

export default function ProfileCamera({ open, onClose, onPhoto, onChooseFile }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
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

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setReady(false);
    setError('');

    (async () => {
      const devices = navigator.mediaDevices;
      if (!devices?.getUserMedia) {
        setError(T.cameraMissing);
        return;
      }
      try {
        let stream;
        try {
          stream = await devices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'user' } },
          });
        } catch (err) {
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') throw err;
          stream = await devices.getUserMedia({ audio: false, video: true });
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        bindVideo(videoRef.current);
      } catch (err) {
        if (cancelled) return;
        const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        setError(denied ? T.cameraDenied : T.cameraMissing);
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, bindVideo]);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onClose?.();
        onPhoto?.(new File([blob], `profile-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={T.cameraTitle}
      description={error || T.cameraHint}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {T.cameraCancel}
          </Button>
          {error ? (
            <Button variant="primary" onClick={onChooseFile}>
              {T.cameraChoose}
            </Button>
          ) : (
            <Button variant="primary" disabled={!ready} onClick={capture}>
              {T.cameraCapture}
            </Button>
          )}
        </>
      }
    >
      {error ? null : <video ref={bindVideo} className="pf-camera__video" autoPlay playsInline muted />}
      {!error && !ready ? <p className="pf-camera__status">{T.cameraStarting}</p> : null}
    </Modal>
  );
}
