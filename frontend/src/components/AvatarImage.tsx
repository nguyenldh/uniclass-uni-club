// ============================================================
// AvatarImage — Image with fallback to initials on error
// Sử dụng thống nhất cho toàn bộ avatar trong app.
// ============================================================

import {
  useState,
  type CSSProperties,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { getInitials } from "../utils";

export interface AvatarImageProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** URL ảnh avatar */
  src?: string;
  /** Tên đầy đủ — dùng để tạo initials khi ảnh lỗi */
  name: string;
  /** Alt text cho ảnh */
  alt?: string;
  /** Custom styles cho container */
  style?: CSSProperties;
  /** Custom class cho container */
  className?: string;
  /** Custom CSS background cho avatar — gradient, màu, ... */
  avatarBg?: string;
  /** Size preset. Default 'md'. */
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

/**
 * Avatar với fallback initials khi ảnh lỗi hoặc không có src.
 * - Có ảnh hợp lệ: render <img> fit trong container
 * - Không có ảnh / lỗi: render chữ cái initials
 * - Tự chứa container với style border-radius, background, ...
 */
export function AvatarImage({
  src,
  name,
  alt,
  style,
  className,
  avatarBg,
  size,
  ...rest
}: AvatarImageProps): ReactNode {
  const [imgError, setImgError] = useState(false);
  const showFallback = !src || imgError;

  const dim = size ? SIZE_MAP[size] : undefined;
  const initials = getInitials(name);

  const containerStyle: CSSProperties = {
    width: dim,
    height: dim,
    minWidth: dim,
    minHeight: dim,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontWeight: 700,
    fontSize: dim ? dim * 0.4 : undefined,
    textTransform: "uppercase",
    color: "#fff",
    background: avatarBg ?? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    ...style,
  };

  return (
    <div className={className} style={containerStyle} {...rest}>
      {showFallback ? (
        initials
      ) : (
        <img
          src={src}
          alt={alt || name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
