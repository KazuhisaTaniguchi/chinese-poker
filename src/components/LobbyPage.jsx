import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../authApi.js';

export default function LobbyPage({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [playerNames, setPlayerNames] = useState(['', '', '']);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const fetchRooms = () => {
    authApi.getRooms().then(setRooms).catch(() => {});
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    if (playerNames.some(n => !n.trim())) {
      setError('全員の名前を入力してください');
      return;
    }

    setCreating(true);
    try {
      const room = await authApi.createRoom(
        roomName || `${user.username}のルーム`,
        playerNames,
      );
      navigate(`/room/${room.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authApi.deleteRoom(deleteTarget.id);
      setDeleteTarget(null);
      fetchRooms();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const updatePlayerName = (index, value) => {
    const updated = [...playerNames];
    updated[index] = value;
    setPlayerNames(updated);
  };

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <h1 className="lobby-title">♠ チャイポー ロビー</h1>
        <div className="lobby-user">
          <span className="lobby-username">{user.username}</span>
          <button className="btn btn-sm btn-outline" onClick={onLogout}>ログアウト</button>
        </div>
      </div>

      {!showForm ? (
        <div className="lobby-actions">
          <button className="btn btn-primary btn-lg" onClick={() => setShowForm(true)}>
            🎮 ルームを作成
          </button>
        </div>
      ) : (
        <div className="lobby-create-form">
          <h2>ルーム作成</h2>
          <form onSubmit={handleCreate} className="auth-form">
            <div className="form-group">
              <label>ルーム名</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={`${user.username}のルーム`}
              />
            </div>

            <div className="player-names-group">
              <label>プレイヤー名 (3人)</label>
              {playerNames.map((name, i) => (
                <input
                  key={i}
                  type="text"
                  value={name}
                  onChange={(e) => updatePlayerName(i, e.target.value)}
                  placeholder={`プレイヤー${i + 1}の名前`}
                  required
                />
              ))}
            </div>

            {error && <div className="auth-error">{error}</div>}

            <div className="form-buttons">
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? '作成中...' : 'ゲーム作成'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {rooms.length > 0 && (
        <div className="lobby-rooms">
          <h2>あなたのルーム</h2>
          {rooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-card-main" onClick={() => navigate(`/room/${room.id}`)}>
                <span className="room-card-name">{room.name}</span>
                <span className="room-card-status">
                  {room.game_id ? '🎮 プレイ中' : '⏳ 待機中'}
                </span>
              </div>
              <button
                className="room-delete-btn"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(room); }}
                title="ルームを削除"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <h3>ルームの削除</h3>
            <p>「<strong>{deleteTarget.name}</strong>」を削除しますか？</p>
            <p className="delete-warning">この操作は取り消せません。ゲームデータも削除されます。</p>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setDeleteTarget(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
