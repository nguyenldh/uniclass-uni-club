/* ============================================================
   So Tài · Result (Màn kết quả) — bố cục gọn cho mobile
   - 2 thẻ người chơi cạnh nhau: avatar + tên + cúp nhận
   - 1 bảng so sánh chung bên dưới: câu đúng (kèm thanh + chênh lệch),
     điểm trận, thời gian phản xạ
   - Luôn đúng 1 người thắng (không có "Hòa")
   ============================================================ */
import { type ReactNode, type HTMLAttributes } from 'react';
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
  /** Title override — default theo outcome. */
  title?: ReactNode;
  /** Subtitle override — default theo outcome. */
  subtitle?: ReactNode;
  /** Câu chốt dưới bảng (vd "Chiến thắng thuyết phục"). Auto theo chênh lệch nếu bỏ trống. */
  verdictNote?: ReactNode;
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

function cupText(n: number): string {
  return n > 0 ? `+${n.toLocaleString('vi-VN')}` : `${n}`;
}

interface CardProps {
  player: ResultPlayer;
  isWinner: boolean;
  side: 'me' | 'opp';
}

/** Thẻ người chơi (trên cùng): avatar + tên + cúp nhận. */
function ResultCard({ player, isWinner, side }: CardProps) {
  const playerName = typeof player.name === 'string' ? player.name : '?';
  return (
    <div className={cn('st-compare-side', side, isWinner && 'is-winner')} style={{ position: 'relative' }}>
      {isWinner && (
        <span className="crown" aria-hidden>
          <TrophyIcon size={48} />
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

      {player.cup != null && (
        <div className={cn('st-rcup', isWinner && 'is-top')}>
          <span className="ic" aria-hidden><TrophyIcon size={16} /></span>
          <span className="n">{cupText(player.cup)}</span>
          <span className="u">Cúp</span>
        </div>
      )}
    </div>
  );
}

interface ScoreRowProps {
  label: ReactNode;
  meValue: ReactNode;
  oppValue: ReactNode;
  meWin?: boolean;
  oppWin?: boolean;
  big?: boolean;
}

function ScoreRow({ label, meValue, oppValue, meWin, oppWin, big }: ScoreRowProps) {
  return (
    <div className={cn('st-scorerow', big && 'big')}>
      <span className={cn('val me', meWin && 'win')}>{meValue}</span>
      <span className="lab">{label}</span>
      <span className={cn('val opp', oppWin && 'win')}>{oppValue}</span>
    </div>
  );
}

/** Câu chốt tự động theo chênh lệch câu đúng. */
function autoVerdict(me: ResultPlayer, opponent: ResultPlayer): string {
  const d = Math.abs(me.correct - opponent.correct);
  if (d >= 3) return 'Chiến thắng thuyết phục';
  if (d >= 1) return 'Chiến thắng sít sao';
  return 'Cân tài cân sức';
}

/** Màn kết quả — 2 thẻ gọn + bảng so sánh. */
export function ResultCompare({
  outcome,
  me,
  opponent,
  title,
  subtitle,
  verdictNote,
  actions,
  className,
  ...rest
}: ResultCompareProps) {
  // Ai hơn ở từng chỉ số (tô nổi giá trị tốt hơn).
  const bestCorrectMe = me.correct > opponent.correct;
  const bestCorrectOpp = opponent.correct > me.correct;
  const bestScoreMe = me.totalScore > opponent.totalScore;
  const bestScoreOpp = opponent.totalScore > me.totalScore;
  const bestTimeMe = me.correct > 0 && (opponent.correct === 0 || me.correctResponseTime < opponent.correctResponseTime);
  const bestTimeOpp = opponent.correct > 0 && (me.correct === 0 || opponent.correctResponseTime < me.correctResponseTime);

  // Thanh câu đúng: tỉ lệ 2 bên.
  const totalCorrect = me.correct + opponent.correct;
  const mePct = totalCorrect > 0 ? (me.correct / totalCorrect) * 100 : 50;

  const correctDiff = Math.abs(me.correct - opponent.correct);
  const bothAnswered = me.correct > 0 && opponent.correct > 0;
  const timeDiff = Math.abs(me.correctResponseTime - opponent.correctResponseTime);

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

        {/* 2 thẻ người chơi cạnh nhau */}
        <div className="st-compare">
          <ResultCard player={me} isWinner={outcome === 'win'} side="me" />
          <div className="st-compare-vs" aria-hidden>
            <span className="vs">VS</span>
          </div>
          <ResultCard player={opponent} isWinner={outcome === 'lose'} side="opp" />
        </div>

        {/* Bảng so sánh chỉ số */}
        <div className="st-scoretable">
          <ScoreRow
            big
            label="Câu đúng"
            meValue={me.correct}
            oppValue={opponent.correct}
            meWin={bestCorrectMe}
            oppWin={bestCorrectOpp}
          />
          <div className="st-correctbar" aria-hidden>
            <span className="seg me" style={{ width: `${mePct}%` }} />
            <span className="seg opp" style={{ width: `${100 - mePct}%` }} />
          </div>
          {correctDiff > 0 && (
            <div className="st-scorepill">⚡ Hơn {correctDiff} câu</div>
          )}

          <ScoreRow
            label="Điểm trận"
            meValue={me.totalScore}
            oppValue={opponent.totalScore}
            meWin={bestScoreMe}
            oppWin={bestScoreOpp}
          />

          <ScoreRow
            label={
              <>
                Thời gian phản xạ
              </>
            }
            meValue={fmtTime(me.correctResponseTime)}
            oppValue={fmtTime(opponent.correctResponseTime)}
            meWin={bestTimeMe}
            oppWin={bestTimeOpp}
          />
        </div>

        <div className="st-scoreverdict">{verdictNote ?? autoVerdict(me, opponent)}</div>

        {actions && <div className="st-result-actions">{actions}</div>}
      </div>
    </div>
  );
}
