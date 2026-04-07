import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck, dealCards, SUITS, RANKS, RANK_VALUES } from '../deck';

describe('createDeck', () => {
  it('52枚のカードを生成する', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('全スートと全ランクの組み合わせを含む', () => {
    const deck = createDeck();
    const ids = new Set(deck.map(c => c.id));
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(ids.has(`${rank}${suit}`)).toBe(true);
      }
    }
  });

  it('カードIDが一意', () => {
    const deck = createDeck();
    const ids = deck.map(c => c.id);
    expect(new Set(ids).size).toBe(52);
  });

  it('各カードにsuit/rank/idフィールドがある', () => {
    const deck = createDeck();
    for (const card of deck) {
      expect(card).toHaveProperty('suit');
      expect(card).toHaveProperty('rank');
      expect(card).toHaveProperty('id');
    }
  });

  it('idがrank+suitの形式', () => {
    const deck = createDeck();
    for (const card of deck) {
      expect(card.id).toBe(`${card.rank}${card.suit}`);
    }
  });
});

describe('shuffleDeck', () => {
  it('同じカード数を返す', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
  });

  it('同じカードセットを返す（順序は変わる可能性あり）', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const original = deck.map(c => c.id).sort();
    const shuffledSorted = shuffled.map(c => c.id).sort();
    expect(shuffledSorted).toEqual(original);
  });

  it('元のデッキを変更しない', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(original);
  });
});

describe('dealCards', () => {
  it('指定枚数のカードを配る', () => {
    const deck = createDeck();
    const { dealt } = dealCards(deck, 5);
    expect(dealt).toHaveLength(5);
  });

  it('残りデッキ枚数が正しい', () => {
    const deck = createDeck();
    const { remaining } = dealCards(deck, 5);
    expect(remaining).toHaveLength(47);
  });

  it('配ったカードと残りカードに重複なし', () => {
    const deck = createDeck();
    const { dealt, remaining } = dealCards(deck, 13);
    const dealtIds = new Set(dealt.map(c => c.id));
    const remainingIds = new Set(remaining.map(c => c.id));
    const overlap = [...dealtIds].filter(id => remainingIds.has(id));
    expect(overlap).toHaveLength(0);
  });

  it('0枚配ると全カードが残る', () => {
    const deck = createDeck();
    const { dealt, remaining } = dealCards(deck, 0);
    expect(dealt).toHaveLength(0);
    expect(remaining).toHaveLength(52);
  });
});

describe('RANK_VALUES', () => {
  it('2〜Aまでの全ランク値を持つ', () => {
    expect(RANK_VALUES['2']).toBe(2);
    expect(RANK_VALUES['10']).toBe(10);
    expect(RANK_VALUES['J']).toBe(11);
    expect(RANK_VALUES['Q']).toBe(12);
    expect(RANK_VALUES['K']).toBe(13);
    expect(RANK_VALUES['A']).toBe(14);
  });
});
