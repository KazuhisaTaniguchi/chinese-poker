import { useState, useCallback, useEffect } from 'react';
import * as api from '../api.js';

/**
 * ゲームフェーズ定数 (バックエンドと同期)
 */
const PHASES = {
  TITLE: 'title',
  SETUP: 'setup',
  PLACING: 'placing',
  TURN_SWITCH: 'turn_switch',
  ROUND_RESULT: 'round_result',
  GAME_OVER: 'game_over',
};

/**
 * APIレスポンスをフロントエンド用の state 形式に変換
 */
function apiResponseToState(data) {
  return {
    gameId: data.id,
    players: data.players.map(p => ({
      id: p.order,
      name: p.name,
      board: p.board,
      hand: p.hand,
      totalScore: p.total_score,
      inFantasyland: p.in_fantasyland,
      fantasylandBonus: p.fantasyland_bonus,
    })),
    currentPlayerIndex: data.current_player_index,
    roundNumber: data.round_number,
    gameRound: data.game_round,
    phase: data.phase,
    selectedCard: null,
    roundScores: data.round_scores,
    dealerIndex: data.dealer_index,
  };
}

export function useGameState() {
  const [state, setState] = useState({
    gameId: null,
    players: [
      { id: 0, name: 'Player 1', board: { top: [], middle: [], bottom: [] }, hand: [], totalScore: 0 },
      { id: 1, name: 'Player 2', board: { top: [], middle: [], bottom: [] }, hand: [], totalScore: 0 },
      { id: 2, name: 'Player 3', board: { top: [], middle: [], bottom: [] }, hand: [], totalScore: 0 },
    ],
    currentPlayerIndex: 0,
    roundNumber: 0,
    gameRound: 1,
    phase: PHASES.TITLE,
    selectedCard: null,
    roundScores: [],
    dealerIndex: 0,
  });

  const [loading, setLoading] = useState(false);
  const [hasSaveData, setHasSaveData] = useState(false);

  // 起動時にセーブ一覧チェック
  useEffect(() => {
    api.getGames().then(games => {
      setHasSaveData(games.length > 0);
    }).catch(() => {
      setHasSaveData(false);
    });
  }, []);

  // API呼び出しラッパー
  const apiCall = useCallback(async (fn) => {
    setLoading(true);
    try {
      const data = await fn();
      setState(prev => ({
        ...apiResponseToState(data),
        selectedCard: null,
      }));
      return data;
    } catch (err) {
      console.error('API Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const actions = {
    goToSetup: useCallback(() => {
      setState(prev => ({ ...prev, phase: PHASES.SETUP }));
    }, []),

    startGame: useCallback(async (playerNames) => {
      await apiCall(() => api.createGame(playerNames));
    }, [apiCall]),

    selectCard: useCallback((cardId) => {
      setState(prev => {
        const card = prev.players[prev.currentPlayerIndex]?.hand?.find(c => c.id === cardId);
        if (!card) return prev;
        return {
          ...prev,
          selectedCard: prev.selectedCard?.id === cardId ? null : card,
        };
      });
    }, []),

    placeCard: useCallback(async (row) => {
      const currentState = state;
      if (!currentState.selectedCard || !currentState.gameId) return;

      await apiCall(() => api.placeCard(
        currentState.gameId,
        currentState.selectedCard.id,
        row
      ));
    }, [state.selectedCard, state.gameId, apiCall]),

    // ドラッグ＆ドロップ用: カードIDを直接指定して配置
    placeCardDirect: useCallback(async (cardId, row) => {
      if (!state.gameId) return;
      await apiCall(() => api.placeCard(state.gameId, cardId, row));
    }, [state.gameId, apiCall]),

    undoPlace: useCallback(async (row, cardId = null) => {
      if (!state.gameId) return;
      await apiCall(() => api.undoPlace(state.gameId, row, cardId));
    }, [state.gameId, apiCall]),

    // ボード行間移動: undo → place を連続実行
    moveCard: useCallback(async (sourceRow, targetRow, cardId) => {
      if (!state.gameId) return;
      try {
        setLoading(true);
        // 1. 元の行から特定のカードを手札に戻す
        await api.undoPlace(state.gameId, sourceRow, cardId);
        // 2. 対象の行に配置
        const result = await api.placeCard(state.gameId, cardId, targetRow);
        setState(apiResponseToState(result));
      } catch (err) {
        console.error('moveCard Error:', err.message);
        // 失敗した場合、最新状態を取得
        try {
          const result = await api.getGame(state.gameId);
          setState(apiResponseToState(result));
        } catch (_) {}
      } finally {
        setLoading(false);
      }
    }, [state.gameId]),

    confirmPlacement: useCallback(async () => {
      if (!state.gameId) return;
      await apiCall(() => api.confirmPlacement(state.gameId));
    }, [state.gameId, apiCall]),

    confirmTurnSwitch: useCallback(async () => {
      if (!state.gameId) return;
      await apiCall(() => api.confirmTurnSwitch(state.gameId));
    }, [state.gameId, apiCall]),

    nextRound: useCallback(async () => {
      if (!state.gameId) return;
      await apiCall(() => api.nextRound(state.gameId));
    }, [state.gameId, apiCall]),

    endGame: useCallback(async () => {
      if (!state.gameId) return;
      await apiCall(() => api.endGame(state.gameId));
    }, [state.gameId, apiCall]),

    loadSave: useCallback(async () => {
      setLoading(true);
      try {
        const games = await api.getGames();
        if (games.length > 0) {
          const data = await api.getGame(games[0].id);
          setState(apiResponseToState(data));
        }
      } catch (err) {
        console.error('Load Error:', err.message);
      } finally {
        setLoading(false);
      }
    }, []),

    newGame: useCallback(() => {
      setState(prev => ({
        ...prev,
        gameId: null,
        phase: PHASES.TITLE,
        selectedCard: null,
      }));
    }, []),
  };

  // 配置完了チェック (パイナップル + ファンタジーランド対応)
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isFantasyland = currentPlayer?.inFantasyland;
  const flBonus = currentPlayer?.fantasylandBonus || 0;
  const totalCards = 13; // ボードに配置する合計枚数
  const placedCount = currentPlayer ? 
    (currentPlayer.board.top.length + currentPlayer.board.middle.length + currentPlayer.board.bottom.length) : 0;
  
  let discardCount;
  if (isFantasyland) {
    discardCount = (5 + flBonus) - totalCards; // FL: 配布枚数 - 13
  } else {
    discardCount = state.roundNumber === 0 ? 0 : 1;
  }
  const isPlacementDone = currentPlayer?.hand?.length === discardCount && placedCount > 0;

  return {
    state,
    actions,
    hasSave: hasSaveData,
    isPlacementDone,
    loading,
  };
}
