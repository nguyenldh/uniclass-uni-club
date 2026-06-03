/* ============================================================
   Game UI · Icon Set (TypeScript)
   Mount <IconSprites /> ONCE near your app root so the gradients
   and <symbol>s are defined. Then use <StarIcon />, etc.
   ============================================================ */
import React, { type SVGProps } from 'react';

/**
 * Mount once near app root. Renders an invisible SVG with all
 * <symbol> + <linearGradient> + <pattern> defs that icon components reference.
 */
export function IconSprites(): React.ReactElement {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <pattern id="rope" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#8b5826" />
          <path d="M0 3h6" stroke="#5a3414" strokeWidth="2" />
        </pattern>
        <linearGradient id="star-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff5a8" />
          <stop offset="60%" stopColor="#f6c344" />
          <stop offset="100%" stopColor="#b6892b" />
        </linearGradient>
        <linearGradient id="flame-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffed5a" />
          <stop offset="40%" stopColor="#ffb24a" />
          <stop offset="100%" stopColor="#e8530e" />
        </linearGradient>
        <linearGradient id="trophy-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7c4" />
          <stop offset="55%" stopColor="#f6c344" />
          <stop offset="100%" stopColor="#b6892b" />
        </linearGradient>

        <symbol id="icon-star" viewBox="0 0 24 24">
          <path
            d="M12 2.6l2.8 5.7 6.3.9-4.5 4.4 1.1 6.3L12 17l-5.6 2.9 1.1-6.3-4.5-4.4 6.3-.9z"
            fill="url(#star-grad)" stroke="#6e3f17" strokeWidth="1.6" strokeLinejoin="round"
          />
        </symbol>
        <symbol id="icon-coin" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" fill="url(#star-grad)" stroke="#6e3f17" strokeWidth="1.6" />
          <text x="12" y="16" textAnchor="middle" fontFamily="Nunito,sans-serif" fontWeight="900" fontSize="11" fill="#6e3f17">₫</text>
        </symbol>
        <symbol id="icon-flame" viewBox="0 0 40 50">
          <path
            d="M20 3c1 5 6 9 6 16 0 4-2 7-2 10 3-2 5-5 5-9 4 5 6 10 6 16 0 9-7 14-15 14S5 45 5 36c0-6 3-12 8-16-1 4 1 7 4 7-4-6 1-13 3-24z"
            fill="url(#flame-grad)" stroke="#6e3f17" strokeWidth="1.8" strokeLinejoin="round"
          />
          <path
            d="M20 25c2 3 4 7 4 11 0 3-2 5-5 5-3 0-5-3-5-6 0-3 3-5 6-10z"
            fill="#ffed5a" opacity=".7"
          />
        </symbol>
        <symbol id="icon-trophy" viewBox="0 0 50 50">
          <path d="M14 6h22v8c0 7-5 12-11 12S14 21 14 14V6z" fill="url(#trophy-grad)" stroke="#6e3f17" strokeWidth="2" strokeLinejoin="round" />
          <path d="M14 9H7v3c0 4 3 7 7 7" fill="none" stroke="#6e3f17" strokeWidth="2" strokeLinecap="round" />
          <path d="M36 9h7v3c0 4-3 7-7 7" fill="none" stroke="#6e3f17" strokeWidth="2" strokeLinecap="round" />
          <rect x="20" y="28" width="10" height="6" fill="#c4400b" stroke="#6e3f17" strokeWidth="2" />
          <rect x="14" y="34" width="22" height="6" rx="2" fill="#6e3f17" />
          <path d="M22 14l2 3 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" fill="#fff" opacity=".5" />
        </symbol>
        <symbol id="icon-chest" viewBox="0 0 60 50">
          <rect x="6" y="20" width="48" height="26" rx="3" fill="#a86c2d" stroke="#6e3f17" strokeWidth="2.5" />
          <path d="M6 24h48" stroke="#6e3f17" strokeWidth="2.5" />
          <path d="M30 8c-12 0-22 6-22 16h44c0-10-10-16-22-16z" fill="#d9a35b" stroke="#6e3f17" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="26" y="22" width="8" height="10" fill="#f6c344" stroke="#6e3f17" strokeWidth="2" />
          <circle cx="30" cy="26" r="1.5" fill="#6e3f17" />
        </symbol>
        <symbol id="icon-spark" viewBox="0 0 24 24">
          <path
            d="M12 2v8M12 14v8M2 12h8M14 12h8M5 5l5 5M14 14l5 5M19 5l-5 5M10 14l-5 5"
            stroke="#fff" strokeWidth="2.5" strokeLinecap="round"
          />
        </symbol>
        <symbol id="icon-send" viewBox="0 0 24 24">
          <path d="M3 11l18-7-7 18-3-8z" fill="currentColor" stroke="#6e3f17" strokeWidth="1.5" strokeLinejoin="round" />
        </symbol>
        <symbol id="icon-check" viewBox="0 0 24 24">
          <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="icon-lock" viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
          <path d="M8 11V7a4 4 0 018 0v4" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </symbol>
        <symbol id="icon-chat" viewBox="0 0 24 24">
          <path d="M4 5h16v11H10l-5 4v-4H4z" fill="currentColor" />
        </symbol>
      </defs>
    </svg>
  );
}

/** Common props for all icon components. */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  /** Pixel size (applied to both width + height). Default differs per icon. */
  size?: number;
  /** Sets CSS `color` — used by icons that paint with `currentColor`. */
  color?: string;
}

type IconComponent = React.FC<IconProps>;

function makeIcon(symbolId: string, defaultSize = 24, defaultColor?: string): IconComponent {
  const Comp: IconComponent = ({ size = defaultSize, color = defaultColor, style, ...rest }) => (
    <svg
      width={size}
      height={size}
      style={{ color, ...style }}
      aria-hidden="true"
      {...rest}
    >
      <use href={`#${symbolId}`} />
    </svg>
  );
  Comp.displayName = symbolId;
  return Comp;
}

export const StarIcon:   IconComponent = makeIcon('icon-star',   24);
export const CoinIcon:   IconComponent = makeIcon('icon-coin',   24);
export const FlameIcon:  IconComponent = makeIcon('icon-flame',  40);
export const TrophyIcon: IconComponent = makeIcon('icon-trophy', 50);
export const ChestIcon:  IconComponent = makeIcon('icon-chest',  60);
export const SparkIcon:  IconComponent = makeIcon('icon-spark',  18, '#fff');
export const SendIcon:   IconComponent = makeIcon('icon-send',   24, '#fff');
export const CheckIcon:  IconComponent = makeIcon('icon-check',  24, '#fff');
export const LockIcon:   IconComponent = makeIcon('icon-lock',   24, '#6e3f17');
export const ChatIcon:   IconComponent = makeIcon('icon-chat',   24, '#fff');
