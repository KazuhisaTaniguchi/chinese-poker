import { describe, it, expect } from 'vitest';
import { calculateRoyalties, checkFoul, calculateScores } from '../scoring';

// ヘルパー
const c = (rank: string, suit = '♠') => ({ rank, suit, id: `${rank}${suit}` });

const board = (top: any[], middle: any[], bottom: any[]) => ({ top, middle, bottom });

// テスト用の定形ボード
const BOARD_VALID_LOW = board(
  [c('A', '♥'), c('K', '♦'), c('Q', '♣')],
  [c('3', '♥'), c('3', '♦'), c('4', '♠'), c('5', '♣'), c('6', '♠')],
  [c('2', '♥'), c('3', '♠'), c('4', '♦'), c('5', '♠'), c('6', '♦')],   // straight
);

const BOARD_VALID_HIGH = board(
  [c('Q', '♥'), c('Q', '♦'), c('K', '♣')],          // QQ pair → royalty 7
  [c('A', '♦'), c('K', '♦'), c('J', '♦'), c('9', '♦'), c('7', '♦')],  // flush → royalty 8
  [c('5', '♦'), c('6', '♦'), c('7', '♦'), c('8', '♦'), c('9', '♦')],   // SF → royalty 15
);

const BOARD_FOUL = board(
  [c('A', '♦'), c('K', '♦'), c('Q', '♦')],
  [c('9', '♦'), c('9', '♥'), c('9', '♠'), c('9', '♣'), c('8', '♠')],  // quads (rank 7)
  [c('2', '♣'), c('3', '♣'), c('5', '♣'), c('7', '♣'), c('J', '♠')],   // high card (rank 0)
);

describe('calculateRoyalties', () => {
  it('トップ: ハイカードはロイヤリティ0', () => {
    const b = board([c('A'), c('K', '♥'), c('Q', '♦')], [], []);
    const r = calculateRoyalties(b);
    expect(r.top).toBe(0);
  });

  it('トップ: ペア55はロイヤリティ0', () => {
    const b = board([c('5'), c('5', '♥'), c('A', '♦')], [], []);
    expect(calculateRoyalties(b).top).toBe(0);
  });

  it('トップ: ペア66はロイヤリティ1', () => {
    const b = board([c('6'), c('6', '♥'), c('A', '♦')], [], []);
    expect(calculateRoyalties(b).top).toBe(1);
  });

  it('トップ: ペアAAはロイヤリティ9', () => {
    const b = board([c('A'), c('A', '♥'), c('K', '♦')], [], []);
    expect(calculateRoyalties(b).top).toBe(9);
  });

  it('トップ: トリップスAAはロイヤリティ24', () => {
    const b = board([c('A'), c('A', '♥'), c('A', '♦')], [], []);
    expect(calculateRoyalties(b).top).toBe(24);
  });

  it('ミドル: ペアはロイヤリティ0', () => {
    const b = board([], [c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')], []);
    expect(calculateRoyalties(b).middle).toBe(0);
  });

  it('ミドル: トリップスはロイヤリティ2', () => {
    const b = board([], [c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')], []);
    expect(calculateRoyalties(b).middle).toBe(2);
  });

  it('ミドル: フラッシュはロイヤリティ8', () => {
    const b = board([], [c('A'), c('K'), c('J'), c('9'), c('7')], []);
    expect(calculateRoyalties(b).middle).toBe(8);
  });

  it('ミドル: ロイヤルフラッシュはロイヤリティ50', () => {
    const b = board([], [c('10'), c('J'), c('Q'), c('K'), c('A')], []);
    expect(calculateRoyalties(b).middle).toBe(50);
  });

  it('ボトム: ペアはロイヤリティ0', () => {
    const b = board([], [], [c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')]);
    expect(calculateRoyalties(b).bottom).toBe(0);
  });

  it('ボトム: トリップスはロイヤリティ0', () => {
    const b = board([], [], [c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')]);
    expect(calculateRoyalties(b).bottom).toBe(0);
  });

  it('ボトム: ストレートはロイヤリティ2', () => {
    const b = board([], [], [c('5'), c('6', '♥'), c('7', '♦'), c('8', '♣'), c('9', '♠')]);
    expect(calculateRoyalties(b).bottom).toBe(2);
  });

  it('ボトム: ロイヤルフラッシュはロイヤリティ25', () => {
    const b = board([], [], [c('10'), c('J'), c('Q'), c('K'), c('A')]);
    expect(calculateRoyalties(b).bottom).toBe(25);
  });

  it('合計ロイヤリティが正しい', () => {
    // top: trips A=24, middle: quads K=20, bottom: royal flush=25
    const b = board(
      [c('A'), c('A', '♥'), c('A', '♦')],
      [c('K'), c('K', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')],
      [c('10'), c('J'), c('Q'), c('K'), c('A')],
    );
    const r = calculateRoyalties(b);
    expect(r.top).toBe(24);
    expect(r.middle).toBe(20);
    expect(r.bottom).toBe(25);
    expect(r.total).toBe(69);
  });
});

describe('checkFoul', () => {
  it('有効なボードはファウルなし', () => {
    expect(checkFoul(BOARD_VALID_LOW)).toBe(false);
  });

  it('ボトム < ミドルでファウル', () => {
    expect(checkFoul(BOARD_FOUL)).toBe(true);
  });

  it('ミドル < トップでファウル', () => {
    const foul = board(
      [c('A'), c('A', '♥'), c('A', '♦')],             // trips → rank 3
      [c('2'), c('3', '♥'), c('4', '♦'), c('5', '♣'), c('7', '♠')], // high card → rank 0
      [c('9'), c('9', '♥'), c('9', '♦'), c('9', '♣'), c('8', '♠')], // quads → rank 7
    );
    expect(checkFoul(foul)).toBe(true);
  });

  it('未完成ボードはファウルなし', () => {
    const incomplete = board([c('A'), c('K', '♥')], [], []);
    expect(checkFoul(incomplete)).toBe(false);
  });
});

describe('calculateScores', () => {
  it('スコア合計は常に0 (ゼロサム)', () => {
    const players = [
      { board: BOARD_VALID_HIGH },
      { board: BOARD_VALID_LOW },
    ];
    const scores = calculateScores(players);
    expect(scores.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('強いボードが高スコアを得る', () => {
    const players = [
      { board: BOARD_VALID_HIGH },
      { board: BOARD_VALID_LOW },
    ];
    const scores = calculateScores(players);
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  it('ファウルプレイヤーは負スコア', () => {
    const players = [
      { board: BOARD_VALID_LOW },
      { board: BOARD_FOUL },
    ];
    const scores = calculateScores(players);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBeLessThan(0);
  });

  it('3人戦でもゼロサム', () => {
    const players = [
      { board: BOARD_VALID_HIGH },
      { board: BOARD_VALID_LOW },
      { board: BOARD_FOUL },
    ];
    const scores = calculateScores(players);
    expect(scores.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
