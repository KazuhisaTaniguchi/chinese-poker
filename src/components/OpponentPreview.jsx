import React, { useState } from 'react';
import { SUIT_COLORS } from '../game/deck.js';
import { ROW_LIMITS } from '../game/rules.js';
import CardComponent from './CardComponent.jsx';
import { evaluateHand, getHandName } from '../game/hand.js';

const ROWS = ['top', 'middle', 'bottom'];
const ROW_LABELS = { top: 'Top (3)', middle: 'Middle (5)', bottom: 'Bottom (5)' };

function MiniCard({ card }) {
  if (!card) return <div className="opponent-mini-card" />;
  const colorClass = SUIT_COLORS[card.suit];
  return (
    <div className={`opponent-mini-card filled ${colorClass}`}>
      <span className="mini-rank">{card.rank}</span>
      <span className="mini-suit">{card.suit}</span>
    </div>
  );
}

export default function OpponentPreview({ players }) {
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  return (
    <>
      <div className="opponents-row">
        {players.map(player => (
          <div
            key={player.id}
            className="opponent-preview"
            onClick={() => setExpandedPlayer(player)}
          >
            <div className="opponent-preview-header">
              <span className="opponent-name">{player.name}</span>
              <span className="opponent-score">{player.totalScore}</span>
            </div>
            <div className="opponent-rows">
              {ROWS.map(row => (
                <div key={row} className="opponent-row">
                  {Array.from({ length: ROW_LIMITS[row] }).map((_, i) => (
                    <MiniCard key={i} card={player.board[row][i]} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {expandedPlayer && (
        <div className="modal-overlay" onClick={() => setExpandedPlayer(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{expandedPlayer.name} ({expandedPlayer.totalScore} pts)</h3>
              <button className="modal-close" onClick={() => setExpandedPlayer(null)}>×</button>
            </div>
            <div className="board-rows">
              {ROWS.map(row => {
                const cards = expandedPlayer.board[row];
                const limit = ROW_LIMITS[row];
                const handEval = cards.length === limit ? evaluateHand(cards) : null;

                return (
                  <div key={row} className="board-row">
                    <div className="row-header">
                      <span className="row-label">{ROW_LABELS[row]}</span>
                      {handEval && (
                        <span className="hand-name-badge">{getHandName(handEval)}</span>
                      )}
                    </div>
                    <div className="row-cards">
                      {Array.from({ length: limit }).map((_, i) => (
                        <CardComponent key={i} card={cards[i] || null} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
