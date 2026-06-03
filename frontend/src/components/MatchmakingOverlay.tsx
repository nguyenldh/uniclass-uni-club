// ============================================================
// MatchmakingOverlay — reusable UI for any PvP game
// ============================================================

import { type ReactNode, useEffect } from 'react';
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
      'Người chơi đầu tiên dùng quân X, người thứ hai dùng quân O.',
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
      'Mỗi lượt được lật 2 thẻ để tìm cặp.',
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
}

export function MatchmakingOverlay({
  userId,
  gameType,
  searchingTitle = 'Đang tìm đối thủ',
  searchingSubtitle = 'Hệ thống đang ghép trận phù hợp với bạn',
  foundTitle = 'Đã ghép được trận!',
  foundSubtitle,
  playerName = 'Bạn',
  onEnterGame,
  onCancel,
  header,
  onPhaseChange,
}: MatchmakingOverlayProps) {
  const { phase, secondsRemaining, totalSeconds, result, error, startMatchmaking, cancelMatchmaking } =
    useMatchmaking({ userId, gameType });

  // Expose phase cho parent
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const me: MatchmakingPlayer = { name: playerName };
  const {user} = useUser();
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
          <GameGuideCard gameType={gameType} />
          <div style={{ display: 'flex', gap: 12 }}>
            <GameButton className='find-game-btn' color="orange" onClick={startMatchmaking}>
              🔍 Tìm trận
            </GameButton>
          </div>
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
