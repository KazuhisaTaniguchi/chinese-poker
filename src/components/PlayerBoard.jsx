import React from 'react';
import CardComponent from './CardComponent.jsx';
import { ROW_LIMITS } from '../game/rules.js';
import { evaluateHand, getHandName } from '../game/hand.js';
import { canPlaceCard } from '../game/rules.js';

const ROW_LABELS = { top: 'Top (3)', middle: 'Middle (5)', bottom: 'Bottom (5)' };
const ROWS = ['top', 'middle', 'bottom'];

export default function PlayerBoard({ player, selectedCard, onPlaceCard, isActive, onBoardDragStart }) {
  return (
    <div className="player-board-section">
      <div className="player-board-header">
        <span className="current-player-name">{player.name}</span>
        <span className="current-player-score">{player.totalScore} pts</span>
      </div>
      <div className="board-rows">
        {ROWS.map(row => {
          const cards = player.board[row];
          const limit = ROW_LIMITS[row];
          const canPlace = isActive && selectedCard && canPlaceCard(player.board, row);
          const handEval = cards.length === limit ? evaluateHand(cards) : null;

          return (
            <div
              key={row}
              className={`board-row ${canPlace ? 'can-place' : ''}`}
              onClick={() => canPlace && onPlaceCard(row)}
              data-drop-target={row}
              role={canPlace ? 'button' : undefined}
              aria-label={canPlace ? `${ROW_LABELS[row]}に配置` : undefined}
            >
              <div className="row-header">
                <span className="row-label">{ROW_LABELS[row]}</span>
                {handEval && (
                  <span className="hand-name-badge">{getHandName(handEval)}</span>
                )}
              </div>
              <div className="row-cards">
                {Array.from({ length: limit }).map((_, i) => {
                  const card = cards[i] || null;
                  return (
                    <CardComponent
                      key={i}
                      card={card}
                      draggableBoard={!!card && isActive}
                      onDragStart={card ? (e) => onBoardDragStart(card, row, e) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
