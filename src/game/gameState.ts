import { createDeck, shuffleDeck, dealCards } from './deck';
import { calculateScores, checkFoul, calculateRoyalties } from './scoring';
import { canPlaceCard, isBoardComplete, getCardsToDealt, TOTAL_CARDS, NUM_PLAYERS } from './rules';

/**
 * ゲームフェーズ
 */
export const PHASES = {
  TITLE: 'title',
  SETUP: 'setup',
  DEALING: 'dealing',       // カード配布中
  PLACING: 'placing',       // カード配置中
  TURN_SWITCH: 'turn_switch', // ターン切替画面
  ROUND_RESULT: 'round_result', // ラウンド結果表示
  GAME_OVER: 'game_over'    // ゲーム終了
};

/**
 * 空のボードを生成
 */
function createEmptyBoard() {
  return { top: [], middle: [], bottom: [] };
}

/**
 * 初期ゲームステートを生成
 */
export function createInitialState(playerNames) {
  return {
    players: playerNames.map((name, index) => ({
      id: index,
      name,
      board: createEmptyBoard(),
      hand: [],
      totalScore: 0
    })),
    deck: [],
    currentPlayerIndex: 0,
    roundNumber: 0,       // 各ラウンド内のターン番号 (0=初回5枚)
    gameRound: 1,         // ゲーム全体のラウンド数
    phase: PHASES.TITLE,
    selectedCard: null,
    roundScores: [],
    dealerIndex: 0
  };
}

/**
 * 新しいラウンドを開始 (デッキをシャッフルして最初のカードを配る)
 */
export function startNewRound(state) {
  const deck = shuffleDeck(createDeck());

  const players = state.players.map(p => ({
    ...p,
    board: createEmptyBoard(),
    hand: []
  }));

  // 各プレイヤーに5枚ずつ配布
  let remainingDeck = deck;
  for (let i = 0; i < NUM_PLAYERS; i++) {
    const { dealt, remaining } = dealCards(remainingDeck, 5);
    players[i].hand = dealt;
    remainingDeck = remaining;
  }

  return {
    ...state,
    players,
    deck: remainingDeck,
    currentPlayerIndex: state.dealerIndex,
    roundNumber: 0,
    phase: PHASES.PLACING,
    selectedCard: null,
    roundScores: []
  };
}

/**
 * カードを選択
 */
export function selectCard(state, cardId) {
  const card = state.players[state.currentPlayerIndex].hand.find(c => c.id === cardId);
  if (!card) return state;

  return {
    ...state,
    selectedCard: state.selectedCard?.id === cardId ? null : card
  };
}

/**
 * カードをボードに配置
 */
export function placeCard(state, row) {
  if (!state.selectedCard) return state;
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];

  if (!canPlaceCard(player.board, row)) return state;

  const newBoard = {
    ...player.board,
    [row]: [...player.board[row], state.selectedCard]
  };

  const newHand = player.hand.filter(c => c.id !== state.selectedCard.id);

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = {
    ...player,
    board: newBoard,
    hand: newHand
  };

  return {
    ...state,
    players: newPlayers,
    selectedCard: null
  };
}

/**
 * カードの配置を元に戻す (ボードの指定列から最後のカードを手札に戻す)
 */
export function undoPlace(state, row) {
  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];

  if (player.board[row].length === 0) return state;

  const removedCard = player.board[row][player.board[row].length - 1];
  const newBoard = {
    ...player.board,
    [row]: player.board[row].slice(0, -1)
  };

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = {
    ...player,
    board: newBoard,
    hand: [...player.hand, removedCard]
  };

  return {
    ...state,
    players: newPlayers,
    selectedCard: null
  };
}

/**
 * 現在のプレイヤーの配置が完了したかチェック
 */
export function isPlacementComplete(state) {
  const player = state.players[state.currentPlayerIndex];
  return player.hand.length === 0;
}

/**
 * ターンを進める (次のプレイヤーへ、または次のラウンドへ)
 */
export function advanceTurn(state) {
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % NUM_PLAYERS;

  // 全プレイヤーがこのラウンドの配置を完了したか
  const allPlaced = state.players.every(p => p.hand.length === 0);

  if (!allPlaced) {
    // 次のプレイヤーへ
    return {
      ...state,
      currentPlayerIndex: nextPlayerIndex,
      phase: PHASES.TURN_SWITCH,
      selectedCard: null
    };
  }

  // 全員の配置完了 → ボードが全部埋まったかチェック
  const allBoardsComplete = state.players.every(p => isBoardComplete(p.board));

  if (allBoardsComplete) {
    // ラウンド終了 → スコア計算
    const roundScores = calculateScores(state.players);
    const newPlayers = state.players.map((p, i) => ({
      ...p,
      totalScore: p.totalScore + roundScores[i]
    }));

    return {
      ...state,
      players: newPlayers,
      roundScores,
      phase: PHASES.ROUND_RESULT,
      selectedCard: null
    };
  }

  // 次のカード配布ラウンド
  const newRoundNumber = state.roundNumber + 1;
  let remainingDeck = state.deck;
  const newPlayers = state.players.map(p => {
    const { dealt, remaining } = dealCards(remainingDeck, getCardsToDealt(newRoundNumber));
    remainingDeck = remaining;
    return { ...p, hand: dealt };
  });

  return {
    ...state,
    players: newPlayers,
    deck: remainingDeck,
    currentPlayerIndex: state.dealerIndex,
    roundNumber: newRoundNumber,
    phase: PHASES.PLACING,
    selectedCard: null
  };
}

/**
 * ターン切替画面から実際のプレイ画面に進む
 */
export function confirmTurnSwitch(state) {
  return {
    ...state,
    phase: PHASES.PLACING
  };
}

/**
 * 次のゲームラウンドを開始
 */
export function startNextGameRound(state) {
  const newDealerIndex = (state.dealerIndex + 1) % NUM_PLAYERS;
  const newState = {
    ...state,
    gameRound: state.gameRound + 1,
    dealerIndex: newDealerIndex
  };
  return startNewRound(newState);
}

/**
 * ゲームを終了状態にする
 */
export function endGame(state) {
  return {
    ...state,
    phase: PHASES.GAME_OVER
  };
}

/**
 * プレイヤーのボード情報を取得 (表示用)
 */
export function getPlayerBoardInfo(player) {
  const board = player.board;
  const foul = isBoardComplete(board) ? checkFoul(board) : false;
  const royalties = isBoardComplete(board) ? calculateRoyalties(board) : null;

  return {
    ...player,
    foul,
    royalties
  };
}
