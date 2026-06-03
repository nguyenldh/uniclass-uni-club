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
}

export interface ResultCompareProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  outcome: ResultOutcome;
  me: ResultPlayer;
  opponent: ResultPlayer;
  /** Tổng câu trong trận. Default 10. */
  totalQuestions?: number;
  /** UniPoints đồng bộ về UniClass (= correct * UniPoint/câu). */
  uniPointsEarned: number;
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
  win:  'Phản xạ siêu tốc — quá xuất sắc!',
  lose: 'Đừng nản, lượt sau nhé!',
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
          <TrophyIcon size={44} />
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
          value={player.totalScore.toLocaleString('vi-VN')}
          better={bestScore}
        />
        <StatRow
          label="TG phản xạ đúng"
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

        <div className="st-reward">
          <div className="lab">UniPoints nhận được</div>
          <div className="pts">+{uniPointsEarned.toLocaleString('vi-VN')}</div>
        </div>

        {actions && <div className="st-result-actions">{actions}</div>}
      </div>
    </div>
  );
}
