// ============================================================
// MatchmakingOverlay — reusable UI for any PvP game
// ============================================================

import { type ReactNode, useEffect, useState } from 'react';
import {
  MatchmakingPanel,
  GameButton,
  WoodPanel,
  type MatchmakingPlayer,
} from '../design-system/game';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { AvatarImage } from './AvatarImage';
import type { MatchmakingGameType } from '@uniclub/shared';
import { useUser } from '../hooks';

// ============================================================
// Hướng dẫn chơi game cho từng loại game
// ============================================================
interface GameGuide {
  title: string;
  icon: string;
  rules: string[];
  tips?: string[];
}

const gameGuides: Record<MatchmakingGameType, GameGuide> = {
  gomoku: {
    title: 'Cờ Caro (Gomoku)',
    icon: '⭕',
    rules: [
      'Hai người chơi lần lượt đặt quân cờ lên bàn cờ.',
      'Ai xếp được 5 quân liên tiếp theo hàng ngang, dọc hoặc chéo sẽ thắng.',
      'Mỗi lượt có thời gian giới hạn, hết giờ sẽ mất lượt.',
    ],
    tips: [
      '💡 Cố gắng tạo "song công" - hai đầu mở cùng lúc.',
      '💡 Chặn đối thủ khi họ có 3 quân liên tiếp.',
    ],
  },
  quiz: {
    title: 'Đấu Trí (Quiz)',
    icon: '🧠',
    rules: [
      'Trả lời các câu hỏi trắc nghiệm trong thời gian giới hạn.',
      'Trả lời nhanh và đúng sẽ được nhiều điểm hơn.',
      'Sau mỗi câu, cả hai người chơi sẽ thấy kết quả.',
      'Ai có tổng điểm cao hơn khi kết thúc sẽ thắng.',
    ],
    tips: [
      '💡 Đọc kỹ câu hỏi trước khi trả lời.',
      '💡 Trả lời nhanh để nhận bonus điểm thời gian.',
    ],
  },
  "card_flip": {
    title: 'Lật Bài',
    icon: '🃏',
    rules: [
      'Tìm các cặp bài giống nhau bằng cách lật từng thẻ.',
      'Nếu 2 thẻ khớp nhau, bạn ghi điểm và tiếp tục lượt.',
      'Ai tìm được nhiều cặp hơn sẽ thắng.',
    ],
    tips: [
      '💡 Ghi nhớ vị trí các thẻ đã lật.',
      '💡 Tập trung vào từng khu vực để dễ nhớ hơn.',
    ],
  },
  quiz_arena: {
    title: 'Quiz Arena',
    icon: '⚔️',
    rules: [
      'Đấu trí trực tiếp với đối thủ qua các câu hỏi.',
      'Mỗi câu trả lời đúng sẽ tấn công đối thủ.',
      'Trả lời sai hoặc hết giờ sẽ mất lượt.',
      'Người còn máu cuối cùng sẽ thắng.',
    ],
    tips: [
      '💡 Cân nhắc kỹ trước khi trả lời.',
      '💡 Chiến thuật phòng thủ cũng quan trọng như tấn công.',
    ],
  },
};

interface GameGuideCardProps {
  gameType: MatchmakingGameType;
}

function GameGuideCard({ gameType }: GameGuideCardProps) {
  const guide = gameGuides[gameType];
  if (!guide) return null;

  return (
    <WoodPanel variant="light" studs className="game-guide-card">
      <div className="game-guide-header">
        <span className="game-guide-icon">{guide.icon}</span>
        <h3 className="game-guide-title">{guide.title}</h3>
      </div>
      
      <div className="game-guide-section">
        <h4>📋 Luật chơi</h4>
        <ul className="game-guide-rules">
          {guide.rules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      </div>

      {guide.tips && guide.tips.length > 0 && (
        <div className="game-guide-section">
          <h4>🎯 Mẹo chơi</h4>
          <ul className="game-guide-tips">
            {guide.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </WoodPanel>
  );
}

export interface MatchmakingOverlayProps {
  userId: string;
  gameType: MatchmakingGameType;
  /** Card Flip: chế độ chơi đã chọn ('basic' | 'advanced') */
  mode?: string;
  /** Tiêu đề khi đang tìm trận */
  searchingTitle?: string;
  /** Phụ đề khi đang tìm trận */
  searchingSubtitle?: string;
  /** Tiêu đề khi tìm thấy đối thủ */
  foundTitle?: string;
  /** Phụ đề khi tìm thấy đối thủ */
  foundSubtitle?: string;
  /** Tên hiển thị của người chơi hiện tại */
  playerName?: string;
  /** Callback khi người chơi muốn vào trận (sau khi matched/timeout) */
  onEnterGame: (
    sessionId: string,
    opponentId: string | null,
    isAI: boolean,
    role: 'first' | 'second',
    opponentProfile?: { name: string; avatar?: string },
  ) => void;
  /** Callback khi người chơi hủy / quay lại */
  onCancel: () => void;
  /** Slot để chèn thêm UI phía trên (vd: banner, mô tả game) */
  header?: ReactNode;
  /** Callback khi phase thay đổi */
  onPhaseChange?: (phase: 'idle' | 'searching' | 'matched' | 'timeout') => void;
  /** Tự động bắt đầu tìm trận ngay khi vào (dùng cho nút "Chơi tiếp") — bỏ qua màn hướng dẫn/chọn chế độ. */
  autoStart?: boolean;
}

export function MatchmakingOverlay({
  userId,
  gameType,
  mode,
  searchingTitle = 'Đang tìm đối thủ',
  searchingSubtitle = 'Hệ thống đang ghép trận phù hợp với bạn',
  foundTitle = 'Đã ghép được trận!',
  foundSubtitle,
  playerName = 'Bạn',
  onEnterGame,
  onCancel,
  header,
  onPhaseChange,
  autoStart = false,
}: MatchmakingOverlayProps) {
  // Card Flip: chọn chế độ chơi TRƯỚC (bước 1), xong mới hiện luật + nút tìm trận (bước 2).
  const isCardFlip = gameType === 'card_flip';
  const [selectedMode, setSelectedMode] = useState<string>(mode === 'advanced' ? 'advanced' : 'basic');
  const [modeConfirmed, setModeConfirmed] = useState<boolean>(false);

  const chooseMode = (m: string) => {
    setSelectedMode(m);
    setModeConfirmed(true);
  };
  const MODE_LABELS: Record<string, string> = { basic: '⏱️ Cơ bản', advanced: '⏳ Nâng cao' };

  const { user } = useUser();

  const { phase, secondsRemaining, totalSeconds, result, error, startMatchmaking, cancelMatchmaking } =
    useMatchmaking({
      userId,
      gameType,
      // Gửi khối lớp để server CHỈ ghép người cùng khối (không lẫn khối)
      grade: user?.grade,
      mode: isCardFlip ? selectedMode : mode,
    });

  // Expose phase cho parent
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Nút "Chơi tiếp": tự động tìm trận NGAY khi vào (bỏ màn hướng dẫn / chọn chế độ).
  // Đợi user load xong (cần grade để ghép đúng khối).
  // Cleanup hủy tìm trận đã bắt đầu → an toàn với StrictMode (setup → cleanup → setup):
  // lần setup sau sẽ khởi động lại socket + đồng hồ, tránh kẹt "đang tìm" với đồng hồ đứng.
  // Deps dùng userId (primitive ổn định) để không khởi động lại mỗi lần re-render.
  useEffect(() => {
    if (!autoStart || !user?.userId) return;
    if (isCardFlip) setModeConfirmed(true);
    startMatchmaking();
    return () => {
      cancelMatchmaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, user?.userId]);

  const me: MatchmakingPlayer = { name: playerName };
  me.avatar = user?.avatar;

  // Hiển thị opponent dựa trên opponentProfile (ẩn danh tính AI)
  const opponent: MatchmakingPlayer | undefined =
    result?.opponentProfile
      ? {
          name: result.opponentProfile.name,
          avatar: result.opponentProfile.avatar,
        }
      : result?.opponentId
        ? { name: result.opponentId }
        : undefined;

  const handleEnterGame = () => {
    if (result?.sessionId) {
      onEnterGame(
        result.sessionId,
        result.opponentId ?? null,
        result.isAI ?? false,
        result.role ?? 'first',
        result.opponentProfile,
      );
    }
  };

  return (
    <div
      className="mm-overlay-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}
    >
      {header}

      {phase === 'idle' && (
        <div
          className="mm-overlay-idle"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
            marginTop: 24,
            width: '100%',
            maxWidth: 400,
          }}
        >
          {error && <div className="error-msg">{error}</div>}

          {/* Bước 1 (chỉ Card Flip): chọn chế độ chơi trước */}
          {isCardFlip && !modeConfirmed ? (
            <div className="cf-mode-select">
              <div className="cf-mode-select-label">Chọn chế độ chơi</div>
              <div className="cf-mode-options">
                <button
                  type="button"
                  className={`cf-mode-option${selectedMode === 'basic' ? ' active' : ''}`}
                  onClick={() => chooseMode('basic')}
                >
                  <span className="cf-mode-name">⏱️ Cơ bản</span>
                  <span className="cf-mode-desc">Đồng hồ chung cho cả trận. Hết giờ, ai nhiều cặp hơn thắng.</span>
                </button>
                <button
                  type="button"
                  className={`cf-mode-option${selectedMode === 'advanced' ? ' active' : ''}`}
                  onClick={() => chooseMode('advanced')}
                >
                  <span className="cf-mode-name">⏳ Nâng cao</span>
                  <span className="cf-mode-desc">Mỗi người một quỹ giờ. Ghép đúng được cộng giờ; hết giờ thua ngay.</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Bước 2: luật chơi + nút tìm trận */}
              {isCardFlip && (
                <div className="cf-mode-chosen">
                  <span>
                    Chế độ: <strong>{MODE_LABELS[selectedMode]}</strong>
                  </span>
                  <button
                    type="button"
                    className="cf-mode-change"
                    onClick={() => setModeConfirmed(false)}
                  >
                    Đổi chế độ
                  </button>
                </div>
              )}
              <GameGuideCard gameType={gameType} />
              <div style={{ display: 'flex', gap: 12 }}>
                <GameButton className='find-game-btn' color="orange" onClick={startMatchmaking}>
                  🔍 Tìm trận
                </GameButton>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'searching' && (
        <MatchmakingPanel
          state="searching"
          me={me}
          secondsRemaining={secondsRemaining}
          totalSeconds={totalSeconds}
          searchingTitle={searchingTitle}
          searchingSubtitle={searchingSubtitle}
          actions={
            <>
              {error && <div className="error-msg">{error}</div>}
              <GameButton color="ghost" onClick={cancelMatchmaking}>
                ← Hủy tìm trận
              </GameButton>
            </>
          }
        />
      )}

      {phase === 'matched' && (
        <MatchmakingPanel
          state="found"
          me={me}
          opponent={opponent}
          foundTitle={foundTitle}
          foundSubtitle={foundSubtitle}
          actions={
            <GameButton color="orange" onClick={handleEnterGame}>
              ⚔️ Vào trận
            </GameButton>
          }
        />
      )}

      {phase === 'timeout' && (
        <MatchmakingPanel
          state="found"
          me={me}
          opponent={opponent}
          foundTitle="Đã ghép được trận!"
          foundSubtitle={foundSubtitle}
          actions={
            <>
              <GameButton color="orange" onClick={handleEnterGame}>
                ⚔️ Vào trận
              </GameButton>
            </>
          }
        />
      )}
    </div>
  );
}
