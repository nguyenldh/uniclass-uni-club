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
  WEEKLY_EVENT_REDIS_KEYS,
  WEEKLY_EVENT_DEFAULT_KEY_TTL,
} from '@uniclub/shared';
import { redis } from '../../../config/index';
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

// Broadcast số học sinh online của phòng NGAY LẬP TỨC (không đợi timer định kỳ 5s).
// Dùng khi join/leave để người mới vào & cả phòng cập nhật tức thì.
async function emitOnlineCount(socket: Socket, eventId: string, grade: number): Promise<void> {
  try {
    const count = await WeeklyEventRoomService.getOnlineCount(eventId, grade);
    socket.nsp.to(roomName(eventId, grade)).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_ONLINE_COUNT, {
      grade,
      count,
    });
  } catch (err) {
    console.error('[WeeklyEvent] Immediate online count broadcast failed:', err);
  }
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
      // Ensure student is added to online set
      await WeeklyEventRoomService.enterRoom(eventId, studentId, grade);

      // Đẩy online-count ngay để người vừa vào (và cả phòng) thấy số cập nhật tức thì
      await emitOnlineCount(socket, eventId, grade);

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
      socket.nsp.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.ANSWER_ACK, result);

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
          socket.nsp.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_STATE, {
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

              let remainingMs = 0;
              if (roomState.nextTransitionAt) {
                remainingMs = Math.max(0, new Date(roomState.nextTransitionAt).getTime() - Date.now());
              } else {
                const event = await WeeklyEventModel.findById(eventId).lean();
                if (event) {
                  const scheduledStart = new Date(event.scheduledStartAt);
                  const examEnd = new Date(scheduledStart.getTime() + (event.waitingDuration + event.examDuration) * 60000);
                  remainingMs = Math.max(0, examEnd.getTime() - Date.now());
                }
              }

              socket.nsp.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.SESSION_RESUME, {
                answers,
                currentQuestionIdx: Object.keys(answers).length,
                remainingMs,
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
              socket.nsp.to(studentRoomName(studentId)).emit(
                WEEKLY_EVENT_SOCKET_EVENTS.ROOM_LEADERBOARD,
                { topN: leaderboard, computedAt: new Date().toISOString() },
              );
            }
            if (personalResult) {
              socket.nsp.to(studentRoomName(studentId)).emit(
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
    socket.nsp.to(studentRoomName(studentId)).emit(WEEKLY_EVENT_SOCKET_EVENTS.SERVER_TIME, {
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

      const submittedSetKey = `${WEEKLY_EVENT_REDIS_KEYS.SUBMITTED(eventId)}:${grade}`;
      
      // Atomic Check trên Redis Set
      const isNewSubmit = await redis.sadd(submittedSetKey, studentId);

      // Set TTL safety net cho submitted set
      await redis.expire(submittedSetKey, WEEKLY_EVENT_DEFAULT_KEY_TTL);

      if (isNewSubmit === 1) {
        try {
          // Cập nhật trạng thái nộp bài của học sinh (phân tán theo key học sinh, không gây lock)
          await WeeklyEventParticipationModel.findOneAndUpdate(
            { eventId, studentId, submittedAt: null },
            { $set: { submittedAt: new Date(), submissionType: 'manual' } }
          );
        } catch (err) {
          // Rollback Redis nếu lưu DB thất bại
          await redis.srem(submittedSetKey, studentId);
          throw err;
        }
      }

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

      // Đẩy online-count ngay cho các thành viên còn lại (không đợi timer 5s)
      await emitOnlineCount(socket, eventId, grade);

      // Tăng disconnectCount trên Redis thay vì MongoDB
      const disconnectKey = `${WEEKLY_EVENT_REDIS_KEYS.DISCONNECT_COUNT(eventId)}:${studentId}`;
      await redis.incr(disconnectKey);
      // Set TTL safety net (sẽ bị xóa sau grading)
      await redis.expire(disconnectKey, WEEKLY_EVENT_DEFAULT_KEY_TTL);
    } catch (err) {
      console.error('[WeeklyEvent] Disconnect error:', err);
    }
  });
}
