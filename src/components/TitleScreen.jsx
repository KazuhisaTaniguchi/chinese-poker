import React from 'react';

export default function TitleScreen({ onNewGame, onContinue, hasSave }) {
  return (
    <div className="title-screen">
      <div className="title-logo">
        <h1>♠ チャイポー ♥</h1>
        <p>Open-face Chinese Poker</p>
      </div>
      <div className="title-buttons">
        <button
          className="btn btn-primary"
          onClick={onNewGame}
          id="new-game-btn"
        >
          新しいゲーム
        </button>
        <button
          className="btn btn-secondary"
          onClick={onContinue}
          disabled={!hasSave}
          id="continue-btn"
        >
          続きから
        </button>
      </div>
    </div>
  );
}
