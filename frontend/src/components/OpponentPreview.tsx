import { useState } from 'react';
import { SUIT_COLORS } from '../game/deck';
import { ROW_LIMITS } from '../game/rules';
import CardComponent from './CardComponent';
import { evaluateHand, getHandName } from '../game/hand';

const ROWS = ['top', 'middle', 'bottom'];
const ROW_LABELS = { top: 'Top (3)', middle: 'Middle (5)', bottom: 'Bottom (5)' };

function isBoardComplete(board) {
  return board.top.length === 3 && board.middle.length === 5 && board.bottom.length === 5;
}

function MiniCard({ card, hidden }) {
  if (!card) return <div className="opponent-mini-card" />;
  if (hidden) {
    return (
      <div className="opponent-mini-card filled hidden-card">
        <span className="mini-rank">?</span>
      </div>
    );
  }
  const colorClass = SUIT_COLORS[card.suit];
  return (
    <div className={`opponent-mini-card filled ${colorClass}`}>
      <span className="mini-rank">{card.rank}</span>
      <span className="mini-suit">{card.suit}</span>
    </div>
  );
}

export default function OpponentPreview({ players, dealerIndex }) {
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  return (
    <>
      <div className="opponents-row">
        {players.map(player => {
          // FLプレイヤーは配置確定前（手札が残っている間）だけ隠す
          const hideCards = player.inFantasyland && player.hand && player.hand.length > 0;

          return (
            <div
              key={player.id}
              className="opponent-preview"
              onClick={() => setExpandedPlayer(player)}
            >
              <div className="opponent-preview-header">
                <div className="opponent-name-group">
                  <span className="opponent-name">{player.name}</span>
                  {Number(player.id) === Number(dealerIndex) && <span className="dealer-badge">DEALER</span>}
                </div>
                {hideCards && <span className="fl-done-badge">🔒</span>}
                <span className="opponent-score">{player.totalScore}</span>
              </div>
              <div className="opponent-rows">
                {ROWS.map(row => (
                  <div key={row} className="opponent-row">
                    {Array.from({ length: ROW_LIMITS[row] }).map((_, i) => (
                      <MiniCard key={i} card={player.board[row][i]} hidden={hideCards} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {expandedPlayer && (() => {
        const hideCards = expandedPlayer.inFantasyland && expandedPlayer.hand && expandedPlayer.hand.length > 0;
        return (
          <div className="modal-overlay" onClick={() => setExpandedPlayer(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{expandedPlayer.name} ({expandedPlayer.totalScore} pts)</h3>
                <button className="modal-close" onClick={() => setExpandedPlayer(null)}>×</button>
              </div>
              {hideCards ? (
                <div className="fl-hidden-message">
                  🔒 ラウンド終了まで非公開
                </div>
              ) : (
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
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
