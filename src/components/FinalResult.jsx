import React from 'react';

export default function FinalResult({ players, onNewGame }) {
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="result-screen">
      <h2>🏆 最終結果 🏆</h2>

      <div className="result-list">
        {sorted.map((player, rank) => (
          <div key={player.id} className="result-item">
            <span className="result-rank">{medals[rank]}</span>
            <span className="result-player-name">{player.name}</span>
            <span className={`result-score-change ${player.totalScore >= 0 ? 'positive' : 'negative'}`}>
              {player.totalScore}
            </span>
          </div>
        ))}
      </div>

      <div className="result-buttons">
        <button className="btn btn-primary" onClick={onNewGame} id="new-game-final-btn">
          新しいゲームを始める
        </button>
      </div>
    </div>
  );
}
