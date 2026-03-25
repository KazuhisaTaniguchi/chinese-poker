import React, { useMemo, useCallback, useState } from 'react';
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

  // ボードカード選択状態 { card, row }
  const [selectedBoardCard, setSelectedBoardCard] = useState(null);

  const handleUndo = () => {
    const rows = ['bottom', 'middle', 'top'];
    for (const row of rows) {
      if (currentPlayer.board[row].length > 0) {
        actions.undoPlace(row);
        return;
      }
    }
  };

  // ボード上のカードをタップ (最後のカードのみ)
  const handleBoardCardClick = useCallback((card, row) => {
    if (selectedBoardCard?.card.id === card.id) {
      setSelectedBoardCard(null); // 選択解除
    } else {
      setSelectedBoardCard({ card, row });
      // 手札の選択を解除
      actions.selectCard(null);
    }
  }, [selectedBoardCard, actions]);

  // 列をタップ: ボードカード選択中 → 移動、手札カード選択中 → 配置
  const handleRowClick = useCallback((targetRow) => {
    if (selectedBoardCard) {
      if (selectedBoardCard.row !== targetRow) {
        actions.moveCard(selectedBoardCard.row, targetRow, selectedBoardCard.card.id);
      }
      setSelectedBoardCard(null);
    } else {
      actions.placeCard(targetRow);
    }
  }, [selectedBoardCard, actions]);

  // 手札カード選択時、ボードカード選択を解除
  const handleSelectCard = useCallback((cardId) => {
    setSelectedBoardCard(null);
    actions.selectCard(cardId);
  }, [actions]);

  // ドラッグ＆ドロップ
  const handleDragPlace = useCallback((card, row) => {
    actions.placeCardDirect(card.id, row);
  }, [actions]);

  const handleDragUndo = useCallback((row) => {
    actions.undoPlace(row);
  }, [actions]);

  // ボード→ボード移動 (ドラッグ)
  const handleDragBoardToBoard = useCallback((card, sourceRow, targetRow) => {
    actions.moveCard(sourceRow, targetRow, card.id);
  }, [actions]);

  const { dragging, handleHandDragStart, handleBoardDragStart } = useDragDrop({
    onPlaceCard: handleDragPlace,
    onUndoRow: handleDragUndo,
    onMoveCard: handleDragBoardToBoard,
  });

  const totalRounds = isFantasyland ? 1 : 5;
  const currentRoundDisplay = isFantasyland ? 1 : state.roundNumber + 1;

  return (
    <div className="game-board fade-in">
      <div className="game-header">
        <span className="game-header-title">
          {isFantasyland ? '🌟 ファンタジーランド' : '♠ チャイポー'}
        </span>
        <span className="game-header-info">
          R{state.gameRound} · ターン {currentRoundDisplay}/{totalRounds}
        </span>
      </div>

      {isFantasyland && (
        <div className="fantasyland-banner">
          <span className="fl-icon">🌟</span>
          <span className="fl-text">
            {cardsDealt}枚から13枚を配置！（{discardCount}枚捨て）
          </span>
        </div>
      )}

      <OpponentPreview players={opponents} dealerIndex={state.dealerIndex} />

      <PlayerBoard
        player={currentPlayer}
        selectedCard={state.selectedCard}
        selectedBoardCard={selectedBoardCard}
        onPlaceCard={handleRowClick}
        onBoardCardClick={handleBoardCardClick}
        isActive={true}
        onBoardDragStart={handleBoardDragStart}
        dealerIndex={state.dealerIndex}
      />

      <HandArea
        cards={currentPlayer.hand}
        selectedCard={state.selectedCard}
        onSelectCard={handleSelectCard}
        isDiscardMode={isDiscardMode}
        discardCount={discardCount}
        isFantasyland={isFantasyland}
        onHandDragStart={handleHandDragStart}
      />

      <ActionButtons
        onConfirm={actions.confirmPlacement}
        onUndo={handleUndo}
        canConfirm={isPlacementDone}
        hasPlacedCards={hasPlacedCards}
        selectedCard={state.selectedCard || selectedBoardCard?.card}
        isDiscardMode={isDiscardMode}
        discardCount={discardCount}
      />
    </div>
  );
}
