import { useNavigate } from 'react-router-dom';
import AgoraVideoTile from './AgoraVideoTile';
import { useVideoCall } from '../context/VideoCallContext';

export default function FloatingVideoOverlay() {
  const navigate = useNavigate();
  const {
    viewMode,
    callParams,
    isJoined,
    remoteUid,
    isCameraOn,
    callSeconds,
    displayName,
    initials,
    otherPartyImage,
    localVideoTrack,
    remoteVideoTrack,
    expandCall,
    endCall,
    formatDuration,
  } = useVideoCall();

  if (viewMode !== 'minimized' || !callParams) return null;

  const showRemote = remoteUid != null && remoteVideoTrack;

  const onExpand = () => {
    expandCall();
    navigate(`/profile/video/${callParams.appointmentId}`, { state: callParams });
  };

  const onEnd = async () => {
    await endCall();
    navigate('/profile/appointments', { replace: true });
  };

  return (
    <aside className="video-pip" role="dialog" aria-label="Ongoing call">
      <button type="button" className="video-pip-stage" onClick={onExpand}>
        {showRemote ? (
          <AgoraVideoTile track={remoteVideoTrack} className="video-fill" />
        ) : isJoined && isCameraOn && localVideoTrack ? (
          <AgoraVideoTile track={localVideoTrack} className="video-fill" mirror />
        ) : otherPartyImage ? (
          <img src={otherPartyImage} alt="" />
        ) : (
          <span>{initials || '?'}</span>
        )}
        <em>{showRemote ? formatDuration(callSeconds) : displayName}</em>
      </button>
      <div className="video-pip-actions">
        <button type="button" onClick={onExpand}>
          Expand
        </button>
        <button type="button" className="danger" onClick={onEnd}>
          End
        </button>
      </div>
    </aside>
  );
}
