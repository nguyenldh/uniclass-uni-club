/* ============================================================
   So Tài · Versus Screen (Màn vào trận — 3 giây)
   Hai avatar trượt vào từ 2 bên, "VS" đập mạnh giữa.
   Không hiển thị rank — chỉ avatar + tên + khối.
   ============================================================ */
import React, {
  useEffect,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { AvatarImage } from '../../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface VersusFighter {
  name: ReactNode;
  /** Avatar content. Defaults to first char of name. */
  avatar?: string;
  /** Custom background for the avatar (default uses side color). */
  avatarBg?: string;
  /** Grade / class label. */
  grade?: ReactNode;
}

export interface VersusScreenProps extends HTMLAttributes<HTMLDivElement> {
  me: VersusFighter;
  opponent: VersusFighter;
  /** Total seconds before auto-progress. Default 3. Ignored if startsAt is set. */
  duration?: number;
  /** Server timestamp (ms) when game will start. If set, countdown syncs to this. */
  startsAt?: number | null;
  /** Called when countdown reaches 0. */
  onReady?: () => void;
  /** Show flash overlay when "VS" slams. Default true. */
  flash?: boolean;
  /** Hide the countdown text. */
  hideCountdown?: boolean;
}

/**
 * Versus screen — 3-second drama before gameplay starts.
 * Plays auto-countdown then fires `onReady` callback.
 * If startsAt is provided, countdown syncs to server time.
 */
export function VersusScreen({
  me,
  opponent,
  duration = 3,
  startsAt,
  onReady,
  flash = true,
  hideCountdown = false,
  className,
  ...rest
}: VersusScreenProps) {
  // Calculate initial remaining based on startsAt or duration
  const calcRemaining = () => {
    if (startsAt != null) {
      const diff = startsAt - Date.now();
      return Math.max(0, Math.ceil(diff / 1000));
    }
    return duration;
  };

  const [remaining, setRemaining] = useState(calcRemaining);
  const [waiting, setWaiting] = useState(startsAt == null);

  // When startsAt changes from null to a value, start countdown
  useEffect(() => {
    if (startsAt != null) {
      setWaiting(false);
      setRemaining(calcRemaining());
    }
  }, [startsAt]);

  useEffect(() => {
    // If waiting for opponent, don't countdown
    if (waiting) return;

    if (remaining <= 0) {
      onReady?.();
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, waiting, onReady]);

  const countdownText = waiting
    ? 'Đang chờ đối thủ...'
    : remaining > 0
      ? `Bắt đầu sau ${remaining}…`
      : 'Bắt đầu!';

  return (
    <div className={cn('st-stage', className)} {...rest}>
      {flash && <div className="st-versus-flash" aria-hidden />}
      <div className="st-versus">
        <Fighter side="me" fighter={me} />

        <div className="st-versus-center">
          <div className="st-versus-vs" aria-label="versus">VS</div>
          {!hideCountdown && (
            <div className="st-versus-countdown">
              {countdownText}
            </div>
          )}
        </div>

        <Fighter side="opp" fighter={opponent} />
      </div>
    </div>
  );
}

interface FighterProps {
  side: 'me' | 'opp';
  fighter: VersusFighter;
}

function Fighter({ side, fighter }: FighterProps) {
  const fighterName = typeof fighter.name === 'string' ? fighter.name : '?';
  return (
    <div className={cn('st-fighter', side)}>
      <AvatarImage
        src={fighter.avatar}
        name={fighterName}
        avatarBg={fighter.avatarBg}
        size="lg"
        className="av"
      />
      <div className="name">{fighter.name}</div>
      {fighter.grade && (
        <div className="meta">
          <span className="badge">{fighter.grade}</span>
        </div>
      )}
    </div>
  );
}
