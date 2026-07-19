/* ============================================================
   So Tài · Result (Màn kết quả)
   - Side-by-side comparison: số câu đúng / điểm / thời gian phản xạ
   - Highlight winner row
   - UniPoint reward box
   - No "Hòa" — always exactly one winner per spec
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { TrophyIcon } from '../icons';
import { AvatarImage } from '../../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export type ResultOutcome = 'win' | 'lose';

export interface ResultPlayer {
  name: ReactNode;
  avatar?: string;
  avatarBg?: string;
  /** Số câu trả lời đúng (0-10). */
  correct: number;
  /** Tổng điểm trận đấu (Match Score). */
  totalScore: number;
  /** Tổng thời gian phản xạ của các câu trả lời ĐÚNG (giây). */
  correctResponseTime: number;
  /** Cúp người này THỰC SỰ nhận được (winner mới có; loser = 0). */
  cup?: number;
}

export interface ResultCompareProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  outcome: ResultOutcome;
  me: ResultPlayer;
  opponent: ResultPlayer;
  /** Tổng câu trong trận. Default 10. */
  totalQuestions?: number;
  /**
   * @deprecated Dùng `me.cup` / `opponent.cup` để hiện cúp riêng từng bên.
   * Chỉ dùng khi KHÔNG truyền cup per-player (panel cúp đơn cũ).
   */
  uniPointsEarned?: number;
  /** Hiện panel cúp đơn (cũ). Chỉ áp dụng khi không có cup per-player. */
  showReward?: boolean;
  /** Title override — default theo outcome. */
  title?: ReactNode;
  /** Subtitle override — default theo outcome. */
  subtitle?: ReactNode;
  /** Action buttons (Chơi lại / Về sảnh). */
  actions?: ReactNode;
}

const DEFAULT_TITLES: Record<ResultOutcome, string> = {
  win:  'CHIẾN THẮNG!',
  lose: 'THUA RỒI!',
};

const DEFAULT_SUBS: Record<ResultOutcome, string> = {
  win:  'Bất bại! Đối thủ phải nể bạn 🔥',
  lose: 'Chưa phục! Phục thù ngay trận sau 💪',
};

/** Format giây thành "12.3s" hoặc "1:23". */
function fmtTime(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
  }
  return `${s.toFixed(1)}s`;
}

interface StatRowProps {
  label: ReactNode;
  value: ReactNode;
  better?: boolean;
}

function StatRow({ label, value, better }: StatRowProps) {
  return (
    <div className={cn('st-cstat', better && 'is-better')}>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

interface SideProps {
  player: ResultPlayer;
  totalQuestions: number;
  isWinner: boolean;
  side: 'me' | 'opp';
  bestCorrect: boolean;
  bestScore: boolean;
  bestTime: boolean;
}

function ResultSide({
  player,
  totalQuestions,
  isWinner,
  side,
  bestCorrect,
  bestScore,
  bestTime,
}: SideProps) {
  const playerName = typeof player.name === 'string' ? player.name : '?';
  return (
    <div className={cn('st-compare-side', side, isWinner && 'is-winner')} style={{ position: 'relative' }}>
      {isWinner && (
        <span className="crown" aria-hidden>
          <TrophyIcon size={60} />
        </span>
      )}
      <AvatarImage
        src={player.avatar}
        name={playerName}
        avatarBg={player.avatarBg}
        size="lg"
        className="av"
      />
      <div className="name">{player.name}</div>

      <div className="st-compare-stats">
        <StatRow
          label="Câu đúng"
          value={
            <>
              {player.correct}
              <small>/{totalQuestions}</small>
            </>
          }
          better={bestCorrect}
        />
        <StatRow
          label="Điểm trận"
          value={player.totalScore}
          better={bestScore}
        />
        <StatRow
          label="Thời gian phản xạ đúng"
          value={fmtTime(player.correctResponseTime)}
          better={bestTime}
        />
      </div>
    </div>
  );
}

/** Màn kết quả — side-by-side so sánh 2 người. */
export function ResultCompare({
  outcome,
  me,
  opponent,
  totalQuestions = 10,
  uniPointsEarned,
  showReward = true,
  title,
  subtitle,
  actions,
  className,
  ...rest
}: ResultCompareProps) {  
  // Highlight rules: gold if this side is strictly better on that metric.
  const bestCorrectMe = me.correct > opponent.correct;
  const bestCorrectOpp = opponent.correct > me.correct;
  const bestScoreMe = me.totalScore > opponent.totalScore;
  const bestScoreOpp = opponent.totalScore > me.totalScore;
  // Lower time = better (faster reflexes on correct answers).
  // But only meaningful if you actually have correct answers.
  const bestTimeMe = me.correct > 0 && (opponent.correct === 0 || me.correctResponseTime < opponent.correctResponseTime);
  const bestTimeOpp = opponent.correct > 0 && (me.correct === 0 || opponent.correctResponseTime < me.correctResponseTime);
  // Cúp nhận riêng từng bên (winner mới có) → so sánh trực tiếp.
  const hasPerSideCup = me.cup != null || opponent.cup != null;
  const bestCupMe = (me.cup ?? 0) > (opponent.cup ?? 0);
  const bestCupOpp = (opponent.cup ?? 0) > (me.cup ?? 0);

  return (
    <div className={cn('st-stage', className)} {...rest}>
      <div className="st-sparks" aria-hidden>
        <i /><i /><i /><i /><i /><i />
      </div>

      <div className="st-result">
        <div className={cn('st-result-headline', outcome)}>
          <div className="verdict">{title ?? DEFAULT_TITLES[outcome]}</div>
          <div className="sub">{subtitle ?? DEFAULT_SUBS[outcome]}</div>
        </div>

        <div className="st-compare">
          <ResultSide
            player={me}
            totalQuestions={totalQuestions}
            isWinner={outcome === 'win'}
            side="me"
            bestCorrect={bestCorrectMe}
            bestScore={bestScoreMe}
            bestTime={bestTimeMe}
          />
          <div className="st-compare-vs" aria-hidden>
            <div className="line" />
            <span className="vs">VS</span>
            <div className="line" />
          </div>
          <ResultSide
            player={opponent}
            totalQuestions={totalQuestions}
            isWinner={outcome === 'lose'}
            side="opp"
            bestCorrect={bestCorrectOpp}
            bestScore={bestScoreOpp}
            bestTime={bestTimeOpp}
          />
        </div>

        {hasPerSideCup ? (
          <div className="st-reward-pair">
            <div className="st-reward-half">
              <div className={cn('st-reward', bestCupMe && 'is-top')}>
                <div className="lab">{me.name}</div>
                <div className="pts">+{(me.cup ?? 0).toLocaleString('vi-VN')}</div>
              </div>
            </div>
            <div className="st-reward-half">
              <div className={cn('st-reward', bestCupOpp && 'is-top')}>
                <div className="lab">{opponent.name}</div>
                <div className="pts">+{(opponent.cup ?? 0).toLocaleString('vi-VN')}</div>
              </div>
            </div>
          </div>
        ) : showReward ? (
          <div className="st-reward">
            <div className="lab">Cúp nhận được</div>
            <div className="pts">+{(uniPointsEarned ?? 0).toLocaleString('vi-VN')}</div>
          </div>
        ) : null}

        {actions && <div className="st-result-actions">{actions}</div>}
      </div>
    </div>
  );
}
