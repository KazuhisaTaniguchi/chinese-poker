import { SUIT_COLORS } from '../game/deck';
import { Card } from '../types';

interface CardProps {
  card: Card | null;
  selectable?: boolean;
  selected?: boolean;
  onClick?: (e?: any) => void;
  dimmed?: boolean;
  compact?: boolean;
  locked?: boolean;
  draggableHand?: boolean;
  draggableBoard?: boolean;
  onDragStart?: (e: any) => void;
}

export default function CardComponent({ card, selectable, selected, onClick, dimmed, compact, locked, draggableHand, draggableBoard, onDragStart }: CardProps) {
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
