import React, { useMemo, useCallback } from 'react';
import PlayerBoard from './PlayerBoard.jsx';
import OpponentPreview from './OpponentPreview.jsx';
import HandArea from './HandArea.jsx';
import ActionButtons from './ActionButtons.jsx';
import useDragDrop from '../hooks/useDragDrop.js';

export default function GameBoard({ state, actions, isPlacementDone }) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const opponents = state.players.filter((_, i) => i !== state.currentPlayerIndex);
  const isFantasyland = currentPlayer?.inFantasyland;
  const flBonus = currentPlayer?.fantasylandBonus || 0;
  const isPineappleRound = state.roundNumber > 0 && !isFantasyland;

  // FL時: 配布枚数 = 5 + bonus, 捨て枚数 = 配布 - 13
  const totalCards = 13;
  let cardsDealt, discardCount;
  if (isFantasyland) {
    cardsDealt = 5 + flBonus;
    discardCount = cardsDealt - totalCards;
  } else if (state.roundNumber === 0) {
    cardsDealt = 5;
    discardCount = 0;
  } else {
    cardsDealt = 3;
    discardCount = 1;
  }

  const handCount = currentPlayer.hand?.length || 0;
  const hasPlacedCards = handCount < cardsDealt;
  const isDiscardMode = isPlacementDone && discardCount > 0;

  const handleUndo = () => {
    const rows = ['bottom', 'middle', 'top'];
    for (const row of rows) {
      if (currentPlayer.board[row].length > 0) {
        actions.undoPlace(row);
        return;
      }
    }
  };

  // ドラッグ＆ドロップ: カード配置 (直接APIを呼ぶ)
  const handleDragPlace = useCallback((card, row) => {
    actions.placeCardDirect(card.id, row);
  }, [actions]);

  // ドラッグ＆ドロップ: undo
  const handleDragUndo = useCallback((row) => {
    actions.undoPlace(row);
  }, [actions]);

  const { dragging, handleHandDragStart, handleBoardDragStart } = useDragDrop({
    onPlaceCard: handleDragPlace,
    onUndoRow: handleDragUndo,
  });

  const totalRounds = isFantasyland ? 1 : 5;
  const currentRoundDisplay = isFantasyland ? 1 : state.roundNumber + 1;

  return (
    <div className="game-board fade-in">
      {/* ヘッダー */}
      <div className="game-header">
        <span className="game-header-title">
          {isFantasyland ? '🌟 ファンタジーランド' : '♠ チャイポー'}
        </span>
        <span className="game-header-info">
          R{state.gameRound} · ターン {currentRoundDisplay}/{totalRounds}
        </span>
      </div>

      {/* ファンタジーランドバナー */}
      {isFantasyland && (
        <div className="fantasyland-banner">
          <span className="fl-icon">🌟</span>
          <span className="fl-text">
            {cardsDealt}枚から13枚を配置！（{discardCount}枚捨て）
          </span>
        </div>
      )}

      {/* 対戦相手プレビュー */}
      <OpponentPreview players={opponents} />

      {/* 現在のプレイヤーのボード */}
      <PlayerBoard
        player={currentPlayer}
        selectedCard={state.selectedCard}
        onPlaceCard={actions.placeCard}
        isActive={true}
        onBoardDragStart={handleBoardDragStart}
      />

      {/* 手札エリア */}
      <HandArea
        cards={currentPlayer.hand}
        selectedCard={state.selectedCard}
        onSelectCard={actions.selectCard}
        isDiscardMode={isDiscardMode}
        discardCount={discardCount}
        isFantasyland={isFantasyland}
        onHandDragStart={handleHandDragStart}
      />

      {/* アクションボタン */}
      <ActionButtons
        onConfirm={actions.confirmPlacement}
        onUndo={handleUndo}
        canConfirm={isPlacementDone}
        hasPlacedCards={hasPlacedCards}
        selectedCard={state.selectedCard}
        isDiscardMode={isDiscardMode}
        discardCount={discardCount}
      />
    </div>
  );
}
