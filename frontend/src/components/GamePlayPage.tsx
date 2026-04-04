import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as authApi from '../authApi';
import * as api from '../api';
import GameBoard from './GameBoard';
import RoundResult from './RoundResult';
import FinalResult from './FinalResult';
import { PHASES } from '../game/gameState';

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
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [aborting, setAborting] = useState(false);
  const pollingRef = useRef(null);
  const navigate = useNavigate();

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
    pollingRef.current = setInterval(fetchState, 1000);
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

  // flIndex は useCallback の deps に含まれるため actions より先に計算する
  // gameState が null の場合は安全なデフォルト値を使う
  const isMyTurnEarly = gameState?.currentPlayerIndex === myPlayerIndex;
  const currentPlayerEarly = gameState?.players[myPlayerIndex];
  const myFLEarly = currentPlayerEarly?.inFantasyland && currentPlayerEarly?.hand?.length > 0;
  const canPlayEarly = isMyTurnEarly || (myFLEarly && gameState?.phase === 'placing');
  const flIndex = (canPlayEarly && !isMyTurnEarly) ? myPlayerIndex : null;

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
        await api.placeCard(gameState.gameId, selectedCard.id, row, flIndex);
        setSelectedCard(null);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [selectedCard, gameState?.gameId, flIndex, fetchState]),

    placeCardDirect: useCallback(async (cardId, row) => {
      if (!gameState?.gameId) return;
      try {
        await api.placeCard(gameState.gameId, cardId, row, flIndex);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, flIndex, fetchState]),

    undoPlace: useCallback(async (row, cardId = null) => {
      if (!gameState?.gameId) return;
      try {
        await api.undoPlace(gameState.gameId, row, cardId, flIndex);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, flIndex, fetchState]),

    moveCard: useCallback(async (sourceRow, targetRow, cardId) => {
      if (!gameState?.gameId) return;
      try {
        await api.undoPlace(gameState.gameId, sourceRow, cardId, flIndex);
        await api.placeCard(gameState.gameId, cardId, targetRow, flIndex);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, flIndex, fetchState]),

    confirmPlacement: useCallback(async () => {
      if (!gameState?.gameId) return;
      try {
        await api.confirmPlacement(gameState.gameId, flIndex);
        await fetchState();
      } catch (err) { console.error(err); }
    }, [gameState?.gameId, flIndex, fetchState]),

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

  const isMyTurn = isMyTurnEarly;
  const currentPlayer = gameState.players[myPlayerIndex];
  const canPlay = canPlayEarly;

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

  // 複数FL時: 自分より前のFLプレイヤーが全員確定済みか（ディーラー左から順番に確定）
  const canConfirmFL = (() => {
    if (!currentPlayer?.inFantasyland) return true;
    const flPlayers = gameState.players
      .filter(p => p.inFantasyland)
      .sort((a, b) => {
        const orderA = (a.id - gameState.dealerIndex - 1 + 3) % 3;
        const orderB = (b.id - gameState.dealerIndex - 1 + 3) % 3;
        return orderA - orderB;
      });
    const myPos = flPlayers.findIndex(p => p.id === myPlayerIndex);
    return flPlayers.slice(0, myPos).every(p => p.hand.length === 0);
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
            <div className="slide-menu-footer">
              <button
                className="btn btn-danger btn-block"
                onClick={() => { setMenuOpen(false); setShowAbortModal(true); }}
              >
                ⛔ ゲーム中断
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );

  // ディーラー名
  const dealerPlayer = gameState.players[gameState.dealerIndex];
  const dealerName = dealerPlayer?.name || '';

  // ターン切替 → 自動で進行（ボードは表示したまま）
  if (gameState.phase === 'turn_switch' && isMyTurn) {
    actions.confirmTurnSwitch();
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

  // ゲーム中断ハンドラ
  const handleAbort = async () => {
    setAborting(true);
    try {
      await authApi.abortGame(roomId);
      navigate(`/room/${roomId}`);
    } catch (err) {
      console.error(err);
      setAborting(false);
    }
  };

  // 中断確認モーダル
  const abortModal = showAbortModal && (
    <div className="modal-overlay" onClick={() => setShowAbortModal(false)}>
      <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
        <h3>⛔ ゲームを中断しますか？</h3>
        <p>現在のゲームデータはすべて破棄されます。</p>
        <p className="delete-warning">この操作は取り消せません。</p>
        <div className="modal-actions">
          <button
            className="btn btn-danger"
            onClick={handleAbort}
            disabled={aborting}
          >
            {aborting ? '中断中...' : '中断する'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowAbortModal(false)}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );

  // 自分の視点でGameBoard表示
  // 相手の配置中のカードを隠す（確定後に表示される）。FL同時プレイ対応。
  const stateForBoard = {
    ...gameState,
    currentPlayerIndex: myPlayerIndex,
    selectedCard: canPlay ? selectedCard : null,
    players: gameState.players.map((p, i) => {
      // 配置中の非FLアクティブプレイヤーのボードをlockedBoard（確定前は非表示）に置き換え
      const isActivePlacing = i === gameState.currentPlayerIndex && gameState.phase === 'placing';
      if (!isMyTurn && isActivePlacing && !p.inFantasyland) {
        return { ...p, board: p.lockedBoard };
      }
      return p;
    }),
  };

  return (
    <>
      {hamburgerMenu}
      {abortModal}
      <GameBoard
        state={stateForBoard}
        actions={actions}
        isPlacementDone={isPlacementDone && canConfirmFL}
        canPlay={canPlay}
        isMyTurn={isMyTurn}
        activePlayerName={gameState.players[gameState.currentPlayerIndex]?.name}
      />
    </>
  );
}
