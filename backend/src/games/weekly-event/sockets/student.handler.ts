// ============================================================
// Weekly Event — Student Socket Handler (namespace /we)
// FLOW-003 Pha 2, FLOW-004, FLOW-006, FLOW-007
// ============================================================

import type { Socket, Server } from 'socket.io';
import {
  WEEKLY_EVENT_SOCKET_EVENTS,
  WEEKLY_EVENT_CLIENT_EVENTS,
  WEEKLY_EVENT_ROOM_PREFIX,
  WEEKLY_EVENT_STUDENT_ROOM_PREFIX,
} from '@uniclub/shared';
import { WeeklyEventSocketService } from '../services/weekly-event-socket.service';
import { WeeklyEventRoomService } from '../services/weekly-event-room.service';
import { WeeklyEventAnswerService } from '../services/weekly-event-answer.service';
import { WeeklyEventStateMachine } from '../services/weekly-event-state-machine.service';
import { WeeklyEventGradingService } from '../services/weekly-event-grading.service';
import { ExamBankService } from '../services/exam-bank.service';
import { WeeklyEventModel, WeeklyEventRoomModel, WeeklyEventParticipationModel } from '../../../models/index';

function roomName(eventId: string, grade: number): string {
  return `${WEEKLY_EVENT_ROOM_PREFIX}:${eventId}:${grade}`;
}

function studentRoomName(studentId: string): string {
  return `${WEEKLY_EVENT_STUDENT_ROOM_PREFIX}:${studentId}`;
}

export function registerWeeklyEventStudentHandlers(io: Server, socket: Socket): void {
  const studentId = socket.data.studentId as string;
  const eventId = socket.data.eventId as string;
  const grade = socket.data.grade as number;

  if (!studentId || !eventId || grade == null) {
    socket.emit(WEEKLY_EVENT_SOCKET_EVENTS.SYSTEM_ERROR, {
      code: 'INVALID_STATE',
      message: 'Missing auth data',
      retryable: false,
    });
    socket.disconnect();
    return;
  }

  // Join rooms
  socket.join(roomName(eventId, grade));
  socket.join(studentRoomName(studentId));

  console.log(`[WeeklyEvent] Student connected: ${studentId} (event=${eventId}, grade=${grade}, socket=${socket.id})`);

  // ============================================================
  // C01: room:join — chính thức join phòng
  // ============================================================
  socket.on(WEEKLY_EVENT_CLIENT_EVENTS.ROOM_JOIN, async (_payload, ack) => {
    try {
      // Broadcast online count
      const count = await WeeklyEventRoomService.getOnlineCount(eventId, grade);
      io.to(roomName(eventId, grade)).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_ONLINE_COUNT, {
        grade,
        count,
      });

      ack?.({ ok: true });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ============================================================
  // C02: answer:submit — submit 1 đáp án
  // ============================================================
  socket.on(WEEKLY_EVENT_CLIENT_EVENTS.ANSWER_SUBMIT, async (payload, ack) => {
    try {
      const { questionId, key } = payload || {};
      if (!questionId || key === undefined) {
        socket.emit(WEEKLY_EVENT_SOCKET_EVENTS.SYSTEM_ERROR, {
          code: 'INVALID_STATE',
          message: 'Missing questionId or key',
          retryable: false,
        });
        return;
      }

      const result = await WeeklyEventAnswerService.submitAnswer(
        eventId,
        studentId,
        questionId,
        key,
      );

      // Emit ack riêng cho student
      io.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.ANSWER_ACK, result);

      ack?.({ ok: true });
    } catch (err: any) {
      if (err.message === 'RATE_LIMITED') {
        socket.emit(WEEKLY_EVENT_SOCKET_EVENTS.SYSTEM_ERROR, {
          code: 'RATE_LIMITED',
          message: 'Quá nhiều yêu cầu',
          retryable: true,
        });
      } else {
        socket.emit(WEEKLY_EVENT_SOCKET_EVENTS.SYSTEM_ERROR, {
          code: 'INVALID_STATE',
          message: err.message,
          retryable: false,
        });
      }
      ack?.({ ok: false, error: err.message });
    }
  });

  // ============================================================
  // C03: session:request-resume — yêu cầu khôi phục khi reconnect
  // ============================================================
  socket.on(WEEKLY_EVENT_CLIENT_EVENTS.SESSION_REQUEST_RESUME, async (_payload, ack) => {
    try {
      const roomState = await WeeklyEventRoomService.getRoomState(eventId, grade);
      const answers = await WeeklyEventAnswerService.getAnswers(eventId, studentId);

      // Lấy participation để biết shuffleSeed
      const participation = await WeeklyEventParticipationModel.findOne({
        eventId,
        studentId,
      }).lean();

      switch (roomState.status) {
        case 'Waiting':
          io.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_STATE, {
            grade,
            status: 'Waiting',
            transitionedAt: roomState.transitionedAt,
          });
          break;

        case 'InProgress': {
          // Lấy exam và shuffle questions
          const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
          if (room?.examId) {
            const exam = await ExamBankService.getExamById(room.examId);
            if (exam) {
              const publicQuestions = ExamBankService.toPublicExam(exam).questions.map((q, idx) => ({
                ...q,
                questionIndex: idx,
                totalQuestions: exam.totalQuestions,
              }));

              io.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.SESSION_RESUME, {
                answers,
                currentQuestionIdx: Object.keys(answers).length,
                remainingMs: 0, // Will be calculated by client using time sync
                status: 'InProgress',
                questions: publicQuestions,
              });
            }
          }
          break;
        }

        case 'Grading':
          socket.emit(WEEKLY_EVENT_SOCKET_EVENTS.SYSTEM_ERROR, {
            code: 'PENDING_RESULTS',
            message: 'Đang chấm bài, vui lòng đợi...',
            retryable: true,
          });
          break;

        case 'Showing': {
          const room = await WeeklyEventRoomModel.findOne({ eventId, grade }).lean();
          if (room) {
            const leaderboard = await WeeklyEventGradingService.getLeaderboardSnapshot(
              eventId,
              String(room._id),
            );
            const personalResult = await WeeklyEventGradingService.getPersonalResult(
              eventId,
              studentId,
            );

            if (leaderboard) {
              io.to(studentRoomName(studentId)).emit(
                WEEKLY_EVENT_SOCKET_EVENTS.ROOM_LEADERBOARD,
                { topN: leaderboard, computedAt: new Date().toISOString() },
              );
            }
            if (personalResult) {
              io.to(studentRoomName(studentId)).emit(
                WEEKLY_EVENT_SOCKET_EVENTS.PERSONAL_RESULT,
                {
                  correctCount: personalResult.correctCount,
                  totalAnswered: personalResult.totalAnswered,
                  rank: personalResult.rank,
                  score: personalResult.score,
                  totalTimeMs: personalResult.totalTimeMs,
                },
              );
            }
          }
          break;
        }

        case 'Closed':
          socket.emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_STATE, {
            grade,
            status: 'Closed',
            transitionedAt: roomState.transitionedAt,
          });
          break;
      }

      ack?.({ ok: true });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ============================================================
  // C04: time:sync — đồng bộ thời gian
  // ============================================================
  socket.on(WEEKLY_EVENT_CLIENT_EVENTS.TIME_SYNC, (payload) => {
    const { clientTime } = payload || {};
    io.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.SERVER_TIME, {
      serverTime: Date.now(),
      clientSentAt: clientTime || 0,
    });
  });

  // ============================================================
  // C05: exam:submit-final — nộp bài sớm
  // ============================================================
  socket.on(WEEKLY_EVENT_CLIENT_EVENTS.EXAM_SUBMIT_FINAL, async (_payload, ack) => {
    try {
      await WeeklyEventAnswerService.submitFinal(eventId, studentId);

      // Cập nhật participation
      await WeeklyEventParticipationModel.findOneAndUpdate(
        { eventId, studentId },
        { $set: { submittedAt: new Date(), submissionType: 'manual' } },
      );

      ack?.({ ok: true });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ============================================================
  // disconnect — xử lý khi mất kết nối
  // ============================================================
  socket.on('disconnect', async () => {
    console.log(`[WeeklyEvent] Student disconnected: ${studentId} (socket=${socket.id})`);

    try {
      // Cập nhật socket mapping
      await WeeklyEventSocketService.removeSocketMapping(eventId, studentId, socket.id);

      // Rời khỏi online set
      await WeeklyEventRoomService.leaveRoom(eventId, studentId, grade);

      // Tăng disconnectCount
      await WeeklyEventParticipationModel.findOneAndUpdate(
        { eventId, studentId },
        { $inc: { disconnectCount: 1 } },
      );

      // Broadcast online count mới
      const count = await WeeklyEventRoomService.getOnlineCount(eventId, grade);
      io.to(roomName(eventId, grade)).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_ONLINE_COUNT, {
        grade,
        count,
      });
    } catch (err) {
      console.error('[WeeklyEvent] Disconnect error:', err);
    }
  });
}
