import React from 'react';
import { useGameState } from './hooks/useGameState.js';
import { PHASES } from './game/gameState.js';
import TitleScreen from './components/TitleScreen.jsx';
import PlayerSetup from './components/PlayerSetup.jsx';
import GameBoard from './components/GameBoard.jsx';
import RoundResult from './components/RoundResult.jsx';
import FinalResult from './components/FinalResult.jsx';
import './App.css';

export default function App() {
  const { state, actions, hasSave, isPlacementDone } = useGameState();

  const renderPhase = () => {
    switch (state.phase) {
      case PHASES.TITLE:
        return (
          <TitleScreen
            onNewGame={actions.goToSetup}
            onContinue={actions.loadSave}
            hasSave={hasSave}
          />
        );

      case PHASES.SETUP:
        return <PlayerSetup onStart={actions.startGame} />;

      case PHASES.PLACING:
        return (
          <GameBoard
            state={state}
            actions={actions}
            isPlacementDone={isPlacementDone}
          />
        );

      case PHASES.TURN_SWITCH:
        return (
          <div className="turn-switch-screen">
            <div className="turn-switch-icon">🔄</div>
            <h2>{state.players[state.currentPlayerIndex].name} の番です</h2>
            <p>端末を渡してください</p>
            <button
              className="btn btn-primary"
              onClick={actions.confirmTurnSwitch}
              id="turn-switch-btn"
            >
              準備OK
            </button>
          </div>
        );

      case PHASES.ROUND_RESULT:
        return (
          <RoundResult
            players={state.players}
            roundScores={state.roundScores}
            gameRound={state.gameRound}
            onNextRound={actions.nextRound}
            onEndGame={actions.endGame}
          />
        );

      case PHASES.GAME_OVER:
        return (
          <FinalResult
            players={state.players}
            onNewGame={actions.newGame}
          />
        );

      default:
        return <TitleScreen onNewGame={actions.goToSetup} onContinue={actions.loadSave} hasSave={hasSave} />;
    }
  };

  return <>{renderPhase()}</>;
}
