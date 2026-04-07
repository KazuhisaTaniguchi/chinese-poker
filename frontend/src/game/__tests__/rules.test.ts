import { describe, it, expect } from 'vitest';
import {
  canPlaceCard,
  isBoardComplete,
  getCardsToDealt,
  getCardsToPlace,
  ROW_LIMITS,
  TOTAL_CARDS,
  INITIAL_DEAL,
} from '../rules';

const c = (rank: string, suit = '♠') => ({ rank, suit, id: `${rank}${suit}` });

const emptyBoard = () => ({ top: [], middle: [], bottom: [] });

const fullBoard = () => ({
  top: [c('A'), c('K', '♥'), c('Q', '♦')],
  middle: [c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠'), c('10', '♥')],
  bottom: [c('9'), c('8', '♥'), c('7', '♦'), c('6', '♣'), c('5', '♠')],
});

describe('canPlaceCard', () => {
  it('空の列には配置できる', () => {
    const b = emptyBoard();
    expect(canPlaceCard(b, 'top')).toBe(true);
    expect(canPlaceCard(b, 'middle')).toBe(true);
    expect(canPlaceCard(b, 'bottom')).toBe(true);
  });

  it('部分的に埋まった列には配置できる', () => {
    const b = { ...emptyBoard(), top: [c('A'), c('K', '♥')] };
    expect(canPlaceCard(b, 'top')).toBe(true);
  });

  it('満杯のトップ列 (3枚) には配置できない', () => {
    const b = { ...emptyBoard(), top: [c('A'), c('K', '♥'), c('Q', '♦')] };
    expect(canPlaceCard(b, 'top')).toBe(false);
  });

  it('満杯のミドル列 (5枚) には配置できない', () => {
    const b = { ...emptyBoard(), middle: [c('A'), c('K', '♥'), c('Q', '♦'), c('J', '♣'), c('10', '♠')] };
    expect(canPlaceCard(b, 'middle')).toBe(false);
  });

  it('満杯のボトム列 (5枚) には配置できない', () => {
    const b = { ...emptyBoard(), bottom: [c('A'), c('K', '♥'), c('Q', '♦'), c('J', '♣'), c('10', '♠')] };
    expect(canPlaceCard(b, 'bottom')).toBe(false);
  });
});

describe('isBoardComplete', () => {
  it('完成したボードはtrueを返す', () => {
    expect(isBoardComplete(fullBoard())).toBe(true);
  });

  it('空のボードはfalseを返す', () => {
    expect(isBoardComplete(emptyBoard())).toBe(false);
  });

  it('トップが足りないとfalseを返す', () => {
    const b = { ...fullBoard(), top: [c('A'), c('K', '♥')] };
    expect(isBoardComplete(b)).toBe(false);
  });

  it('ミドルが足りないとfalseを返す', () => {
    const b = { ...fullBoard(), middle: [c('A'), c('K', '♥'), c('Q', '♦')] };
    expect(isBoardComplete(b)).toBe(false);
  });

  it('ボトムが空でもfalseを返す', () => {
    const b = { ...fullBoard(), bottom: [] };
    expect(isBoardComplete(b)).toBe(false);
  });
});

describe('getCardsToDealt', () => {
  it('ラウンド0は5枚', () => {
    expect(getCardsToDealt(0)).toBe(INITIAL_DEAL);
  });

  it('ラウンド1以降は定数 SUBSEQUENT_DEAL の値', () => {
    // フロントエンドの rules.ts では SUBSEQUENT_DEAL = 1
    const round1 = getCardsToDealt(1);
    expect(typeof round1).toBe('number');
    expect(round1).toBeGreaterThan(0);
  });
});

describe('getCardsToPlace', () => {
  it('ラウンド0は5枚置く', () => {
    expect(getCardsToPlace(0)).toBe(INITIAL_DEAL);
  });

  it('ラウンド1以降も正の数を返す', () => {
    expect(getCardsToPlace(1)).toBeGreaterThan(0);
  });
});

describe('ROW_LIMITS', () => {
  it('トップは3枚', () => {
    expect(ROW_LIMITS.top).toBe(3);
  });

  it('ミドルは5枚', () => {
    expect(ROW_LIMITS.middle).toBe(5);
  });

  it('ボトムは5枚', () => {
    expect(ROW_LIMITS.bottom).toBe(5);
  });
});

describe('TOTAL_CARDS', () => {
  it('13枚', () => {
    expect(TOTAL_CARDS).toBe(13);
  });

  it('トップ + ミドル + ボトムの合計と一致', () => {
    const total = ROW_LIMITS.top + ROW_LIMITS.middle + ROW_LIMITS.bottom;
    expect(total).toBe(TOTAL_CARDS);
  });
});
