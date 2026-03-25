import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import * as authApi from '../authApi.js';
import * as api from '../api.js';
import GameBoard from './GameBoard.jsx';
import RoundResult from './RoundResult.jsx';
import FinalResult from './FinalResult.jsx';
import { PHASES } from '../game/gameState.js';

/**
 * マルチプレイヤー用ゲーム画面
 * ポーリングで状態を取得し、自分のプレイヤーインデックスに基づいてUIを表示
 */
export default function GamePlayPage({ user }) {
  const { roomId } = useParams();
  const [gameState, setGameState] = useState(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [slots, setSlots] = useState(null);
  const pollingRef = useRef(null);

  // ポーリングでゲーム状態を取得
  const fetchState = useCallback(async () => {
    try {
      const data = await authApi.getRoomState(roomId);
      if (data.game_started && data.game) {
        const game = data.game;
        setMyPlayerIndex(data.my_player_index);
        setIsHost(data.is_host || false);
        if (data.slots) setSlots(data.slots);

        // API response → local state
        const players = game.players.map(p => ({
          id: p.order,
          name: p.name,
          hand: p.hand || [],
          board: p.board || { top: [], middle: [], bottom: [] },
          totalScore: p.total_score,
          inFantasyland: p.in_fantasyland,
          fantasylandBonus: p.fantasyland_bonus,
          lockedBoard: p.locked_board || { top: [], middle: [], bottom: [] },
        }));

        setGameState({
          phase: game.phase,
          gameId: game.id,
          players,
          currentPlayerIndex: game.current_player_index,
          roundNumber: game.round_number,
          gameRound: game.game_round,
          roundScores: game.round_scores || [],
          dealerIndex: game.dealer_index,
          selectedCard: null,
        });
      }
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // ポーリング開始
  useEffect(() => {
    fetchState();
    pollingRef.current = setInterval(fetchState, 3000);
    return () => clearInterval(pollingRef.current);
  }, [fetchState]);

  // 招待URLコピー
  const copyInviteUrl = (slot) => {
    const url = `${window.location.origin}/join/${roomId}/${slot.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slot.order);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // アクション (自分のターンのみ操作可能)
  const actions = {
    selectCard: useCallback((cardId) => {
      setSelectedCard(prev => {
        if (cardId === null) return null;
        const player = gameState?.players[myPlayerIndex];
        const card = player?.hand?.find(c => c.id === cardId);
        return prev?.id === cardId ? null : card || null;
      });
    }, [gameState, myPlayerIndex]),

    placeCard: useCallback(async (row) => {
      if (!selectedCard || !gameState?.gameId) return;
      try {
        await api.placeCard(gameState.gameId, selectedCard.id, row);
        setSelectedCard(null);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [selectedCard, gameState?.gameId, fetchState]),

    placeCardDirect: useCallback(async (cardId, row) => {
      if (!gameState?.gameId) return;
      try {
        await api.placeCard(gameState.gameId, cardId, row);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, fetchState]),

    undoPlace: useCallback(async (row, cardId = null) => {
      if (!gameState?.gameId) return;
      try {
        await api.undoPlace(gameState.gameId, row, cardId);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, fetchState]),

    moveCard: useCallback(async (sourceRow, targetRow, cardId) => {
      if (!gameState?.gameId) return;
      try {
        await api.undoPlace(gameState.gameId, sourceRow, cardId);
        await api.placeCard(gameState.gameId, cardId, targetRow);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, fetchState]),

    confirmPlacement: useCallback(async () => {
      if (!gameState?.gameId) return;
      try {
        await api.confirmPlacement(gameState.gameId);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, fetchState]),

    confirmTurnSwitch: useCallback(async () => {
      if (!gameState?.gameId) return;
      try {
        await api.confirmTurnSwitch(gameState.gameId);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, fetchState]),

    nextRound: useCallback(async () => {
      if (!gameState?.gameId) return;
      try {
        await api.nextRound(gameState.gameId);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, fetchState]),

    endGame: useCallback(async () => {
      if (!gameState?.gameId) return;
      try {
        await api.endGame(gameState.gameId);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, fetchState]),

    newGame: useCallback(() => {
      window.location.href = '/lobby';
    }, []),
  };

  if (loading) return <div className="loading-page">ゲームを読み込み中...</div>;
  if (!gameState) return <div className="loading-page">ゲーム待機中...</div>;

  const isMyTurn = gameState.currentPlayerIndex === myPlayerIndex;
  const currentPlayer = gameState.players[myPlayerIndex];

  // 配置完了判定
  const isPlacementDone = (() => {
    if (!currentPlayer) return false;
    const board = currentPlayer.board;
    const placed = board.top.length + board.middle.length + board.bottom.length;
    const isFL = currentPlayer.inFantasyland;

    if (isFL) return placed === 13;
    if (gameState.roundNumber === 0) return placed === 5;
    return currentPlayer.hand.length <= 1;
  })();

  // ハンバーガーメニュー
  const hamburgerMenu = isHost && slots && (
    <>
      <button
        className="hamburger-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="メニュー"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>
      {menuOpen && (
        <>
          <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
          <div className="slide-menu">
            <div className="slide-menu-header">
              <h3>📋 招待URL</h3>
              <button className="menu-close-btn" onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div className="slide-menu-content">
              {slots.map(slot => (
                <div key={slot.order} className="menu-slot-item">
                  <div className="menu-slot-info">
                    <span className="menu-slot-order">P{slot.order + 1}</span>
                    <span className="menu-slot-name">{slot.name}</span>
                    {slot.username && <span className="menu-slot-joined">✅ {slot.username}</span>}
                  </div>
                  {slot.token && (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => copyInviteUrl(slot)}
                    >
                      {copied === slot.order ? '✅ コピー済み' : '📋 URLコピー'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  // ディーラー名
  const dealerPlayer = gameState.players[gameState.dealerIndex];
  const dealerName = dealerPlayer?.name || '';

  // 自分のターンでない場合の待機画面
  if (gameState.phase === 'placing' && !isMyTurn) {
    return (
      <div className="waiting-screen">
        {hamburgerMenu}
        <div className="dealer-info-bar">
          <span className="dealer-badge">DEALER</span> {dealerName}
        </div>
        <div className="waiting-icon">⏳</div>
        <h2>{gameState.players[gameState.currentPlayerIndex]?.name} のターン中...</h2>
        <p>しばらくお待ちください</p>
        <div className="waiting-spinner" />
      </div>
    );
  }

  // ターン切替 → 自動で進行
  if (gameState.phase === 'turn_switch') {
    if (isMyTurn) {
      actions.confirmTurnSwitch();
    }
    return (
      <div className="waiting-screen">
        {hamburgerMenu}
        <div className="dealer-info-bar">
          <span className="dealer-badge">DEALER</span> {dealerName}
        </div>
        <div className="waiting-icon">🔄</div>
        <h2>ターン切替中...</h2>
      </div>
    );
  }

  if (gameState.phase === 'round_result') {
    return (
      <>
        {hamburgerMenu}
        <RoundResult
          players={gameState.players}
          roundScores={gameState.roundScores}
          gameRound={gameState.gameRound}
          onNextRound={actions.nextRound}
          onEndGame={actions.endGame}
        />
      </>
    );
  }

  if (gameState.phase === 'game_over') {
    return (
      <>
        {hamburgerMenu}
        <FinalResult players={gameState.players} onNewGame={actions.newGame} />
      </>
    );
  }

  // 自分のターン → GameBoard表示
  const stateForBoard = {
    ...gameState,
    currentPlayerIndex: myPlayerIndex,
    selectedCard,
  };

  return (
    <>
      {hamburgerMenu}
      <GameBoard
        state={stateForBoard}
        actions={actions}
        isPlacementDone={isPlacementDone}
      />
    </>
  );
}
