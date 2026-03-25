import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { useGameState } from './hooks/useGameState.js';
import { PHASES } from './game/gameState.js';
import LoginPage from './components/LoginPage.jsx';
import RegisterPage from './components/RegisterPage.jsx';
import LobbyPage from './components/LobbyPage.jsx';
import RoomPage from './components/RoomPage.jsx';
import JoinPage from './components/JoinPage.jsx';
import GamePlayPage from './components/GamePlayPage.jsx';
import TitleScreen from './components/TitleScreen.jsx';
import PlayerSetup from './components/PlayerSetup.jsx';
import GameBoard from './components/GameBoard.jsx';
import RoundResult from './components/RoundResult.jsx';
import FinalResult from './components/FinalResult.jsx';
import './App.css';

/**
 * ローカルモード (従来): /local で従来のローカルプレイ
 * マルチプレイヤーモード: /login → /lobby → /room → /play
 */
function LocalGame() {
  const { state, actions, hasSave, isPlacementDone } = useGameState();

  switch (state.phase) {
    case PHASES.TITLE:
      return <TitleScreen onNewGame={actions.goToSetup} onContinue={actions.loadSave} hasSave={hasSave} />;
    case PHASES.SETUP:
      return <PlayerSetup onStart={actions.startGame} />;
    case PHASES.PLACING:
      return <GameBoard state={state} actions={actions} isPlacementDone={isPlacementDone} />;
    case PHASES.TURN_SWITCH:
      return (
        <div className="turn-switch-screen">
          <div className="turn-switch-icon">🔄</div>
          <h2>{state.players[state.currentPlayerIndex].name} の番です</h2>
          <p>端末を渡してください</p>
          <button className="btn btn-primary" onClick={actions.confirmTurnSwitch}>準備OK</button>
        </div>
      );
    case PHASES.ROUND_RESULT:
      return <RoundResult players={state.players} roundScores={state.roundScores} gameRound={state.gameRound} onNextRound={actions.nextRound} onEndGame={actions.endGame} />;
    case PHASES.GAME_OVER:
      return <FinalResult players={state.players} onNewGame={actions.newGame} />;
    default:
      return <TitleScreen onNewGame={actions.goToSetup} onContinue={actions.loadSave} hasSave={hasSave} />;
  }
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading, login, register, logout } = useAuth();

  if (loading) return <div className="loading-page">読み込み中...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={
          user ? <Navigate to="/lobby" replace /> : <LoginPage onLogin={login} />
        } />
        <Route path="/register" element={
          user ? <Navigate to="/lobby" replace /> : <RegisterPage onRegister={register} />
        } />

        {/* Lobby & Room */}
        <Route path="/lobby" element={
          <ProtectedRoute user={user}>
            <LobbyPage user={user} onLogout={logout} />
          </ProtectedRoute>
        } />
        <Route path="/room/:roomId" element={
          <ProtectedRoute user={user}>
            <RoomPage user={user} />
          </ProtectedRoute>
        } />

        {/* Join (ログイン不要) */}
        <Route path="/join/:roomId/:token" element={
          <JoinPage />
        } />

        {/* Multiplayer Game (ゲスト参加可) */}
        <Route path="/play/:roomId" element={
          <GamePlayPage user={user} />
        } />

        {/* Local mode (traditional) */}
        <Route path="/local" element={<LocalGame />} />

        {/* Default: redirect to login or lobby */}
        <Route path="*" element={
          user ? <Navigate to="/lobby" replace /> : <Navigate to="/login" replace />
        } />
      </Routes>
    </BrowserRouter>
  );
}
