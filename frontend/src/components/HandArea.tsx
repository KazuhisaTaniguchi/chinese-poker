import { useState, useMemo } from 'react';
import CardComponent from './CardComponent';
import { RANK_VALUES } from '../game/deck';

const SUIT_ORDER = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };

function sortBySuit(cards) {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    if (suitDiff !== 0) return suitDiff;
    return RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
  });
}

function sortByRank(cards) {
  return [...cards].sort((a, b) => {
    const rankDiff = RANK_VALUES[a.rank] - RANK_VALUES[b.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}

export default function HandArea({ cards, selectedCard, onSelectCard, isDiscardMode, discardCount, isFantasyland, onHandDragStart }) {
  const [sortMode, setSortMode] = useState('none');

  const sortedCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];
    if (sortMode === 'suit') return sortBySuit(cards);
    if (sortMode === 'rank') return sortByRank(cards);
    return cards;
  }, [cards, sortMode]);

  if (!cards || cards.length === 0) return null;

  const label = isDiscardMode
    ? `🗑️ この${discardCount}枚が捨て札になります`
    : isFantasyland
      ? `🌟 手札（残り${cards.length}枚）`
      : 'あなたの手札';

  return (
    <div
      className={`hand-area ${isFantasyland ? 'fantasyland-hand' : ''}`}
      data-drop-target="hand"
    >
      <div className="hand-label-row">
        <div className="hand-label">{label}</div>
        {isFantasyland && !isDiscardMode && (
          <div className="sort-buttons">
            <button
              className={`sort-btn ${sortMode === 'suit' ? 'active' : ''}`}
              onClick={() => setSortMode(sortMode === 'suit' ? 'none' : 'suit')}
            >
              スート順
            </button>
            <button
              className={`sort-btn ${sortMode === 'rank' ? 'active' : ''}`}
              onClick={() => setSortMode(sortMode === 'rank' ? 'none' : 'rank')}
            >
              数字順
            </button>
          </div>
        )}
      </div>
      <div className={`hand-cards ${cards.length > 5 ? 'hand-cards-wrap' : ''}`}>
        {sortedCards.map(card => (
          <CardComponent
            key={card.id}
            card={card}
            selectable={!isDiscardMode}
            selected={selectedCard?.id === card.id}
            onClick={() => !isDiscardMode && onSelectCard(card.id)}
            dimmed={isDiscardMode}
            compact={cards.length > 8}
            draggableHand={!isDiscardMode}
            onDragStart={(e) => onHandDragStart(card, e)}
          />
        ))}
      </div>
    </div>
  );
}
