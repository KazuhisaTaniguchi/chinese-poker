/**
 * API通信ヘルパー
 * バックエンド (Django) への全リクエストを管理
 */

const API_BASE = '/api';

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  const headers = options.headers as Record<string, string>;
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ゲーム一覧取得
export function getGames() {
  return request('GET', '/games/');
}

// 新規ゲーム作成
export function createGame(playerNames) {
  return request('POST', '/games/', { player_names: playerNames });
}

// ゲーム状態取得
export function getGame(gameId) {
  return request('GET', `/games/${gameId}/`);
}

// カード配置
export function placeCard(gameId, cardId, row) {
  return request('POST', `/games/${gameId}/place/`, { card_id: cardId, row });
}

// 元に戻す (card_id指定で特定カードを戻す)
export function undoPlace(gameId, row, cardId = null) {
  const body: Record<string, any> = { row };
  if (cardId) body.card_id = cardId;
  return request('POST', `/games/${gameId}/undo/`, body);
}

// 配置確定
export function confirmPlacement(gameId) {
  return request('POST', `/games/${gameId}/confirm/`);
}

// ターン切替確認
export function confirmTurnSwitch(gameId) {
  return request('POST', `/games/${gameId}/confirm-turn/`);
}

// 次ラウンド
export function nextRound(gameId) {
  return request('POST', `/games/${gameId}/next-round/`);
}

// ゲーム終了
export function endGame(gameId) {
  return request('POST', `/games/${gameId}/end/`);
}
