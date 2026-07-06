import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EventEntry,
  WaitingRoom,
  ExamScreen,
  SubmissionLoading,
  LeaderboardScreen,
  PersonalResultScreen,
  EventClosedScreen,
  OnlineCounter,
} from '../../design-system/weeklyevent';
import { GameButton } from '../../design-system/game';
import { useUser } from '../../hooks/useUser';
import { useWeeklyEventStore } from '../../stores/weekly-event';
import { useWeeklyEventSocket } from '../../hooks/useWeeklyEventSocket';
import { weeklyEventApi } from '../../services/weekly-event';
import { exitWebView, notifyGameEnded } from '../../utils';
import { ExitButton } from '../../components';

export function WeeklyEventController() {
  const navigate = useNavigate();
  const { user, error: userError, loading: userLoading } = useUser();

  const store = useWeeklyEventStore();
  const userGrade = user?.grade ?? 5;

  // Guard for double final submissions
  const submittedFinalRef = useRef(false);
  // Guard for double game ended notifications
  const gameEndedNotified = useRef(false);

  // Read saved session state to check if already joined
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);

  // Lấy socket token MỚI khi reconnect (token TTL ngắn nên phải refresh trước mỗi lần
  // thử kết nối lại, nếu không sẽ kẹt "Đang kết nối lại…" sau khi mất mạng > TTL).
  // KHÔNG cập nhật store.socketToken ở đây để tránh rebuild lại socket giữa chừng.
  const refreshSocketToken = useCallback(async (): Promise<string | null> => {
    const eventId = useWeeklyEventStore.getState().event?._id;
    if (!eventId) return null;
    try {
      const res = await weeklyEventApi.joinEvent(eventId, userGrade);
      if (res.socketToken) {
        sessionStorage.setItem(
          'uniclub_weekly_event_session',
          JSON.stringify({ eventId, roomId: res.roomId, socketToken: res.socketToken })
        );
        return res.socketToken;
      }
      return null;
    } catch (err) {
      console.error('[WeeklyEventController] refreshSocketToken failed:', err);
      return null;
    }
  }, [userGrade]);

  // Socket connection hook
  const socketActions = useWeeklyEventSocket({
    socketToken: store.socketToken,
    enabled: !!store.socketToken,
    refreshToken: refreshSocketToken,
  });

  // Local question timer states
  const [remaining, setRemaining] = useState(0);
  const [perQuestionSec, setPerQuestionSec] = useState(0);
  const [locked, setLocked] = useState(false);

  const handleJoin = async () => {
    if (!store.event || !user) return;
    try {
      const res = await weeklyEventApi.joinEvent(store.event._id!, userGrade);
      if (res.socketToken) {
        // Save session info locally
        sessionStorage.setItem(
          'uniclub_weekly_event_session',
          JSON.stringify({
            eventId: store.event._id,
            roomId: res.roomId,
            socketToken: res.socketToken,
          })
        );

        setAlreadyJoined(true);
        useWeeklyEventStore.setState({
          roomId: res.roomId,
          socketToken: res.socketToken,
        });

        // Determine initial phase based on exact room status returned by joinEvent
        if (res.status === 'Waiting') {
          store.setPhase('waiting');
        } else if (res.status === 'InProgress') {
          store.setPhase(store.questions.length > 0 ? 'exam' : 'loading');
        } else if (res.status === 'Grading') {
          store.setPhase('loading');
        } else if (res.status === 'Showing') {
          store.setPhase('leaderboard');
        } else if (res.status === 'Closed' || res.status === 'Cancelled') {
          store.setPhase('closed');
        } else {
          store.setPhase('waiting');
        }
      }
    } catch (err: any) {
      console.error('[WeeklyEventController] Error joining:', err);
      store.setSystemError({
        code: 'EVENT_LATE',
        message: err.message || 'Không thể tham gia sự kiện',
        retryable: false,
      });
    }
  };

  const handleResume = async () => {
    // Always call handleJoin to fetch a FRESH socket token and prevent expiration errors
    await handleJoin();
  };

  // 1. Redirect to error page if authentication fails
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  // 2. Fetch current event info on mount (once user is authenticated)
  useEffect(() => {
    if (!user) return;

    let active = true;

    async function loadCurrentEvent() {
      try {
        const res = await weeklyEventApi.getCurrent();
        if (!active) return;

        if (res.event) {
          store.setEvent(res.event, res.status, res.nextEventAt, res.lastEvent);

          const isJoined = res.hasJoined || false;
          if (isJoined && res.socketToken && res.roomId) {
            sessionStorage.setItem(
              'uniclub_weekly_event_session',
              JSON.stringify({
                eventId: res.event._id,
                roomId: res.roomId,
                socketToken: res.socketToken,
              })
            );
            setAlreadyJoined(true);
            useWeeklyEventStore.setState({
              roomId: res.roomId,
              socketToken: res.socketToken,
            });

            // Set initial phase directly based on current event status
            const currentStatus = res.event.status;
            if (currentStatus === 'Waiting') {
              store.setPhase('waiting');
            } else if (currentStatus === 'InProgress') {
              store.setPhase(store.questions.length > 0 ? 'exam' : 'loading');
            } else if (currentStatus === 'Grading') {
              store.setPhase('loading');
            } else if (currentStatus === 'Showing') {
              store.setPhase('leaderboard');
            } else if (currentStatus === 'Closed' || currentStatus === 'Cancelled') {
              store.setPhase('closed');
            } else {
              store.setPhase('waiting');
            }
          } else {
            // Check if user has an active session stored locally for this event as fallback
            const savedSession = sessionStorage.getItem('uniclub_weekly_event_session');
            if (savedSession) {
              const { eventId } = JSON.parse(savedSession);
              if (eventId === res.event._id) {
                setAlreadyJoined(true);
                
                // If event is open or in progress and we joined before, automatically resume with a fresh token
                if (res.status === 'open' || res.status === 'in-progress') {
                  handleJoin();
                }
              }
            }
          }
        } else {
          store.setEvent(null, res.status, res.nextEventAt, res.lastEvent);
          store.setPhase('closed');
        }
      } catch (err: any) {
        console.error('[WeeklyEventController] Error loading event:', err);
        store.setSystemError({
          code: 'INVALID_STATE',
          message: 'Không thể tải thông tin sự kiện tuần',
          retryable: true,
        });
      } finally {
        if (active) {
          setLoadingEvent(false);
        }
      }
    }

    loadCurrentEvent();

    return () => {
      active = false;
    };
  }, [user]);

  // 3. Question timer countdown effect
  useEffect(() => {
    if (store.phase !== 'exam') return;

    const runTimer = () => {
      const timerInfo = store.updateTimer();
      setRemaining(timerInfo.questionRemainingSec);
      setPerQuestionSec(timerInfo.perQuestionSec);

      if (timerInfo.isFinished) {
        setLocked(true);
        if (!submittedFinalRef.current) {
          submittedFinalRef.current = true;
          console.log('[WeeklyEventController] Time is up, submitting final exam');
          socketActions.submitFinal();
        }
      } else {
        setLocked(timerInfo.questionRemainingSec <= 0);
      }
    };

    runTimer();
    const interval = setInterval(runTimer, 1000);

    return () => clearInterval(interval);
  }, [store.phase, store.questions, store.examStartedAt, store.examEndAt, store.skewMs, socketActions]);

  // 4. Send WebView game:ended notification when personal result is received
  useEffect(() => {
    if (store.personalResult && store.event && user && !gameEndedNotified.current) {
      gameEndedNotified.current = true;
      notifyGameEnded({
        userId: user.userId,
        gameType: 'weekly_event',
        kafkaGameType: 'SU_KIEN_TUAN',
        sessionId: store.event._id,
        point: store.personalResult.score,
        playTime: Math.round(store.personalResult.totalTimeMs / 1000),
        sessionCompleted: true,
        isWin: store.personalResult.rank <= 10,
        correctCount: store.personalResult.correctCount,
        totalQuestions: store.questions.length || 25,
      });
    }
  }, [store.personalResult, store.event, store.questions, user]);

  // 5. Auto refresh event state when a countdown hits 0 (before-open -> open, or closed -> open)
  useEffect(() => {
    let targetTime: number | null = null;

    if (store.phase === 'entry') {
      if (store.entryStatus === 'before-open' && store.event?.scheduledStartAt) {
        targetTime = new Date(store.event.scheduledStartAt).getTime();
      } else if (store.entryStatus === 'closed' && store.nextEventAt) {
        targetTime = new Date(store.nextEventAt).getTime();
      }
    } else if (store.phase === 'closed' && store.nextEventAt) {
      targetTime = new Date(store.nextEventAt).getTime();
    }

    if (!targetTime) return;

    // Calculate delay based on server skew: serverNow = Date.now() + skewMs
    const clientTargetTime = targetTime - store.skewMs;
    const delay = clientTargetTime - Date.now();

    // If it's more than 10 seconds past the target time, it's stale (or we already refreshed it)
    if (delay < -10000) return;

    const runFetch = () => {
      console.log('[WeeklyEventController] Countdown reached 0. Refreshing event state...');
      
      const fetchWithRetry = async (attempt = 1) => {
        try {
          const res = await weeklyEventApi.getCurrent();
          
          const wasBeforeOpen = store.entryStatus === 'before-open';
          const wasClosed = store.phase === 'closed' || store.entryStatus === 'closed';

          const isStillBeforeOpen = res.status === 'before-open';
          const isStillClosed = res.status === 'closed';

          // If the status has not transitioned yet, retry
          const needsRetry = (wasBeforeOpen && (isStillBeforeOpen || isStillClosed)) || 
                             (wasClosed && isStillClosed);
          
          if (needsRetry && attempt < 5) {
            console.log(`[WeeklyEventController] Event status not updated yet (attempt ${attempt}). Retrying in 2000ms...`);
            setTimeout(() => fetchWithRetry(attempt + 1), 2000);
            return;
          }

          if (res.event) {
            store.setEvent(res.event, res.status, res.nextEventAt, res.lastEvent);
            if (res.status === 'open') {
              store.setPhase('entry');
            }
          } else {
            store.setEvent(null, res.status, res.nextEventAt, res.lastEvent);
            store.setPhase('closed');
          }
        } catch (err) {
          console.error(`[WeeklyEventController] Auto-refresh failed on attempt ${attempt}:`, err);
          if (attempt < 5) {
            setTimeout(() => fetchWithRetry(attempt + 1), 2000);
          }
        }
      };

      // Add a small random jitter (500ms - 1500ms) to spread out simultaneous traffic
      const jitter = 500 + Math.random() * 1000;
      setTimeout(() => fetchWithRetry(1), jitter);
    };

    if (delay <= 0) {
      runFetch();
      return;
    }

    console.log(`[WeeklyEventController] Scheduling auto-refresh in ${delay}ms`);
    const timer = setTimeout(runFetch, delay);

    return () => clearTimeout(timer);
  }, [store.phase, store.entryStatus, store.event, store.nextEventAt, store.skewMs]);

  const handleViewLeaderboard = async () => {
    if (!store.lastEvent || !user) return;
    try {
      const [leaderboardRes, resultRes] = await Promise.allSettled([
        weeklyEventApi.getLeaderboard(store.lastEvent._id, userGrade),
        weeklyEventApi.getPersonalResult(store.lastEvent._id),
      ]);

      let topN: any[] = [];
      if (leaderboardRes.status === 'fulfilled' && leaderboardRes.value.success) {
        topN = leaderboardRes.value.leaderboard;
      }

      let personalResult: any = null;
      if (resultRes.status === 'fulfilled' && resultRes.value.success) {
        personalResult = resultRes.value.result;
      }

      console.log(personalResult);      

      useWeeklyEventStore.setState({
        leaderboard: topN,
        personalResult: personalResult,
      });

      store.setPhase('leaderboard');
    } catch (err) {
      console.error('[WeeklyEventController] Error loading historical leaderboard:', err);
    }
  };



  // Helper formatting for loading page announce time
  const getAnnounceTimeStr = () => {
    if (!store.event) return '10h27';
    const start = new Date(store.event.scheduledStartAt);
    const waitingMin = store.event.waitingDuration ?? 5;
    const examMin = store.event.examDuration ?? 20;
    const gradingMin = 2; // Estimated time to process grading and leaderboard

    start.setMinutes(start.getMinutes() + waitingMin + examMin + gradingMin);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(start.getHours())}h${pad(start.getMinutes())}`;
  };

  // Helper calculating absolute waiting room end time
  const getWaitingEndTime = () => {
    if (!store.event) return Date.now();
    const scheduledStart = new Date(store.event.scheduledStartAt).getTime();
    const waitingDurationMs = (store.event.waitingDuration ?? 5) * 60 * 1000;
    return scheduledStart + waitingDurationMs;
  };

  // Render loading state while authenticating user or initializing event data
  if (userLoading || loadingEvent) {
    return (
      <div className="we-stage is-soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="we-spinner">
          <svg viewBox="0 0 96 96" fill="none" aria-hidden>
            <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,.12)" strokeWidth="7" />
            <path d="M88 48a40 40 0 0 0-40-40" stroke="var(--we-accent)" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="we-stage is-soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Không tìm thấy thông tin người dùng
      </div>
    );
  }

  // Render active screens based on current state machine phase
  switch (store.phase) {
  // switch ('loading') {
    case 'entry':
      return (
        <EventEntry
          status={store.entryStatus}
          weeklyTitle={store.event?.title ?? 'Sự Kiện Tuần'}
          grade={userGrade}
          openAt={store.event?.scheduledStartAt ? new Date(store.event.scheduledStartAt) : undefined}
          nextEventAt={store.nextEventAt ? new Date(store.nextEventAt) : undefined}
          alreadyJoined={alreadyJoined}
          skewMs={store.skewMs}
          onJoin={handleJoin}
          onResume={handleResume}
          waitingDuration={store.event?.waitingDuration}
          topRight={<ExitButton from="/weekly-event" className="we-exit-btn">Thoát</ExitButton>}
        />
      );

    case 'waiting':
      return (
        <WaitingRoom
          weeklyTitle={store.event?.title ?? 'Sự Kiện Tuần'}
          grade={userGrade}
          onlineCount={store.onlineCount}
          startAt={getWaitingEndTime()}
          skewMs={store.skewMs}
          topRight={
            <>
              <OnlineCounter count={store.onlineCount} renderLabel={(n) => <><span className="n">{n.toLocaleString('vi-VN')}</span> trong phòng</>} />
              <ExitButton from="/weekly-event" className="we-exit-btn">Thoát</ExitButton>
            </>
          }
        />
      );

    case 'exam': {
      const currentQ = store.questions[store.currentQuestionIdx];
      if (!currentQ) {
        return <SubmissionLoading grade={userGrade} announceAt={getAnnounceTimeStr()} />;
      }

      // Map shared types options to UI AnswerOption type (text -> label)
      const mappedOptions = currentQ.options.map((opt) => ({
        key: opt.key as 'A' | 'B' | 'C' | 'D',
        label: opt.text,
      }));

      const isSaved = store.answers[currentQ.questionId]?.saved ?? false;
      const selectedAnswer = store.answers[currentQ.questionId]?.key ?? null;

      return (
        <ExamScreen
          grade={userGrade}
          index={store.currentQuestionIdx + 1}
          total={store.questions.length}
          question={currentQ.stem}
          options={mappedOptions}
          answeredCount={store.answeredCount}
          selected={selectedAnswer}
          saved={isSaved}
          locked={locked}
          remaining={remaining}
          perQuestionSec={perQuestionSec}
          conn={store.connState}
          showDisconnect={store.connState === 'disconnected'}
          resume={store.resumeInfo}
          onSelect={(key) => {
            if (!locked) {
              socketActions.submitAnswer(currentQ.questionId, key);
            }
          }}
          footer={<ExitButton from="/weekly-event" className="we-exit-btn">Thoát</ExitButton>}
        />
      );
    }

    case 'loading':
      return <SubmissionLoading grade={userGrade} announceAt={getAnnounceTimeStr()} headerRight={<ExitButton from="/weekly-event" className="we-exit-btn">Thoát</ExitButton>} />;

    case 'leaderboard':      
      return (
        <LeaderboardScreen
          grade={userGrade}
          weeklyTitle={store.event?.title || store.lastEvent?.title}
          entries={store.leaderboard.map((e) => ({
            ...e,
            isMe: e.studentId === user.userId,
          }))}
          total={store.questions.length || 25}
          me={
            store.personalResult
              ? {
                  name: user.name,
                  avatarUrl: user.avatar,
                  correct: store.personalResult.correctCount,
                  wrong: store.personalResult.totalAnswered - store.personalResult.correctCount,
                  skipped: (store.questions.length || 25) - store.personalResult.totalAnswered,
                  score: store.personalResult.score,
                  rank: store.personalResult.rank,
                  totalTimeMs: store.personalResult.totalTimeMs,
                }
              : null
          }
          right={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!store.event ? (
                <>
                  {store.personalResult && (
                    <GameButton size="sm" color="ghost" onClick={() => store.setPhase('result')}>
                      Chi tiết kết quả
                    </GameButton>
                  )}
                  <GameButton size="sm" color="ghost" onClick={() => store.setPhase('closed')}>
                    Quay lại
                  </GameButton>
                </>
              ) : (
                store.personalResult && (
                  <GameButton size="sm" color="ghost" onClick={() => store.setPhase('result')}>
                    Chi tiết kết quả
                  </GameButton>
                )
              )}
              <ExitButton from="/weekly-event" className="we-exit-btn">Thoát</ExitButton>
            </div>
          }
        />
      );

    case 'result':
      return (
        <PersonalResultScreen
          grade={userGrade}
          name={user.name}
          avatarUrl={user.avatar}
          correct={store.personalResult?.correctCount ?? 0}
          wrong={
            (store.personalResult?.totalAnswered ?? 0) -
            (store.personalResult?.correctCount ?? 0)
          }
          skipped={
            (store.questions.length || 25) - (store.personalResult?.totalAnswered ?? 0)
          }
          score={store.personalResult?.score ?? 0}
          rank={store.personalResult?.rank ?? 0}
          totalTimeMs={store.personalResult?.totalTimeMs ?? 0}
          onLeaderboard={() => store.setPhase('leaderboard')}
          headerRight={<ExitButton from={`/weekly-event`} className="we-exit-btn">Thoát</ExitButton>}
        />
      );

    case 'closed':
    default:
      return (
        <EventClosedScreen
          grade={userGrade}
          nextEventAt={
            store.nextEventAt
              ? new Date(store.nextEventAt)
              : null
          }
          skewMs={store.skewMs}
          cancelled={!!store.cancelReason}
          cancelReason={store.cancelReason || undefined}
          lastEvent={store.lastEvent}
          onViewLeaderboard={handleViewLeaderboard}
          footerButton={<ExitButton from="/weekly-event" className="gbtn gbtn-ghost">Thoát</ExitButton>}
        />
      );
  }
}
