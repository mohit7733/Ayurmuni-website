import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { replace } from '../navigation/nav';
import {
  apiEndCall,
  apiGetCallStatus,
  apiGetCallToken,
  apiPostCallEvent,
  apiStartCall,
  buildTokenInfo,
  requestCallPermissions,
} from '../services/videoCallApi';

const VideoCallContext = createContext(null);

const formatVideoCallError = (error) => {
  const rawMessage = String(
    error?.message ?? error?.data?.message ?? error?.data?.detail ?? '',
  ).trim();
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('unauthorized') ||
    normalized.includes('not allowed') ||
    error?.status === 403
  ) {
    return 'Video call is not active yet. Please wait for the doctor to start the consultation.';
  }

  if (normalized.includes('not started') || normalized.includes('not_started')) {
    return 'The doctor has not started the video call yet. Please wait.';
  }

  if (rawMessage) return rawMessage;
  return 'Consultation start nahi ho payi. Dobara try karo.';
};

export function VideoCallProvider({ children }) {
  const [callParams, setCallParams] = useState(null);
  const [viewMode, setViewMode] = useState('idle');
  const [loadingLabel, setLoadingLabel] = useState('Connecting to the consultation...');
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isLocalViewBig, setIsLocalViewBig] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState(null);

  const clientRef = useRef(null);
  const localAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const tokenInfoRef = useRef(null);
  const endedByUserRef = useRef(false);
  const endingRemoteRef = useRef(false);
  const hadRemoteParticipantRef = useRef(false);
  const sessionIdRef = useRef(undefined);
  const isSettingUpRef = useRef(false);
  const appointmentIdRef = useRef(null);
  const callRoleRef = useRef('patient');
  const timerIntervalRef = useRef(null);
  const statusPollIntervalRef = useRef(null);
  const isJoinedRef = useRef(false);
  const isSpeakerOnRef = useRef(true);
  const cameraDevicesRef = useRef([]);
  const cameraIndexRef = useRef(0);
  const endCallDueToRemoteRef = useRef(async () => {});

  const displayName =
    callParams?.otherPartyName || (callParams?.role === 'patient' ? 'Doctor' : 'Patient');

  const initials = useMemo(
    () =>
      displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join(''),
    [displayName],
  );

  const formatDuration = useCallback((totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const releaseAgoraEngine = useCallback(async () => {
    try {
      localAudioRef.current?.stop();
      localAudioRef.current?.close();
      localVideoRef.current?.stop();
      localVideoRef.current?.close();
      remoteAudioRef.current?.stop();
      await clientRef.current?.leave();
    } catch (e) {
      console.log('[Agora] Cleanup error:', e);
    }
    localAudioRef.current = null;
    localVideoRef.current = null;
    remoteAudioRef.current = null;
    clientRef.current = null;
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
  }, []);

  const resetCallState = useCallback(() => {
    setViewMode('idle');
    setCallParams(null);
    setIsJoined(false);
    isJoinedRef.current = false;
    setRemoteUid(null);
    setErrorMsg(null);
    setCallSeconds(0);
    setIsMuted(false);
    setIsCameraOn(true);
    setIsSpeakerOn(true);
    isSpeakerOnRef.current = true;
    setIsLocalViewBig(false);
    tokenInfoRef.current = null;
    appointmentIdRef.current = null;
    sessionIdRef.current = undefined;
    isSettingUpRef.current = false;
    hadRemoteParticipantRef.current = false;
    endingRemoteRef.current = false;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (statusPollIntervalRef.current) {
      clearInterval(statusPollIntervalRef.current);
      statusPollIntervalRef.current = null;
    }
  }, []);

  const navigateAwayFromCall = useCallback(() => {
    replace('/profile/appointments');
  }, []);

  const endCallDueToRemote = useCallback(
    async (_reason = 'The doctor has ended the call.') => {
      if (endedByUserRef.current || endingRemoteRef.current) return;
      endingRemoteRef.current = true;
      endedByUserRef.current = true;
      const appointmentId = appointmentIdRef.current;
      if (appointmentId) {
        await apiPostCallEvent(appointmentId, 'left', sessionIdRef.current);
      }
      await releaseAgoraEngine();
      resetCallState();
      navigateAwayFromCall();
    },
    [navigateAwayFromCall, releaseAgoraEngine, resetCallState],
  );

  useEffect(() => {
    endCallDueToRemoteRef.current = endCallDueToRemote;
  }, [endCallDueToRemote]);

  const bindClientEvents = useCallback((client, appointmentId) => {
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      hadRemoteParticipantRef.current = true;
      setRemoteUid(user.uid);
      if (mediaType === 'video') setRemoteVideoTrack(user.videoTrack);
      if (mediaType === 'audio') {
        remoteAudioRef.current = user.audioTrack;
        user.audioTrack.play();
        if (!isSpeakerOnRef.current) user.audioTrack.setVolume(0);
      }
    });
    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') setRemoteVideoTrack(null);
      if (mediaType === 'audio') {
        user.audioTrack?.stop();
        remoteAudioRef.current = null;
      }
    });
    client.on('user-left', (user) => {
      setRemoteUid((prev) => (prev === user.uid ? null : prev));
      setRemoteVideoTrack(null);
      if (hadRemoteParticipantRef.current && !endedByUserRef.current) {
        endCallDueToRemoteRef.current('The doctor has ended the call.');
      }
    });
    client.on('exception', (evt) => {
      if (evt?.code === 110 || evt?.code === 109) tokenInfoRef.current = null;
      setErrorMsg(`Connection error (${evt?.code}): ${evt?.msg || ''}`);
    });
    client.on('connection-state-change', (cur, _prev, reason) => {
      if (cur === 'DISCONNECTED' && reason === 'NETWORK_ERROR') {
        setErrorMsg('Connection failed. Token/App ID mismatch ho sakta hai.');
      }
    });
  }, []);

  const joinAgoraChannel = useCallback(
    async (tokenInfo, appointmentId) => {
      setLoadingLabel('Joining call...');
      if (!clientRef.current) {
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;
        bindClientEvents(client, appointmentId);
      }

      const uid = tokenInfo.uid || null;
      const connectionState = clientRef.current.connectionState;
      if (connectionState !== 'CONNECTED' && connectionState !== 'CONNECTING') {
        await clientRef.current.join(
          tokenInfo.appId,
          tokenInfo.channelName,
          tokenInfo.token,
          uid,
        );
      }

      if (!localAudioRef.current || !localVideoRef.current) {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          {},
          { facingMode: 'user' },
        );
        localAudioRef.current = audioTrack;
        localVideoRef.current = videoTrack;
        setLocalVideoTrack(videoTrack);
        try {
          cameraDevicesRef.current = await AgoraRTC.getCameras();
        } catch {
          cameraDevicesRef.current = [];
        }
        await clientRef.current.publish([audioTrack, videoTrack]);
      }
      setIsJoined(true);
      isJoinedRef.current = true;
      setErrorMsg(null);
      const sessionId = `${tokenInfo.channelName}-${clientRef.current.uid}`;
      sessionIdRef.current = sessionId;
      apiPostCallEvent(appointmentId, 'joined', sessionId);
    },
    [bindClientEvents],
  );

  const prepareAndJoin = useCallback(async () => {
    const appointmentId = appointmentIdRef.current;
    if (!appointmentId || isSettingUpRef.current) return;
    if (isJoinedRef.current && clientRef.current) return;

    isSettingUpRef.current = true;
    endedByUserRef.current = false;
    endingRemoteRef.current = false;
    hadRemoteParticipantRef.current = false;
    setErrorMsg(null);

    try {
      const hasPermission = await requestCallPermissions();
      if (!hasPermission) {
        setErrorMsg('Camera/Mic permission denied — Settings me jaake allow karo.');
        return;
      }

      setLoadingLabel('Checking consultation status...');
      const statusRes = await apiGetCallStatus(appointmentId);
      const callStatus = String(statusRes?.call_status ?? '').toLowerCase();
      const role = callRoleRef.current;

      if (callStatus === 'ended') {
        setErrorMsg('This consultation has already ended.');
        return;
      }

      if (callStatus !== 'in_progress') {
        if (role === 'patient') {
          setErrorMsg(
            callStatus === 'not_started'
              ? 'The doctor has not started the video call yet. Please wait.'
              : 'Video call is not active right now. Please try again when the consultation starts.',
          );
          return;
        }
        if (callStatus === 'not_started') {
          setLoadingLabel('Starting consultation...');
          await apiStartCall(appointmentId);
        } else {
          setErrorMsg('Video call is not available for this appointment.');
          return;
        }
      }

      setLoadingLabel('Preparing secure connection...');
      const tokenRes = await apiGetCallToken(appointmentId);
      if (!tokenRes?.token || !tokenRes?.channel) {
        throw new Error('Token response me token/channel missing hai.');
      }
      const tokenInfo = buildTokenInfo(tokenRes);
      tokenInfoRef.current = tokenInfo;
      await joinAgoraChannel(tokenInfo, appointmentId);
    } catch (e) {
      setErrorMsg(formatVideoCallError(e));
    } finally {
      isSettingUpRef.current = false;
    }
  }, [joinAgoraChannel]);

  const startCall = useCallback(
    async (params) => {
      if (
        appointmentIdRef.current === params.appointmentId &&
        (isJoinedRef.current || clientRef.current)
      ) {
        setCallParams(params);
        setViewMode('fullscreen');
        return;
      }

      if (clientRef.current) {
        await releaseAgoraEngine();
        resetCallState();
      }

      setCallParams(params);
      setViewMode('fullscreen');
      appointmentIdRef.current = params.appointmentId;
      callRoleRef.current = params.role ?? 'patient';
      await prepareAndJoin();
    },
    [prepareAndJoin, releaseAgoraEngine, resetCallState],
  );

  const minimizeCall = useCallback(() => {
    if (!appointmentIdRef.current && !callParams) return;
    setViewMode('minimized');
  }, [callParams]);

  const expandCall = useCallback(() => {
    const params = callParams;
    if (!params?.appointmentId && !appointmentIdRef.current) return;
    setViewMode('fullscreen');
    const id = params?.appointmentId || appointmentIdRef.current;
    replace(`/profile/video/${id}`, params || undefined);
  }, [callParams]);

  const endCall = useCallback(async () => {
    const appointmentId = appointmentIdRef.current;
    endedByUserRef.current = true;
    if (appointmentId) {
      await apiPostCallEvent(appointmentId, 'left', sessionIdRef.current);
      try {
        await apiEndCall(appointmentId);
      } catch (e) {
        console.log('[API] end call failed:', e);
      }
    }
    await releaseAgoraEngine();
    resetCallState();
  }, [releaseAgoraEngine, resetCallState]);

  const retryCall = useCallback(async () => {
    isJoinedRef.current = false;
    if (clientRef.current) await releaseAgoraEngine();
    prepareAndJoin();
  }, [prepareAndJoin, releaseAgoraEngine]);

  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    try {
      await localAudioRef.current?.setMuted(next);
      setIsMuted(next);
    } catch (e) {
      console.log('[Agora] mute toggle error:', e);
    }
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    const next = !isCameraOn;
    try {
      await localVideoRef.current?.setEnabled(next);
      setIsCameraOn(next);
    } catch (e) {
      console.log('[Agora] camera toggle error:', e);
    }
  }, [isCameraOn]);

  const toggleSpeaker = useCallback(() => {
    const next = !isSpeakerOn;
    try {
      remoteAudioRef.current?.setVolume(next ? 100 : 0);
      isSpeakerOnRef.current = next;
      setIsSpeakerOn(next);
    } catch (e) {
      console.log('[Agora] speaker toggle error:', e);
    }
  }, [isSpeakerOn]);

  const flipCamera = useCallback(async () => {
    try {
      const devices = cameraDevicesRef.current.length
        ? cameraDevicesRef.current
        : await AgoraRTC.getCameras();
      cameraDevicesRef.current = devices;
      if (devices.length < 2 || !localVideoRef.current) return;
      cameraIndexRef.current = (cameraIndexRef.current + 1) % devices.length;
      await localVideoRef.current.setDevice(devices[cameraIndexRef.current].deviceId);
    } catch (e) {
      console.log('[Agora] switchCamera error:', e);
    }
  }, []);

  const swapViews = useCallback(() => {
    setIsLocalViewBig((prev) => !prev);
  }, []);

  useEffect(() => {
    if (remoteUid !== null) {
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          setCallSeconds((prev) => prev + 1);
        }, 1000);
      }
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [remoteUid]);

  useEffect(() => {
    if (viewMode === 'idle' || !appointmentIdRef.current || !isJoined) {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
      return undefined;
    }

    const pollRemoteStatus = async () => {
      const appointmentId = appointmentIdRef.current;
      if (!appointmentId || endedByUserRef.current) return;
      try {
        const statusRes = await apiGetCallStatus(appointmentId);
        const callStatus = String(statusRes?.call_status ?? '').toLowerCase();
        if (callStatus === 'ended' || callStatus === 'completed') {
          await endCallDueToRemoteRef.current('The doctor has ended the call.');
        }
      } catch (e) {
        console.log('[API] call status poll failed:', e);
      }
    };

    pollRemoteStatus();
    statusPollIntervalRef.current = setInterval(pollRemoteStatus, 5000);
    return () => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
    };
  }, [viewMode, isJoined]);

  const value = useMemo(
    () => ({
      callParams,
      viewMode,
      isCallActive: viewMode !== 'idle' && !!callParams,
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
      otherPartyImage: callParams?.otherPartyImage,
      localVideoTrack,
      remoteVideoTrack,
      startCall,
      minimizeCall,
      expandCall,
      endCall,
      retryCall,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      flipCamera,
      swapViews,
      formatDuration,
    }),
    [
      callParams,
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
      localVideoTrack,
      remoteVideoTrack,
      startCall,
      minimizeCall,
      expandCall,
      endCall,
      retryCall,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      flipCamera,
      swapViews,
      formatDuration,
    ],
  );

  return <VideoCallContext.Provider value={value}>{children}</VideoCallContext.Provider>;
}

export const useVideoCall = () => {
  const ctx = useContext(VideoCallContext);
  if (!ctx) throw new Error('useVideoCall must be used within VideoCallProvider');
  return ctx;
};
