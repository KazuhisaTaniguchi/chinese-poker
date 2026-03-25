import React from 'react';
import { SUIT_COLORS } from '../game/deck.js';

export default function CardComponent({ card, selectable, selected, onClick, dimmed, compact, locked, draggableHand, draggableBoard, onDragStart }) {
  if (!card) {
    return <div className="card-slot" />;
  }

  const colorClass = SUIT_COLORS[card.suit];
  const isDraggable = draggableHand || draggableBoard;
  const classes = [
    'card',
    colorClass,
    selectable && 'selectable',
    selected && 'selected',
    dimmed && 'dimmed',
    compact && 'compact',
    locked && 'locked',
    isDraggable && 'draggable'
  ].filter(Boolean).join(' ');

  const handlePointerDown = (e) => {
    if (isDraggable && onDragStart) {
      onDragStart(e.nativeEvent);
    }
  };

  return (
    <div
      className={classes}
      onClick={onClick}
      onTouchStart={handlePointerDown}
      onMouseDown={handlePointerDown}
      role={selectable ? 'button' : undefined}
      aria-label={selectable ? `${card.rank}${card.suit}を選択` : undefined}
    >
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{card.suit}</span>
    </div>
  );
}
