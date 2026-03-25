import { RANK_VALUES } from './deck.js';

// ハンドランク定数
export const HAND_RANKS = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9
};

export const HAND_NAMES = {
  [HAND_RANKS.HIGH_CARD]: 'ハイカード',
  [HAND_RANKS.ONE_PAIR]: 'ワンペア',
  [HAND_RANKS.TWO_PAIR]: 'ツーペア',
  [HAND_RANKS.THREE_OF_A_KIND]: 'スリーカード',
  [HAND_RANKS.STRAIGHT]: 'ストレート',
  [HAND_RANKS.FLUSH]: 'フラッシュ',
  [HAND_RANKS.FULL_HOUSE]: 'フルハウス',
  [HAND_RANKS.FOUR_OF_A_KIND]: 'フォーカード',
  [HAND_RANKS.STRAIGHT_FLUSH]: 'ストレートフラッシュ',
  [HAND_RANKS.ROYAL_FLUSH]: 'ロイヤルフラッシュ'
};

/**
 * カードの数値を取得
 */
function getRankValue(rank) {
  return RANK_VALUES[rank];
}

/**
 * カード配列をランク値でソート (降順)
 */
function sortByRank(cards) {
  return [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
}

/**
 * ランクごとのグループ分け
 */
function groupByRank(cards) {
  const groups = {};
  for (const card of cards) {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank].push(card);
  }
  return groups;
}

/**
 * フラッシュ判定
 */
function isFlush(cards) {
  if (cards.length < 3) return false;
  return cards.every(c => c.suit === cards[0].suit);
}

/**
 * ストレート判定
 */
function isStraight(cards) {
  if (cards.length < 3) return false;
  const values = sortByRank(cards).map(c => getRankValue(c.rank));

  // A-2-3-4-5 (ホイール) の特殊ケース
  if (cards.length === 5) {
    const wheelValues = [14, 5, 4, 3, 2];
    if (JSON.stringify(values) === JSON.stringify(wheelValues)) return true;
  }

  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) return false;
  }
  return true;
}

/**
 * ハンドを評価 (3枚のトップ行にも対応)
 */
export function evaluateHand(cards) {
  if (!cards || cards.length === 0) return { rank: HAND_RANKS.HIGH_CARD, values: [], kickers: [] };

  const sorted = sortByRank(cards);
  const groups = groupByRank(cards);
  const groupSizes = Object.values(groups).map(g => g.length).sort((a, b) => b - a);
  const flush = isFlush(cards);
  const straight = isStraight(cards);

  // ランク値のソート済み配列
  let values = sorted.map(c => getRankValue(c.rank));

  // ホイールストレートの場合、Aを1として扱う
  if (straight && values[0] === 14 && values[values.length - 1] === 2 && cards.length === 5) {
    values = [5, 4, 3, 2, 1];
  }

  // 5枚の場合のみストレート/フラッシュ系を判定
  if (cards.length === 5) {
    if (straight && flush) {
      if (values[0] === 14 && values[1] === 13) {
        return { rank: HAND_RANKS.ROYAL_FLUSH, values, kickers: [] };
      }
      return { rank: HAND_RANKS.STRAIGHT_FLUSH, values, kickers: [] };
    }
    if (flush) return { rank: HAND_RANKS.FLUSH, values, kickers: [] };
    if (straight) return { rank: HAND_RANKS.STRAIGHT, values, kickers: [] };
  }

  // ペア系の判定 (3枚でも5枚でも)
  if (groupSizes[0] === 4) {
    const quadRank = Object.keys(groups).find(r => groups[r].length === 4);
    const kicker = sorted.filter(c => c.rank !== quadRank).map(c => getRankValue(c.rank));
    return { rank: HAND_RANKS.FOUR_OF_A_KIND, values: [getRankValue(quadRank)], kickers: kicker };
  }

  if (groupSizes[0] === 3 && groupSizes[1] === 2) {
    const tripleRank = Object.keys(groups).find(r => groups[r].length === 3);
    const pairRank = Object.keys(groups).find(r => groups[r].length === 2);
    return { rank: HAND_RANKS.FULL_HOUSE, values: [getRankValue(tripleRank), getRankValue(pairRank)], kickers: [] };
  }

  if (groupSizes[0] === 3) {
    const tripleRank = Object.keys(groups).find(r => groups[r].length === 3);
    const kickers = sorted.filter(c => c.rank !== tripleRank).map(c => getRankValue(c.rank));
    return { rank: HAND_RANKS.THREE_OF_A_KIND, values: [getRankValue(tripleRank)], kickers };
  }

  if (groupSizes[0] === 2 && groupSizes[1] === 2) {
    const pairRanks = Object.keys(groups)
      .filter(r => groups[r].length === 2)
      .map(r => getRankValue(r))
      .sort((a, b) => b - a);
    const kicker = sorted.filter(c => !pairRanks.includes(getRankValue(c.rank))).map(c => getRankValue(c.rank));
    return { rank: HAND_RANKS.TWO_PAIR, values: pairRanks, kickers: kicker };
  }

  if (groupSizes[0] === 2) {
    const pairRank = Object.keys(groups).find(r => groups[r].length === 2);
    const kickers = sorted.filter(c => c.rank !== pairRank).map(c => getRankValue(c.rank));
    return { rank: HAND_RANKS.ONE_PAIR, values: [getRankValue(pairRank)], kickers };
  }

  return { rank: HAND_RANKS.HIGH_CARD, values, kickers: [] };
}

/**
 * 2つのハンド評価を比較
 * @returns 正: hand1の勝ち、負: hand2の勝ち、0: 引き分け
 */
export function compareHands(eval1, eval2) {
  if (eval1.rank !== eval2.rank) return eval1.rank - eval2.rank;

  // 同じランクの場合、値で比較
  for (let i = 0; i < Math.max(eval1.values.length, eval2.values.length); i++) {
    const v1 = eval1.values[i] || 0;
    const v2 = eval2.values[i] || 0;
    if (v1 !== v2) return v1 - v2;
  }

  // キッカーで比較
  for (let i = 0; i < Math.max(eval1.kickers.length, eval2.kickers.length); i++) {
    const k1 = eval1.kickers[i] || 0;
    const k2 = eval2.kickers[i] || 0;
    if (k1 !== k2) return k1 - k2;
  }

  return 0;
}

/**
 * 役名を取得
 */
export function getHandName(evaluation) {
  return HAND_NAMES[evaluation.rank] || 'ハイカード';
}
