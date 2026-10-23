import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  SwitchCamera,
  Volume2,
} from 'lucide-react';
import AgoraVideoTile from '../components/AgoraVideoTile';
import { useVideoCall } from '../context/VideoCallContext';
import { requireAuth } from '../services/guestAuth';
import '../design/pages/video-call.css';

export default function VideoCall() {
  const { appointmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const endingRef = useRef(false);
  const extras = location.state || {};

  const {
    viewMode,
    loadingLabel,
    isJoined,
    remoteUid,
    errorMsg,
    isMuted,
    isCameraOn,
    isSpeakerOn,
    isLocalViewBig,
    callSeconds,
    displayName,
    initials,
    otherPartyImage,
    localVideoTrack,
    remoteVideoTrack,
    startCall,
    minimizeCall,
    endCall,
    retryCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    flipCamera,
    swapViews,
    formatDuration,
  } = useVideoCall();

  const leaveCallAndGoToAppointments = async () => {
    endingRef.current = true;
    await endCall();
    navigate('/profile/appointments', { replace: true });
  };

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to join the video call'))) return;
      if (!appointmentId) {
        endingRef.current = true;
        navigate('/profile/appointments', { replace: true });
        return;
      }
      startCall({
        appointmentId,
        role: extras.role || 'patient',
        otherPartyName: extras.otherPartyName,
        otherPartyImage: extras.otherPartyImage,
      });
    })();
  }, [appointmentId]);

  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    const prev = prevViewModeRef.current;
    prevViewModeRef.current = viewMode;
    if ((prev === 'fullscreen' || prev === 'minimized') && viewMode === 'idle') {
      endingRef.current = true;
      navigate('/profile/appointments', { replace: true });
    }
  }, [viewMode, navigate]);

  if (!appointmentId) {
    return <Navigate to="/profile/appointments" replace />;
  }

  if (viewMode === 'minimized') return null;

  const remoteAvailable = remoteUid != null;
  const showLocalBig = isLocalViewBig;
  const waiting = !isJoined || (isJoined && !remoteAvailable && !showLocalBig);

  return (
    <div className="video-call-page">
      <header className="video-call-header">
        {otherPartyImage ? (
          <img src={otherPartyImage} alt="" />
        ) : (
          <span className="video-avatar">{initials || '?'}</span>
        )}
        <div>
          <strong>{displayName}</strong>
          <small>
            <i className={remoteAvailable ? 'on' : ''} />
            {remoteAvailable ? `Connected • ${formatDuration(callSeconds)}` : loadingLabel}
          </small>
        </div>
        {isJoined ? (
          <button
            type="button"
            className="video-icon-btn"
            aria-label="Minimize call"
            onClick={() => {
              minimizeCall();
              navigate('/profile/appointments', { replace: true });
            }}
          >
            <Minimize2 size={18} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {errorMsg ? (
        <div className="video-error">
          <p>{errorMsg}</p>
          <button type="button" onClick={retryCall}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="video-stage">
        {waiting ? (
          <div className="video-waiting">
            {otherPartyImage ? <img src={otherPartyImage} alt="" /> : <span>{initials || '?'}</span>}
            <p>
              {!isJoined
                ? loadingLabel
                : `Waiting for ${displayName} to join the consultation...`}
            </p>
          </div>
        ) : null}

        {isJoined && localVideoTrack ? (
          <button
            type="button"
            className={showLocalBig ? 'video-tile big' : 'video-tile pip'}
            disabled={showLocalBig}
            onClick={swapViews}
          >
            {isCameraOn ? (
              <AgoraVideoTile track={localVideoTrack} className="video-fill" mirror />
            ) : (
              <div className="video-camera-off">Camera off</div>
            )}
            <em>You</em>
          </button>
        ) : null}

        {remoteAvailable && remoteVideoTrack ? (
          <button
            type="button"
            className={!showLocalBig ? 'video-tile big' : 'video-tile pip'}
            disabled={!showLocalBig}
            onClick={swapViews}
          >
            <AgoraVideoTile track={remoteVideoTrack} className="video-fill" />
            <em>{displayName}</em>
          </button>
        ) : null}
      </div>

      <div className="video-controls">
        <button
          type="button"
          className={isMuted ? 'on' : ''}
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button
          type="button"
          className={!isCameraOn ? 'on' : ''}
          onClick={toggleCamera}
          aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {isCameraOn ? <Camera size={20} aria-hidden="true" /> : <CameraOff size={20} aria-hidden="true" />}
          <span>{isCameraOn ? 'Camera' : 'Camera off'}</span>
        </button>
        <button type="button" className="end" onClick={leaveCallAndGoToAppointments} aria-label="End call">
          <PhoneOff size={20} aria-hidden="true" />
          <span>End</span>
        </button>
        <button
          type="button"
          className={isSpeakerOn ? 'on' : ''}
          onClick={toggleSpeaker}
          aria-label={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker'}
        >
          <Volume2 size={20} aria-hidden="true" />
          <span>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
        </button>
        <button type="button" onClick={flipCamera} aria-label="Flip camera">
          <SwitchCamera size={20} aria-hidden="true" />
          <span>Flip</span>
        </button>
      </div>
    </div>
  );
}

export function VideoCallRedirect() {
  const { callParams, viewMode } = useVideoCall();
  if (callParams?.appointmentId && viewMode !== 'idle') {
    return (
      <Navigate
        to={`/profile/video/${callParams.appointmentId}`}
        replace
        state={callParams}
      />
    );
  }
  return <Navigate to="/profile/appointments" replace />;
}
