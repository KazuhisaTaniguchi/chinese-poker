import React, { useState } from 'react';
import { checkFoul, calculateRoyalties } from '../game/scoring.js';
import { evaluateHand, getHandName, compareHands } from '../game/hand.js';

const ROW_LABELS = { top: 'Top', middle: 'Middle', bottom: 'Bottom' };

/**
 * 2プレイヤー間の対戦詳細を計算
 */
function getMatchupDetails(p1, p2) {
  const p1Board = p1.board;
  const p2Board = p2.board;
  const p1Foul = checkFoul(p1Board);
  const p2Foul = checkFoul(p2Board);

  if (p1Foul && p2Foul) {
    return { rows: [], p1Total: 0, p2Total: 0, scooping: null, p1Foul, p2Foul };
  }

  if (p1Foul) {
    const p2Roy = calculateRoyalties(p2Board);
    return {
      rows: [], p1Total: -6 - p2Roy.total, p2Total: 6 + p2Roy.total,
      scooping: null, p1Foul, p2Foul, foulPenalty: 6, foulRoyalty: p2Roy.total,
    };
  }
  if (p2Foul) {
    const p1Roy = calculateRoyalties(p1Board);
    return {
      rows: [], p1Total: 6 + p1Roy.total, p2Total: -6 - p1Roy.total,
      scooping: null, p1Foul, p2Foul, foulPenalty: 6, foulRoyalty: p1Roy.total,
    };
  }

  const rows = [];
  let p1Wins = 0;
  let p1LineScore = 0;
  let p2LineScore = 0;

  for (const row of ['top', 'middle', 'bottom']) {
    const eval1 = evaluateHand(p1Board[row]);
    const eval2 = evaluateHand(p2Board[row]);
    const result = compareHands(eval1, eval2);
    const winner = result > 0 ? 1 : result < 0 ? 2 : 0;
    if (winner === 1) { p1LineScore += 1; p2LineScore -= 1; p1Wins += 1; }
    else if (winner === 2) { p2LineScore += 1; p1LineScore -= 1; }
    rows.push({ row, winner });
  }

  let scooping = null;
  if (p1Wins === 3) { p1LineScore += 3; p2LineScore -= 3; scooping = 1; }
  else if (p1Wins === 0) { p2LineScore += 3; p1LineScore -= 3; scooping = 2; }

  const p1Roy = calculateRoyalties(p1Board);
  const p2Roy = calculateRoyalties(p2Board);

  return {
    rows,
    p1LineScore,
    p2LineScore,
    p1Royalty: p1Roy.total,
    p2Royalty: p2Roy.total,
    p1Total: p1LineScore + p1Roy.total - p2Roy.total,
    p2Total: p2LineScore + p2Roy.total - p1Roy.total,
    scooping,
    p1Foul,
    p2Foul,
  };
}

export default function RoundResult({ players, roundScores, onNextRound, onEndGame, gameRound }) {
  const [showDetail, setShowDetail] = useState(true);

  const sorted = players
    .map((p, i) => ({ ...p, roundScore: roundScores[i], index: i }))
    .sort((a, b) => b.roundScore - a.roundScore);

  const medals = ['🥇', '🥈', '🥉'];
  const hasFantasyland = players.some(p => p.inFantasyland);

  // 対戦組み合わせ
  const matchups = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matchups.push({
        p1: players[i],
        p2: players[j],
        p1Idx: i,
        p2Idx: j,
        details: getMatchupDetails(players[i], players[j]),
      });
    }
  }

  return (
    <div className="result-screen">
      <h2>ラウンド {gameRound} 結果</h2>

      <div className="result-list">
        {sorted.map((player, rank) => {
          const foul = checkFoul(player.board);
          const royalties = calculateRoyalties(player.board);
          return (
            <div key={player.id} className="result-item">
              <span className="result-rank">{medals[rank]}</span>
              <div style={{ flex: 1 }}>
                <span className="result-player-name">{player.name}</span>
                {foul && <span className="foul-badge">ファウル</span>}
                {player.inFantasyland && <span className="fl-badge">🌟 FL</span>}
                {!foul && (
                  <div className="result-hand-summary">
                    {['top', 'middle', 'bottom'].map(row => {
                      const eval_ = evaluateHand(player.board[row]);
                      const handName = getHandName(eval_);
                      const rowRoyalty = royalties[row];
                      return (
                        <span key={row} className="result-hand-row">
                          <span className="result-row-label">{ROW_LABELS[row]}</span>
                          <span className="result-hand-name">{handName}</span>
                          {rowRoyalty > 0 && <span className="result-royalty-badge">+{rowRoyalty}</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className={`result-score-change ${player.roundScore >= 0 ? 'positive' : 'negative'}`}>
                {player.roundScore >= 0 ? '+' : ''}{player.roundScore}
              </span>
            </div>
          );
        })}
      </div>

      {/* 詳細トグル */}
      <button className="btn btn-sm btn-outline detail-toggle" onClick={() => setShowDetail(!showDetail)}>
        {showDetail ? '▲ 詳細を閉じる' : '▼ 詳細を見る'}
      </button>

      {showDetail && (
        <div className="matchup-details">
          <h3>対戦詳細</h3>
          {matchups.map(({ p1, p2, details }, idx) => (
            <div key={idx} className="matchup-card">
              <div className="matchup-header">
                <span className="matchup-player">{p1.name}</span>
                <span className="matchup-vs">vs</span>
                <span className="matchup-player">{p2.name}</span>
              </div>

              {(details.p1Foul || details.p2Foul) ? (
                <div className="matchup-foul-info">
                  {details.p1Foul && details.p2Foul ? (
                    <span>両者ファウル → 0 : 0</span>
                  ) : details.p1Foul ? (
                    <span>{p1.name} ファウル → ペナルティ-6, ロイヤリティ-{details.foulRoyalty}</span>
                  ) : (
                    <span>{p2.name} ファウル → ペナルティ-6, ロイヤリティ-{details.foulRoyalty}</span>
                  )}
                </div>
              ) : (
                <div className="matchup-rows">
                  {details.rows.map(({ row, winner }) => (
                    <div key={row} className="matchup-row-item">
                      <span className={`matchup-result-icon ${winner === 1 ? 'win' : winner === 2 ? 'lose' : 'draw'}`}>
                        {winner === 1 ? '⭕' : winner === 2 ? '❌' : '➖'}
                      </span>
                      <span className="matchup-row-label">{ROW_LABELS[row]}</span>
                      <span className="matchup-hand">{getHandName(evaluateHand(p1.board[row]))}</span>
                      <span className="matchup-vs-small">vs</span>
                      <span className="matchup-hand">{getHandName(evaluateHand(p2.board[row]))}</span>
                      <span className={`matchup-result-icon ${winner === 2 ? 'win' : winner === 1 ? 'lose' : 'draw'}`}>
                        {winner === 2 ? '⭕' : winner === 1 ? '❌' : '➖'}
                      </span>
                    </div>
                  ))}
                  {details.scooping && (
                    <div className="matchup-bonus">
                      🎯 スクーピング! {details.scooping === 1 ? p1.name : p2.name} +3
                    </div>
                  )}
                  <div className="matchup-royalty-row">
                    <span>ロイヤリティ: {p1.name} {details.p1Royalty} / {p2.name} {details.p2Royalty}</span>
                  </div>
                </div>
              )}

              <div className="matchup-total">
                <span className={details.p1Total >= details.p2Total ? 'positive' : 'negative'}>
                  {details.p1Total >= 0 ? '+' : ''}{details.p1Total}
                </span>
                <span className="matchup-total-label">合計</span>
                <span className={details.p2Total >= details.p1Total ? 'positive' : 'negative'}>
                  {details.p2Total >= 0 ? '+' : ''}{details.p2Total}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
        {!hasFantasyland && (
          <button className="btn btn-danger" onClick={onEndGame} id="end-game-btn">
            ゲーム終了
          </button>
        )}
      </div>
    </div>
  );
}
