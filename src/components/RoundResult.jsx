import React from 'react';
import { checkFoul, calculateRoyalties } from '../game/scoring.js';
import { evaluateHand, getHandName } from '../game/hand.js';

export default function RoundResult({ players, roundScores, onNextRound, onEndGame, gameRound }) {
  // ラウンドスコアでソート
  const sorted = players
    .map((p, i) => ({ ...p, roundScore: roundScores[i], index: i }))
    .sort((a, b) => b.roundScore - a.roundScore);

  const medals = ['🥇', '🥈', '🥉'];

  // ファンタジーランド成立プレイヤーがいるか
  const hasFantasyland = players.some(p => p.inFantasyland);

  return (
    <div className="result-screen">
      <h2>ラウンド {gameRound} 結果</h2>

      <div className="result-list">
        {sorted.map((player, rank) => {
          const foul = checkFoul(player.board);
          return (
            <div key={player.id} className="result-item">
              <span className="result-rank">{medals[rank]}</span>
              <div style={{ flex: 1 }}>
                <span className="result-player-name">{player.name}</span>
                {foul && <span className="foul-badge">ファウル</span>}
                {player.inFantasyland && (
                  <span className="fl-badge">🌟 FL</span>
                )}
              </div>
              <span className={`result-score-change ${player.roundScore >= 0 ? 'positive' : 'negative'}`}>
                {player.roundScore >= 0 ? '+' : ''}{player.roundScore}
              </span>
            </div>
          );
        })}
      </div>

      {hasFantasyland && (
        <div className="fantasyland-result-notice">
          🌟 次のラウンドでファンタジーランドが発動します！
        </div>
      )}

      <div className="result-totals">
        <h3>累計スコア</h3>
        {players.map(player => (
          <div key={player.id} className="result-total-row">
            <span className="result-total-name">{player.name}</span>
            <span className="result-total-score">{player.totalScore}</span>
          </div>
        ))}
      </div>

      <div className="result-buttons">
        <button className="btn btn-primary" onClick={onNextRound} id="next-round-btn">
          次のラウンドへ
        </button>
        <button className="btn btn-danger" onClick={onEndGame} id="end-game-btn">
          ゲーム終了
        </button>
      </div>
    </div>
  );
}
