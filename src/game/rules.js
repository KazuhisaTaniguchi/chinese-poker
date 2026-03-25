// OFC ルール定数

// ボードの各列のカード数上限
export const ROW_LIMITS = {
  top: 3,
  middle: 5,
  bottom: 5
};

// 合計カード数
export const TOTAL_CARDS = 13;

// 初回配布枚数
export const INITIAL_DEAL = 5;

// 以降の配布枚数
export const SUBSEQUENT_DEAL = 1;

// ラウンド数 (初回5枚 + 残り8枚 = 8ラウンド)
export const TOTAL_ROUNDS = 9; // 初回 + 8ラウンド

// プレイヤー数
export const NUM_PLAYERS = 3;

/**
 * 指定の列にカードを配置できるか検証
 */
export function canPlaceCard(board, row) {
  return board[row].length < ROW_LIMITS[row];
}

/**
 * ボードが完成しているか
 */
export function isBoardComplete(board) {
  return (
    board.top.length === ROW_LIMITS.top &&
    board.middle.length === ROW_LIMITS.middle &&
    board.bottom.length === ROW_LIMITS.bottom
  );
}

/**
 * 現在のラウンドで配る枚数を返す
 */
export function getCardsToDealt(roundNumber) {
  return roundNumber === 0 ? INITIAL_DEAL : SUBSEQUENT_DEAL;
}

/**
 * 現在のラウンドで配置すべき枚数を返す
 */
export function getCardsToPlace(roundNumber) {
  return roundNumber === 0 ? INITIAL_DEAL : SUBSEQUENT_DEAL;
}
