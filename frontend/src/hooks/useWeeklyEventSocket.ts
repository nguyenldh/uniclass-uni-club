import { useEffect, useRef, useCallback, useMemo } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  RoomStatePayload,
  OnlineCountPayload,
  ExamStartPayload,
  SessionResumePayload,
  AnswerAckPayload,
  LeaderboardPayload,
  PersonalResultPayload,
  RoomCancelledPayload,
  TimeSyncPayload,
  SystemErrorPayload,
  SessionTerminatedPayload,
} from '@uniclub/shared';
import { useWeeklyEventStore } from '../stores/weekly-event';

const WEEKLY_EVENT_TIME_SYNC_INTERVAL_MS = 10000;

export interface WeeklyEventSocketActions {
  joinRoom: () => void;
  submitAnswer: (questionId: string, key: string) => void;
  requestResume: () => void;
  syncTime: () => void;
  submitFinal: () => void;
  isConnected: boolean;
}

interface UseWeeklyEventSocketOptions {
  socketToken: string | null;
  enabled: boolean;
}

export function useWeeklyEventSocket({
  socketToken,
  enabled,
}: UseWeeklyEventSocketOptions): WeeklyEventSocketActions {
  const socketRef = useRef<Socket | null>(null);
  const timeSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read connState for the isConnected return value.
  // We subscribe to useWeeklyEventStore here so that isConnected updates properly on state change.
  const connState = useWeeklyEventStore((state) => state.connState);

  const syncTime = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('time:sync', { clientTime: Date.now() });
    }
  }, []);

  const joinRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('[WeeklyEventSocket] Emitting room:join');
      socketRef.current.emit('room:join', {});
    }
  }, []);

  const submitAnswer = useCallback(
    (questionId: string, key: string) => {
      const storeState = useWeeklyEventStore.getState();
      
      // First select the answer locally to update UI immediately
      storeState.selectAnswer(questionId, key);

      if (socketRef.current?.connected && storeState.connState === 'connected') {
        socketRef.current.emit('answer:submit', { questionId, key });
      } else {
        // Queue to offline buffer if disconnected
        console.log('[WeeklyEventSocket] Offline, buffering answer:', { questionId, key });
        storeState.pushOfflineBuffer(questionId, key);
      }
    },
    []
  );

  const requestResume = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('[WeeklyEventSocket] Requesting session resume');
      socketRef.current.emit('session:request-resume', {});
    }
  }, []);

  const submitFinal = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('[WeeklyEventSocket] Submitting final exam');
      socketRef.current.emit('exam:submit-final', {});
      useWeeklyEventStore.getState().setPhase('loading');
    }
  }, []);

  const drainOfflineBuffer = useCallback(() => {
    const storeState = useWeeklyEventStore.getState();
    const { offlineBuffer, clearOfflineBuffer } = storeState;
    if (offlineBuffer.length > 0 && socketRef.current?.connected) {
      console.log(`[WeeklyEventSocket] Reconnected. Draining ${offlineBuffer.length} buffered answers.`);
      offlineBuffer.forEach((item) => {
        socketRef.current?.emit('answer:submit', {
          questionId: item.questionId,
          key: item.key,
        });
      });
      clearOfflineBuffer();
    }
  }, []);

  useEffect(() => {
    if (!enabled || !socketToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (timeSyncIntervalRef.current) {
        clearInterval(timeSyncIntervalRef.current);
        timeSyncIntervalRef.current = null;
      }
      return;
    }

    const socketUrl = (import.meta.env.VITE_SOCKET_URL || '') + '/we';
    console.log('[WeeklyEventSocket] Connecting to namespace /we at URL:', socketUrl);

    const socket = io(socketUrl, {
      auth: { token: socketToken },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WeeklyEventSocket] Socket connected successfully');
      useWeeklyEventStore.getState().setConnState('connected');
      
      // Sync time immediately and start interval
      syncTime();
      if (timeSyncIntervalRef.current) {
        clearInterval(timeSyncIntervalRef.current);
      }
      timeSyncIntervalRef.current = setInterval(syncTime, WEEKLY_EVENT_TIME_SYNC_INTERVAL_MS);

      // Join room and request resume on connection
      joinRoom();
      requestResume();

      // Send any buffered offline answers
      drainOfflineBuffer();
    });

    socket.on('disconnect', (reason) => {
      console.log('[WeeklyEventSocket] Socket disconnected, reason:', reason);
      useWeeklyEventStore.getState().setConnState('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('[WeeklyEventSocket] Connection error:', err);
      useWeeklyEventStore.getState().setConnState('reconnecting');
    });

    // SOCK-EVT-S01: room:state
    socket.on('room:state', (payload: RoomStatePayload) => {
      console.log('[WeeklyEventSocket] Received room:state', payload);
      const { status } = payload;
      const { setPhase } = useWeeklyEventStore.getState();
      
      if (status === 'Waiting') {
        setPhase('waiting');
      } else if (status === 'InProgress') {
        setPhase('exam');
      } else if (status === 'Grading') {
        setPhase('loading');
      } else if (status === 'Showing') {
        setPhase('leaderboard');
      } else if (status === 'Closed' || status === 'Cancelled') {
        setPhase('closed');
      }
    });

    // SOCK-EVT-S02: room:online-count
    socket.on('room:online-count', (payload: OnlineCountPayload) => {
      useWeeklyEventStore.getState().setOnlineCount(payload.count);
    });

    // SOCK-EVT-S03: exam:start
    socket.on('exam:start', (payload: ExamStartPayload) => {
      console.log('[WeeklyEventSocket] Received exam:start', payload);
      const { setQuestions, setPhase } = useWeeklyEventStore.getState();
      setQuestions(payload.questions, payload.examStartedAt, payload.examEndAt);
      setPhase('exam');
    });

    // SOCK-EVT-S04: session:resume
    socket.on('session:resume', (payload: SessionResumePayload) => {
      console.log('[WeeklyEventSocket] Received session:resume', payload);
      const { applyResume, setResumeInfo, setPhase } = useWeeklyEventStore.getState();
      applyResume(payload);
      
      const restoredCount = payload.answers ? Object.keys(payload.answers).length : 0;
      const remainingMin = payload.remainingMs ? Math.round(payload.remainingMs / 60000) : undefined;
      
      setResumeInfo({ remainingMin, restoredCount });
      
      // Auto clear resume notification toast after 5 seconds
      setTimeout(() => {
        useWeeklyEventStore.getState().setResumeInfo(null);
      }, 5000);

      // Adapt screen based on active room status
      if (payload.status === 'Waiting') {
        setPhase('waiting');
      } else if (payload.status === 'InProgress') {
        setPhase('exam');
      } else if (payload.status === 'Grading') {
        setPhase('loading');
      } else if (payload.status === 'Showing') {
        setPhase('leaderboard');
      } else if (payload.status === 'Closed' || payload.status === 'Cancelled') {
        setPhase('closed');
      }
    });

    // SOCK-EVT-S05: answer:ack
    socket.on('answer:ack', (payload: AnswerAckPayload) => {
      console.log('[WeeklyEventSocket] Received answer:ack', payload);
      useWeeklyEventStore.getState().ackAnswer(payload.questionId, payload.answeredCount);
    });

    // SOCK-EVT-S06: room:leaderboard
    socket.on('room:leaderboard', (payload: LeaderboardPayload) => {
      console.log('[WeeklyEventSocket] Received room:leaderboard', payload);
      const { setLeaderboard, setPhase } = useWeeklyEventStore.getState();
      // Sort Top N entries by rank in ascending order
      const sorted = [...payload.topN].sort((a, b) => a.rank - b.rank);
      setLeaderboard(sorted);
      setPhase('leaderboard');
    });

    // SOCK-EVT-S07: personal:result
    socket.on('personal:result', (payload: PersonalResultPayload) => {
      console.log('[WeeklyEventSocket] Received personal:result', payload);
      const { phase, setPersonalResult, setPhase } = useWeeklyEventStore.getState();
      setPersonalResult(payload);
      // If we are waiting or loading results, jump straight to the result page
      if (phase === 'exam' || phase === 'loading') {
        setPhase('result');
      }
    });

    // SOCK-EVT-S08: room:cancelled
    socket.on('room:cancelled', (payload: RoomCancelledPayload) => {
      console.log('[WeeklyEventSocket] Received room:cancelled', payload);
      const { setCancelReason, setPhase } = useWeeklyEventStore.getState();
      setCancelReason(payload.reason);
      setPhase('closed');
    });

    // SOCK-EVT-S09: server:time
    socket.on('server:time', (payload: TimeSyncPayload) => {
      useWeeklyEventStore.getState().setSkew(payload.serverTime, payload.clientSentAt);
    });

    // SOCK-EVT-S10: system:error
    socket.on('system:error', (payload: SystemErrorPayload) => {
      console.error('[WeeklyEventSocket] Received system:error', payload);
      const { setSystemError, setPhase } = useWeeklyEventStore.getState();
      setSystemError(payload);
      if (payload.code === 'PENDING_RESULTS') {
        setPhase('loading');
      }
    });

    // SOCK-EVT-S11: session:terminated
    socket.on('session:terminated', (payload: SessionTerminatedPayload) => {
      console.warn('[WeeklyEventSocket] Session terminated:', payload.reason);
      const { setTerminated } = useWeeklyEventStore.getState();
      setTerminated(true);
      socket.disconnect();
    });

    return () => {
      console.log('[WeeklyEventSocket] Cleaning up socket connection');
      socket.disconnect();
      if (timeSyncIntervalRef.current) {
        clearInterval(timeSyncIntervalRef.current);
        timeSyncIntervalRef.current = null;
      }
    };
  }, [enabled, socketToken, syncTime, joinRoom, requestResume, drainOfflineBuffer]);

  return useMemo(
    () => ({
      joinRoom,
      submitAnswer,
      requestResume,
      syncTime,
      submitFinal,
      isConnected: connState === 'connected',
    }),
    [joinRoom, submitAnswer, requestResume, syncTime, submitFinal, connState]
  );
}
