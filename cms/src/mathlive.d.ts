import type { MathfieldElement } from 'mathlive';
import type { DetailedHTMLProps, HTMLAttributes, Ref } from 'react';

// MathLive không khai báo sẵn intrinsic element cho JSX → khai báo thủ công
// để dùng <math-field> trong TSX (chỉ cần ref + các HTML attribute cơ bản).
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': DetailedHTMLProps<HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        ref?: Ref<MathfieldElement>;
      };
    }
  }
}
