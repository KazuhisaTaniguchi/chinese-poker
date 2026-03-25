import { evaluateHand, compareHands, HAND_RANKS } from './hand.js';
import { RANK_VALUES } from './deck.js';

/**
 * トップ行 (3枚) のロイヤリティ
 */
function getTopRoyalties(cards) {
  if (cards.length < 3) return 0;
  const eval_ = evaluateHand(cards);

  if (eval_.rank === HAND_RANKS.THREE_OF_A_KIND) {
    // スリーカード: 10 + ランク値
    return 10 + eval_.values[0];
  }

  if (eval_.rank === HAND_RANKS.ONE_PAIR) {
    const pairValue = eval_.values[0];
    // 66以上がロイヤリティ対象
    if (pairValue >= 6) return pairValue - 5;
  }

  return 0;
}

/**
 * ミドル行 (5枚) のロイヤリティ
 */
function getMiddleRoyalties(cards) {
  if (cards.length < 5) return 0;
  const eval_ = evaluateHand(cards);

  const royalties = {
    [HAND_RANKS.THREE_OF_A_KIND]: 2,
    [HAND_RANKS.STRAIGHT]: 4,
    [HAND_RANKS.FLUSH]: 8,
    [HAND_RANKS.FULL_HOUSE]: 12,
    [HAND_RANKS.FOUR_OF_A_KIND]: 20,
    [HAND_RANKS.STRAIGHT_FLUSH]: 30,
    [HAND_RANKS.ROYAL_FLUSH]: 50
  };

  return royalties[eval_.rank] || 0;
}

/**
 * ボトム行 (5枚) のロイヤリティ
 */
function getBottomRoyalties(cards) {
  if (cards.length < 5) return 0;
  const eval_ = evaluateHand(cards);

  const royalties = {
    [HAND_RANKS.STRAIGHT]: 2,
    [HAND_RANKS.FLUSH]: 4,
    [HAND_RANKS.FULL_HOUSE]: 6,
    [HAND_RANKS.FOUR_OF_A_KIND]: 10,
    [HAND_RANKS.STRAIGHT_FLUSH]: 15,
    [HAND_RANKS.ROYAL_FLUSH]: 25
  };

  return royalties[eval_.rank] || 0;
}

/**
 * ロイヤリティ計算
 */
export function calculateRoyalties(board) {
  return {
    top: getTopRoyalties(board.top),
    middle: getMiddleRoyalties(board.middle),
    bottom: getBottomRoyalties(board.bottom),
    total: getTopRoyalties(board.top) + getMiddleRoyalties(board.middle) + getBottomRoyalties(board.bottom)
  };
}

/**
 * ファウル判定: Bottom ≥ Middle ≥ Top の強さ順守チェック
 */
export function checkFoul(board) {
  if (board.top.length < 3 || board.middle.length < 5 || board.bottom.length < 5) {
    return false; // 未完成ボードはファウルにしない
  }

  const topEval = evaluateHand(board.top);
  const middleEval = evaluateHand(board.middle);
  const bottomEval = evaluateHand(board.bottom);

  // Bottom ≥ Middle
  if (compareHands(bottomEval, middleEval) < 0) return true;
  // Middle ≥ Top
  if (compareHands(middleEval, topEval) < 0) return true;

  return false;
}

/**
 * 2人のプレイヤー間のスコア計算
 */
function calculateHeadToHead(player1, player2) {
  const p1Board = player1.board;
  const p2Board = player2.board;
  const p1Foul = checkFoul(p1Board);
  const p2Foul = checkFoul(p2Board);

  let p1Score = 0;
  let p2Score = 0;

  // 両方ファウルの場合は0
  if (p1Foul && p2Foul) return { p1Score: 0, p2Score: 0 };

  // 片方がファウルの場合
  if (p1Foul) {
    const p2Royalties = calculateRoyalties(p2Board);
    return { p1Score: -6 - p2Royalties.total, p2Score: 6 + p2Royalties.total };
  }
  if (p2Foul) {
    const p1Royalties = calculateRoyalties(p1Board);
    return { p1Score: 6 + p1Royalties.total, p2Score: -6 - p1Royalties.total };
  }

  // 各列の比較
  const rows = ['top', 'middle', 'bottom'];
  let p1Wins = 0;

  for (const row of rows) {
    const eval1 = evaluateHand(p1Board[row]);
    const eval2 = evaluateHand(p2Board[row]);
    const result = compareHands(eval1, eval2);

    if (result > 0) {
      p1Score += 1;
      p2Score -= 1;
      p1Wins += 1;
    } else if (result < 0) {
      p2Score += 1;
      p1Score -= 1;
    }
  }

  // スクーピングボーナス (3列全勝)
  if (p1Wins === 3) {
    p1Score += 3;
    p2Score -= 3;
  } else if (p1Wins === 0) {
    p2Score += 3;
    p1Score -= 3;
  }

  // ロイヤリティ
  const p1Royalties = calculateRoyalties(p1Board);
  const p2Royalties = calculateRoyalties(p2Board);

  p1Score += p1Royalties.total - p2Royalties.total;
  p2Score += p2Royalties.total - p1Royalties.total;

  return { p1Score, p2Score };
}

/**
 * 3人のプレイヤー間のスコア計算
 */
export function calculateScores(players) {
  const scores = players.map(() => 0);

  // 各ペアで対戦
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const { p1Score, p2Score } = calculateHeadToHead(players[i], players[j]);
      scores[i] += p1Score;
      scores[j] += p2Score;
    }
  }

  return scores;
}
