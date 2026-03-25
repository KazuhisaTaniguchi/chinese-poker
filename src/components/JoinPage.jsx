import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as authApi from '../authApi.js';

export default function JoinPage({ user, onLogin }) {
  const { roomId, token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // ログイン済み → 参加処理
    authApi.joinRoom(roomId, token)
      .then(data => {
        if (data.joined) {
          navigate(`/play/${roomId}`);
        }
        setInfo(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, roomId, token, navigate]);

  if (loading) return <div className="loading-page">参加中...</div>;

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">♠ チャイポー</h1>
          <p className="auth-subtitle">ゲームに招待されています</p>
          <p className="join-info">参加するにはログインしてください</p>
          <div className="join-buttons">
            <Link to={`/login?redirect=/join/${roomId}/${token}`} className="btn btn-primary auth-btn">
              ログイン
            </Link>
            <Link to={`/register?redirect=/join/${roomId}/${token}`} className="btn btn-outline auth-btn">
              新規登録
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="error-page">{error}</div>;
  if (info?.joined) return <div className="loading-page">ゲームに移動中...</div>;

  return <div className="loading-page">処理中...</div>;
}
