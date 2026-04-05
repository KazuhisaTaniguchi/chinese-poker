import { useState } from 'react';

export default function PlayerSetup({ onStart }) {
  const [playerCount, setPlayerCount] = useState(3);
  const [names, setNames] = useState(['', '', '']);

  const handleChange = (index, value) => {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const playerNames = names.slice(0, playerCount).map((n, i) =>
      n.trim() || `Player ${i + 1}`
    );
    onStart(playerNames);
  };

  return (
    <div className="setup-screen">
      <h2>プレイヤー設定</h2>
      <form className="setup-form" onSubmit={handleSubmit}>
        <div className="player-count-group">
          <label>人数</label>
          <div className="player-count-btns">
            {[2, 3].map(n => (
              <button
                key={n}
                type="button"
                className={`btn ${playerCount === n ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setPlayerCount(n)}
              >
                {n}人
              </button>
            ))}
          </div>
        </div>
        {Array.from({ length: playerCount }, (_, i) => i).map(i => (
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
