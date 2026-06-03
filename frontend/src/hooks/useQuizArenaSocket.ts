// ============================================================
// useQuizArenaSocket — Socket.IO hook cho Quiz Arena (So Tài)
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { QUIZ_ARENA_SOCKET_EVENTS } from '@uniclub/shared';
import type { QuizQuestionPublic, QuizPlayerState, QuizArenaResult } from '@uniclub/shared';
import type { QuestionResult } from '../stores/quiz-arena';

export interface UseQuizArenaSocketOptions {
  sessionId: string;
  /** userId của người chơi — gửi kèm join-session để backend set socket.data.userId */
  userId: string;
  /** Called when server sends countdown (both players joined) */
  onCountdown: (startsAt: number) => void;
  /** Called when server broadcasts a new question */
  onQuestion: (q: QuizQuestionPublic) => void;
  /** Called when opponent has submitted their answer (no answer revealed yet) */
  onOpponentAnswered: (questionIndex: number) => void;
  /** Called when both players have answered — reveals correct answer + scores */
  onQuestionResult: (result: QuestionResult) => void;
  /** Called after each question result — updated scores for both players */
  onStateUpdate: (playerA: QuizPlayerState, playerB: QuizPlayerState) => void;
  /** Called when all 10 questions are done */
  onGameEnd: (result: QuizArenaResult) => void;
  /** Called when opponent disconnects mid-game */
  onOpponentDisconnected: (userId: string) => void;
}

export interface QuizArenaSocketActions {
  /** Emit join-session after VersusScreen completes */
  joinSession: () => void;
  /** Emit selected answer (index 0-3) or null for timeout/skip */
  submitAnswer: (selectedIndex: number | null) => void;
}

export function useQuizArenaSocket({
  sessionId,
  userId,
  onCountdown,
  onQuestion,
  onOpponentAnswered,
  onQuestionResult,
  onStateUpdate,
  onGameEnd,
  onOpponentDisconnected,
}: UseQuizArenaSocketOptions): QuizArenaSocketActions {
  const socketRef = useRef<Socket | null>(null);
  /** Track if joinSession was called so we can re-emit on reconnect */
  const joinedRef = useRef(false);

  // Callback refs to avoid stale closures
  const onCountdownRef = useRef(onCountdown);
  const onQuestionRef = useRef(onQuestion);
  const onOpponentAnsweredRef = useRef(onOpponentAnswered);
  const onQuestionResultRef = useRef(onQuestionResult);
  const onStateUpdateRef = useRef(onStateUpdate);
  const onGameEndRef = useRef(onGameEnd);
  const onOpponentDisconnectedRef = useRef(onOpponentDisconnected);

  onCountdownRef.current = onCountdown;
  onQuestionRef.current = onQuestion;
  onOpponentAnsweredRef.current = onOpponentAnswered;
  onQuestionResultRef.current = onQuestionResult;
  onStateUpdateRef.current = onStateUpdate;
  onGameEndRef.current = onGameEnd;
  onOpponentDisconnectedRef.current = onOpponentDisconnected;

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[QuizArenaSocket] Connected:', socket.id);
      // Re-emit join-session on reconnect if already joined
      if (joinedRef.current) {
        socket.emit(QUIZ_ARENA_SOCKET_EVENTS.JOIN_SESSION, { sessionId, userId });
      }
    });

    socket.on(QUIZ_ARENA_SOCKET_EVENTS.COUNTDOWN, (data: { startsAt: number }) => {
      onCountdownRef.current(data.startsAt);
    });

    socket.on(QUIZ_ARENA_SOCKET_EVENTS.QUESTION, (data: QuizQuestionPublic) => {
      onQuestionRef.current(data);
    });

    socket.on(
      QUIZ_ARENA_SOCKET_EVENTS.OPPONENT_ANSWERED,
      (data: { questionIndex: number }) => {
        onOpponentAnsweredRef.current(data.questionIndex);
      },
    );

    socket.on(
      QUIZ_ARENA_SOCKET_EVENTS.QUESTION_RESULT,
      (data: {
        questionIndex: number;
        correctIndex: number;
        playerA: { earnedPoints: number; responseTimeMs: number | null };
        playerB: { earnedPoints: number; responseTimeMs: number | null };
      }) => {
        // Map earnedPoints → earned để khớp với QuestionResult interface
        onQuestionResultRef.current({
          questionIndex: data.questionIndex,
          correctIndex: data.correctIndex,
          playerA: { earned: data.playerA.earnedPoints, responseTimeMs: data.playerA.responseTimeMs },
          playerB: { earned: data.playerB.earnedPoints, responseTimeMs: data.playerB.responseTimeMs },
        });
      },
    );

    socket.on(
      QUIZ_ARENA_SOCKET_EVENTS.STATE,
      (data: { playerA: QuizPlayerState; playerB: QuizPlayerState }) => {
        onStateUpdateRef.current(data.playerA, data.playerB);
      },
    );

    socket.on(QUIZ_ARENA_SOCKET_EVENTS.END, (data: QuizArenaResult) => {
      onGameEndRef.current(data);
    });

    socket.on(
      QUIZ_ARENA_SOCKET_EVENTS.OPPONENT_DISCONNECTED,
      (data: { userId: string }) => {
        onOpponentDisconnectedRef.current(data.userId);
      },
    );

    return () => {
      console.log('[QuizArenaSocket] Disconnecting');
      socket.disconnect();
    };
  }, [sessionId]);

  const joinSession = useCallback(() => {
    joinedRef.current = true;
    // Truyền userId để backend set socket.data.userId
    socketRef.current?.emit(QUIZ_ARENA_SOCKET_EVENTS.JOIN_SESSION, { sessionId, userId });
  }, [sessionId, userId]);

  const submitAnswer = useCallback(
    (selectedIndex: number | null) => {
      socketRef.current?.emit(QUIZ_ARENA_SOCKET_EVENTS.ANSWER, {
        sessionId,
        selectedIndex,
      });
    },
    [sessionId],
  );

  return { joinSession, submitAnswer };
}
