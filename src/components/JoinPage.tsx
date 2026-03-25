import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as authApi from '../authApi';

/**
 * 招待URL経由参加ページ（ログイン不要）
 * トークンをlocalStorageに保存し、APIでjoinしてゲーム画面へ遷移
 */
export default function JoinPage() {
  const { roomId, token } = useParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // トークンをlocalStorageに保存
    localStorage.setItem(`room_${roomId}_token`, token);

    // joinリクエスト
    authApi.joinRoom(roomId, token)
      .then(data => {
        if (data.joined) {
          navigate(`/play/${roomId}`);
        }
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [roomId, token, navigate]);

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">♠ チャイポー</h1>
          <div className="auth-error">{error}</div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading-page">ゲームに参加中...</div>;

  return null;
}
