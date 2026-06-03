/* ============================================================
   So Tài · Scoreboard
   - VersusBar: 1 thanh chia 2 màu (đỏ-xanh) đẩy qua đẩy lại theo điểm
   - MatchProgress: 3/10 + pips trạng thái từng câu cho cả 2 bên
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from "react";
import { AvatarImage } from "../../components/AvatarImage";

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(" ");

export interface VersusBarPlayer {
  name: ReactNode;
  /** Avatar content. Defaults to first char of name. */
  avatar?: ReactNode;
  /** Custom CSS background for avatar — overrides side default. */
  avatarBg?: string;
  /** Current accumulated match score. */
  score: number;
  /** any additional data */
  [key: string]: any;
}

export interface VersusBarProps extends HTMLAttributes<HTMLDivElement> {
  me: VersusBarPlayer;
  opponent: VersusBarPlayer;
  /** Optional cap to clamp the bar (defaults to me.score + opponent.score or 1). */
  totalScore?: number;
}

/**
 * Top-of-screen versus bar — single track split into red (me) / blue (opp).
 * The pivot moves left/right based on score ratio.
 */
export function VersusBar({
  me,
  opponent,
  totalScore,
  className,
  ...rest
}: VersusBarProps) {
  const sum = totalScore ?? Math.max(1, me.score + opponent.score);
  const meRatio = sum > 0 ? Math.max(0, Math.min(1, me.score / sum)) : 0.5;
  // Equal scores at start → split 50/50
  const display = me.score === 0 && opponent.score === 0 ? 0.5 : meRatio;
  const mePct = display * 100;
  const oppPct = (1 - display) * 100;

  return (
    <div className={cn("st-vbar", className)} {...rest}>
      <div className="st-vbar-side me">
        <AvatarImage
          src={
            me.avatar
              ? typeof me.avatar === "string"
                ? me.avatar
                : undefined
              : undefined
          }
          name={typeof me.name === "string" ? me.name : "?"}
          avatarBg={me.avatarBg}
          size="sm"
          className="st-vbar-av me"
        />
        <div className="st-vbar-info">
          <div className="nm">{me.name}</div>
          <div className="sc">{me.score.toLocaleString("vi-VN")}</div>
        </div>
      </div>

      <div
        className="st-vbar-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(mePct)}
      >
        <div className="st-vbar-fill me" style={{ width: `${mePct}%` }} />
        <div className="st-vbar-fill opp" style={{ width: `${oppPct}%` }} />
        <div
          className="st-vbar-pivot"
          style={{ left: `calc(${mePct}% - 2px)` }}
        />
      </div>

      <div className="st-vbar-side opp">
        <AvatarImage
          src={
            opponent.avatar
              ? typeof opponent.avatar === "string"
                ? opponent.avatar
                : undefined
              : undefined
          }
          name={typeof opponent.name === "string" ? opponent.name : "?"}
          avatarBg={opponent.avatarBg}
          size="sm"
          className="st-vbar-av opp"
        />
        <div className="st-vbar-info">
          <div className="nm">{opponent.name}</div>
          <div className="sc">{opponent.score.toLocaleString("vi-VN")}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Match progress
   ============================================================ */

/** Trạng thái 1 câu của 1 người chơi. */
export type ProgressPip = "pending" | "current" | "correct" | "wrong";

export interface MatchProgressProps {
  /** Số câu hiện tại (1-indexed). */
  current: number;
  /** Tổng số câu. */
  total: number;
  /** Tuỳ chọn — kết quả của tôi cho từng câu (length = total). */
  mePips?: ReadonlyArray<ProgressPip>;
  /** Tuỳ chọn — kết quả của đối thủ. */
  opponentPips?: ReadonlyArray<ProgressPip>;
}

/** "Câu 3/10" + 2 hàng pips cho 2 người chơi. */
export function MatchProgress({ current, total, mePips }: MatchProgressProps) {
  // Render chỉ 1 hàng pips (của mình), đặt ở giữa
  const arr =
    mePips ??
    Array.from(
      { length: total },
      (_, i): ProgressPip =>
        i + 1 < current ? "correct" : i + 1 === current ? "current" : "pending",
    );

  return (
    <div className="st-progress" role="status">
      <div
        className={cn("st-progress-pips", "me")}
        aria-hidden
        style={{ justifyContent: "center" }}
      >
        {arr.slice(0, total).map((p, i) => (
          <span
            key={i}
            className={cn(
              "pip",
              p === "correct" && "pip-correct",
              p === "wrong" && "pip-wrong",
              p === "current" && "pip-current"
            )}
          />
        ))}
      </div>
      <div className="st-progress-counter" style={{ marginTop: 4 }}>
        Câu <span className="big">{current}</span>/{total}
      </div>
    </div>
  );
}
