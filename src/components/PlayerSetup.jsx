import React, { useState } from 'react';

export default function PlayerSetup({ onStart }) {
  const [names, setNames] = useState(['', '', '']);

  const handleChange = (index, value) => {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const playerNames = names.map((n, i) =>
      n.trim() || `Player ${i + 1}`
    );
    onStart(playerNames);
  };

  return (
    <div className="setup-screen">
      <h2>プレイヤー設定</h2>
      <form className="setup-form" onSubmit={handleSubmit}>
        {[0, 1, 2].map(i => (
          <div className="input-group" key={i}>
            <label htmlFor={`player-name-${i}`}>
              プレイヤー {i + 1}
            </label>
            <input
              id={`player-name-${i}`}
              type="text"
              value={names[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              placeholder={`Player ${i + 1}`}
              maxLength={12}
            />
          </div>
        ))}
        <button
          type="submit"
          className="btn btn-primary setup-start-btn"
          id="start-game-btn"
        >
          ゲーム開始
        </button>
      </form>
    </div>
  );
}
