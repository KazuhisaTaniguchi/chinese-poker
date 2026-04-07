import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHands, getHandName, HAND_RANKS, HAND_NAMES } from '../hand';

// ヘルパー: カード生成
const c = (rank: string, suit = '♠') => ({ rank, suit, id: `${rank}${suit}` });

describe('evaluateHand - 3枚 (トップ行)', () => {
  it('ハイカード', () => {
    const result = evaluateHand([c('A'), c('K', '♥'), c('J', '♦')]);
    expect(result.rank).toBe(HAND_RANKS.HIGH_CARD);
  });

  it('ワンペア', () => {
    const result = evaluateHand([c('A'), c('A', '♥'), c('K', '♦')]);
    expect(result.rank).toBe(HAND_RANKS.ONE_PAIR);
    expect(result.values).toEqual([14]);
  });

  it('スリーカード', () => {
    const result = evaluateHand([c('A'), c('A', '♥'), c('A', '♦')]);
    expect(result.rank).toBe(HAND_RANKS.THREE_OF_A_KIND);
    expect(result.values).toEqual([14]);
  });

  it('3枚ではストレートにならない', () => {
    const result = evaluateHand([c('5'), c('6', '♥'), c('7', '♦')]);
    expect(result.rank).not.toBe(HAND_RANKS.STRAIGHT);
  });

  it('3枚ではフラッシュにならない', () => {
    const result = evaluateHand([c('A'), c('K'), c('J')]);
    expect(result.rank).not.toBe(HAND_RANKS.FLUSH);
  });
});

describe('evaluateHand - 5枚', () => {
  it('ハイカード', () => {
    const result = evaluateHand([c('A'), c('K', '♥'), c('J', '♦'), c('9', '♣'), c('7', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.HIGH_CARD);
  });

  it('ワンペア', () => {
    const result = evaluateHand([c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.ONE_PAIR);
    expect(result.values).toEqual([14]);
  });

  it('ツーペア', () => {
    const result = evaluateHand([c('A'), c('A', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.TWO_PAIR);
    expect(result.values).toEqual([14, 13]);
  });

  it('スリーカード', () => {
    const result = evaluateHand([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.THREE_OF_A_KIND);
  });

  it('ストレート', () => {
    const result = evaluateHand([c('5'), c('6', '♥'), c('7', '♦'), c('8', '♣'), c('9', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.STRAIGHT);
  });

  it('ホイールストレート (A-2-3-4-5)', () => {
    const result = evaluateHand([c('A'), c('2', '♥'), c('3', '♦'), c('4', '♣'), c('5', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.STRAIGHT);
    expect(result.values).toEqual([5, 4, 3, 2, 1]);
  });

  it('フラッシュ', () => {
    const result = evaluateHand([c('A'), c('K'), c('J'), c('9'), c('7')]);
    expect(result.rank).toBe(HAND_RANKS.FLUSH);
  });

  it('フルハウス', () => {
    const result = evaluateHand([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('K', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.FULL_HOUSE);
    expect(result.values).toEqual([14, 13]);
  });

  it('フォーカード', () => {
    const result = evaluateHand([c('A'), c('A', '♥'), c('A', '♦'), c('A', '♣'), c('K', '♠')]);
    expect(result.rank).toBe(HAND_RANKS.FOUR_OF_A_KIND);
    expect(result.values).toEqual([14]);
  });

  it('ストレートフラッシュ', () => {
    const result = evaluateHand([c('5'), c('6'), c('7'), c('8'), c('9')]);
    expect(result.rank).toBe(HAND_RANKS.STRAIGHT_FLUSH);
  });

  it('ロイヤルフラッシュ', () => {
    const result = evaluateHand([c('10'), c('J'), c('Q'), c('K'), c('A')]);
    expect(result.rank).toBe(HAND_RANKS.ROYAL_FLUSH);
  });

  it('空配列は HIGH_CARD を返す', () => {
    const result = evaluateHand([]);
    expect(result.rank).toBe(HAND_RANKS.HIGH_CARD);
  });
});

describe('compareHands', () => {
  it('上位ランクが勝つ', () => {
    const flush = evaluateHand([c('A'), c('K'), c('J'), c('9'), c('7')]);
    const straight = evaluateHand([c('5'), c('6', '♥'), c('7', '♦'), c('8', '♣'), c('9', '♠')]);
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
  });

  it('同ランクは高い値が勝つ', () => {
    const pairA = evaluateHand([c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')]);
    const pairK = evaluateHand([c('K'), c('K', '♥'), c('A', '♦'), c('Q', '♣'), c('J', '♠')]);
    expect(compareHands(pairA, pairK)).toBeGreaterThan(0);
  });

  it('同ペアはキッカーで決まる', () => {
    const pairAK = evaluateHand([c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')]);
    const pairAQ = evaluateHand([c('A'), c('A', '♥'), c('Q', '♦'), c('J', '♣'), c('9', '♠')]);
    expect(compareHands(pairAK, pairAQ)).toBeGreaterThan(0);
  });

  it('同一ハンドは引き分け', () => {
    const hand1 = evaluateHand([c('A'), c('K', '♥'), c('J', '♦'), c('9', '♣'), c('7', '♠')]);
    const hand2 = evaluateHand([c('A', '♥'), c('K', '♦'), c('J', '♣'), c('9', '♠'), c('7', '♥')]);
    expect(compareHands(hand1, hand2)).toBe(0);
  });

  it('負けるハンドは負の値を返す', () => {
    const trips = evaluateHand([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')]);
    const twoPair = evaluateHand([c('A'), c('A', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')]);
    expect(compareHands(twoPair, trips)).toBeLessThan(0);
  });
});

describe('getHandName', () => {
  const cases: [number, string][] = [
    [HAND_RANKS.HIGH_CARD, 'ハイカード'],
    [HAND_RANKS.ONE_PAIR, 'ワンペア'],
    [HAND_RANKS.TWO_PAIR, 'ツーペア'],
    [HAND_RANKS.THREE_OF_A_KIND, 'スリーカード'],
    [HAND_RANKS.STRAIGHT, 'ストレート'],
    [HAND_RANKS.FLUSH, 'フラッシュ'],
    [HAND_RANKS.FULL_HOUSE, 'フルハウス'],
    [HAND_RANKS.FOUR_OF_A_KIND, 'フォーカード'],
    [HAND_RANKS.STRAIGHT_FLUSH, 'ストレートフラッシュ'],
    [HAND_RANKS.ROYAL_FLUSH, 'ロイヤルフラッシュ'],
  ];

  it.each(cases)('rank %i → %s', (rank, expected) => {
    const result = getHandName({ rank, values: [], kickers: [] });
    expect(result).toBe(expected);
  });
});
