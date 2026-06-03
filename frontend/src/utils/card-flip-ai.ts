// ============================================================
// Card Flip AI — có bộ nhớ giới hạn, ưu tiên ghép cặp đã biết
// ============================================================

import { BOT_CARD_FLIP_MEMORY_TURNS } from '@uniclub/shared';

interface CardFlipCard {
  id: number;
  pairId: number;
  value: string;
  flipped: boolean;
  matched: boolean;
}

/** 1 entry trong lịch sử nhớ: cardId + value + thứ tự lượt */
interface MemoryEntry {
  cardId: number;
  value: string;
  turn: number;
}

export class CardFlipAI {
  /** Bộ nhớ: value → danh sách cardId đã thấy (chưa matched) */
  private static memory = new Map<string, number[]>();

  /** Lịch sử nhớ theo thứ tự thời gian — để giới hạn số lượt */
  private static history: MemoryEntry[] = [];

  /** Số lượt đã ghi nhớ (tăng mỗi khi remember được gọi) */
  private static turnCounter = 0;

  /**
   * Lấy 2 thẻ để AI lật.
   * Chiến lược:
   *   1. Nếu biết 2 thẻ cùng value → flip cả 2 (chắc chắn match)
   *   2. Nếu biết 1 thẻ → flip nó + 1 thẻ ngẫu nhiên (cơ hội match)
   *   3. Còn không → flip 2 thẻ ngẫu nhiên
   */
  static getMove(cards: CardFlipCard[]): [number, number] | null {
    // Dọn memory: xóa các thẻ đã matched
    for (const c of cards) {
      if (c.matched) {
        const known = this.memory.get(c.value);
        if (known) {
          const filtered = known.filter((id) => id !== c.id);
          if (filtered.length === 0) {
            this.memory.delete(c.value);
          } else {
            this.memory.set(c.value, filtered);
          }
        }
      }
    }

    const unknown = cards.filter((c) => !c.matched && !c.flipped);
    if (unknown.length < 2) return null;

    // ── Priority 1: đã biết 2 thẻ cùng value → match chắc chắn ──
    for (const [value, ids] of this.memory) {
      if (ids.length >= 2) {
        const [id1, id2] = ids;
        this.memory.delete(value);
        return [id1, id2];
      }
    }

    // ── Priority 2: biết 1 thẻ → flip nó + 1 thẻ ngẫu nhiên ──
    for (const [value, ids] of this.memory) {
      if (ids.length === 1) {
        const knownId = ids[0];
        const others = unknown.filter((c) => c.id !== knownId);
        if (others.length > 0) {
          const randomOther = others[Math.floor(Math.random() * others.length)];
          this.memory.delete(value);
          return [knownId, randomOther.id];
        }
      }
    }

    // ── Priority 3: flip 2 thẻ ngẫu nhiên ──
    const shuffled = [...unknown].sort(() => Math.random() - 0.5);
    return [shuffled[0].id, shuffled[1].id];
  }

  /**
   * Ghi nhớ thẻ vừa được lật (gọi sau mỗi lần flip, kể cả của người chơi).
   * AI chỉ nhớ tối đa BOT_CARD_FLIP_MEMORY_TURNS lượt gần nhất.
   * Thẻ cũ hơn sẽ bị quên — mô phỏng trí nhớ ngắn hạn.
   */
  static remember(cardId: number, value: string): void {
    this.turnCounter++;

    const known = this.memory.get(value) ?? [];
    if (!known.includes(cardId)) {
      known.push(cardId);
      this.memory.set(value, known);
    }

    // Lưu vào history để có thể quên khi vượt giới hạn
    this.history.push({ cardId, value, turn: this.turnCounter });

    // Quên các thẻ cũ hơn BOT_CARD_FLIP_MEMORY_TURNS lượt
    // Mỗi lượt = 2 thẻ, nên giới hạn = BOT_CARD_FLIP_MEMORY_TURNS * 2 entries
    const maxEntries = BOT_CARD_FLIP_MEMORY_TURNS * 2;
    if (this.history.length > maxEntries) {
      const forgotten = this.history.splice(0, this.history.length - maxEntries);
      for (const entry of forgotten) {
        const ids = this.memory.get(entry.value);
        if (ids) {
          const filtered = ids.filter((id) => id !== entry.cardId);
          if (filtered.length === 0) {
            this.memory.delete(entry.value);
          } else {
            this.memory.set(entry.value, filtered);
          }
        }
      }
    }
  }

  /** Xóa toàn bộ bộ nhớ (gọi khi bắt đầu game mới) */
  static reset(): void {
    this.memory.clear();
    this.history = [];
    this.turnCounter = 0;
  }
}
