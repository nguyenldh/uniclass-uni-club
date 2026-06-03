// ============================================================
// BossBattlePage — SCR-02 Màn hình Chiến đấu
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BossBattle } from '../../design-system/bossbattle';
import type { AnswerOption } from '../../design-system/bossbattle/battle';
import { useUser } from '../../hooks/useUser';
import { useBossBattleStore } from '../../stores/boss-battle';
import { bossBattleApi } from '../../services/boss-battle';

const REVEAL_DELAY_MS = 1500;

export function BossBattlePage() {
  const navigate = useNavigate();
  const { user, error: userError } = useUser();

  const {
    questions,
    currentQuestionIndex,
    attemptId,
    phase,
    selectedAnswer,
    lastAnswerResponse,
    pips,
    timeRemaining,
    bossHpPercent,
    bossStates,
    bossName,
    error,
    selectAnswer,
    applyAnswerResponse,
    nextQuestion,
    completeAttempt,
    tick,
  } = useBossBattleStore();

  const grade = user?.grade ?? 4;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  // Nếu không có questions (F5 hoặc vào trực tiếp) → redirect về lobby
  // Lobby sẽ gọi startBattle trước khi navigate sang đây
  useEffect(() => {
    if (questions.length === 0 && !attemptId) {
      navigate('/boss-battle', { replace: true });
    }
  }, [questions.length, attemptId, navigate]);

  // Redirect về lobby nếu không có questions sau khi load
  useEffect(() => {
    if (!attemptId && questions.length === 0 && error) {
      navigate('/boss-battle', { replace: true });
    }
  }, [attemptId, questions.length, error, navigate]);

  // ---- Per-question timer ----
  useEffect(() => {
    if (phase === 'battle' || phase === 'answering') {
      timerRef.current = setInterval(() => tick(), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-submit khi hết giờ ----
  useEffect(() => {
    if (
      (phase === 'battle' || phase === 'answering') &&
      timeRemaining <= 0 &&
      !submittedRef.current
    ) {
      submittedRef.current = true;
      handleSubmitAnswer(null);
    }
  }, [timeRemaining, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-advance sau reveal ----
  useEffect(() => {
    if (phase === 'revealing') {
      revealTimerRef.current = setTimeout(() => {
        const isLast = currentQuestionIndex >= questions.length - 1;
        if (isLast) {
          completeAttempt(attemptId!).then(() => {
            navigate('/boss-battle/result');
          });
        } else {
          nextQuestion();
          submittedRef.current = false;
        }
      }, REVEAL_DELAY_MS);
    }
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitAnswer = useCallback(
    async (selectedIndex: number | null) => {
      if (!attemptId) return;
      const q = questions[currentQuestionIndex];
      if (!q) return;

      try {
        const res = await bossBattleApi.submitAnswer(attemptId, q.id, selectedIndex);
        applyAnswerResponse(res);
      } catch (err: any) {
        console.error('[BossBattle] submitAnswer failed:', err);
        // Vẫn reveal với trạng thái sai nếu API lỗi
        applyAnswerResponse({
          isCorrect: false,
          correctIndex: -1,
          responseTimeSec: 0,
          pointsAwarded: 0,
          nextQuestionIndex: null,
          attemptCompleted: false,
        });
      }
    },
    [attemptId, questions, currentQuestionIndex, applyAnswerResponse],
  );

  const handleSelect = useCallback(
    (key: AnswerOption['key']) => {
      if (phase !== 'battle') return;
      if (submittedRef.current) return;

      const idxMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      const idx = idxMap[key];

      selectAnswer(idx);
      submittedRef.current = true;
      handleSubmitAnswer(idx);
    },
    [phase, selectAnswer, handleSubmitAnswer],
  );

  // ---- Loading ----
  if (questions.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 600,
          color: '#fff',
          fontSize: 18,
          background: '#170f24',
          borderRadius: 22,
        }}
      >
        Đang chuẩn bị câu hỏi...
      </div>
    );
  }

  const cur = questions[currentQuestionIndex];
  if (!cur) return null;

  const options: AnswerOption[] = cur.options.map((label, i) => ({
    key: (['A', 'B', 'C', 'D'] as const)[i],
    label,
  }));

  const correctKey =
    lastAnswerResponse?.correctIndex != null && lastAnswerResponse.correctIndex >= 0
      ? (['A', 'B', 'C', 'D'] as const)[lastAnswerResponse.correctIndex]
      : null;

  const selectedKey =
    selectedAnswer != null
      ? (['A', 'B', 'C', 'D'] as const)[selectedAnswer]
      : null;

  return (
    <BossBattle
      bossName={bossName}
      bossHpPercent={bossHpPercent}
      states={bossStates}
      index={currentQuestionIndex + 1}
      total={questions.length}
      pips={pips}
      remaining={timeRemaining}
      timeLimit={cur.tMaxSec}
      question={cur.content}
      image={cur.imageUrl}
      options={options}
      phase={phase === 'revealing' ? 'revealing' : 'answering'}
      selected={selectedKey}
      correct={phase === 'revealing' ? correctKey : null}
      onSelect={handleSelect}
      lastDamage={
        phase === 'revealing' && lastAnswerResponse?.pointsAwarded
          ? lastAnswerResponse.pointsAwarded
          : null
      }
      bossHit={phase === 'revealing' && lastAnswerResponse?.isCorrect}
    />
  );
}
