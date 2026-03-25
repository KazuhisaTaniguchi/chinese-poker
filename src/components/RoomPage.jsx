import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as authApi from '../authApi.js';

export default function RoomPage({ user }) {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const navigate = useNavigate();

  const loadRoom = useCallback(async () => {
    try {
      const data = await authApi.getRoom(roomId);
      setRoom(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  // ゲーム開始済みならゲーム画面へ
  useEffect(() => {
    if (room?.game_id) {
      navigate(`/play/${roomId}`);
    }
  }, [room, roomId, navigate]);

  const handleStart = async () => {
    try {
      const data = await authApi.startGame(roomId);
      setRoom(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyInviteUrl = (slot) => {
    const url = `${window.location.origin}/join/${roomId}/${slot.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slot.order);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) return <div className="loading-page">読み込み中...</div>;
  if (error) return <div className="error-page">{error}</div>;
  if (!room) return null;

  const isHost = room.host_name === user.username;

  return (
    <div className="room-page">
      <div className="room-back-nav" style={{ marginBottom: '16px' }}>
        <button className="btn btn-sm btn-outline" onClick={() => navigate('/lobby')}>
          ↩ ロビーに戻る
        </button>
      </div>

      <div className="room-header">
        <h1 className="room-title">🏠 {room.name}</h1>
        <span className="room-host">ホスト: {room.host_name}</span>
      </div>

      <div className="room-slots">
        <h2>プレイヤー</h2>
        {room.slots.map(slot => (
          <div key={slot.order} className={`slot-card ${slot.username ? 'joined' : 'waiting'}`}>
            <div className="slot-info">
              <span className="slot-order">P{slot.order + 1}</span>
              <span className="slot-name">{slot.name}</span>
              <span className="slot-status">
                {slot.username ? `✅ ${slot.username}` : '⏳ 未参加'}
              </span>
            </div>
            {isHost && slot.token && !slot.username && (
              <button
                className="btn btn-sm btn-outline"
                onClick={() => copyInviteUrl(slot)}
              >
                {copied === slot.order ? '✅ コピー済み' : '📋 招待URLコピー'}
              </button>
            )}
          </div>
        ))}
      </div>

      {isHost && (
        <div className="room-actions">
          <button className="btn btn-primary btn-lg" onClick={handleStart}>
            🚀 ゲーム開始
          </button>
          <p className="room-note">※ 全員がログインしていなくてもゲームを開始できます</p>
        </div>
      )}
    </div>
  );
}
