/**
 * 認証・ルーム API
 */

const API_BASE = '/api/auth';

async function authRequest(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };

  // CSRFトークン取得
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  if (csrfToken) {
    options.headers['X-CSRFToken'] = csrfToken;
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

// Auth
export function register(username, password) {
  return authRequest('POST', '/register/', { username, password });
}

export function login(username, password) {
  return authRequest('POST', '/login/', { username, password });
}

export function logout() {
  return authRequest('POST', '/logout/');
}

export function getMe() {
  return authRequest('GET', '/me/');
}

// Rooms
export function getRooms() {
  return authRequest('GET', '/rooms/');
}

export function createRoom(roomName, playerNames) {
  return authRequest('POST', '/rooms/', { room_name: roomName, player_names: playerNames });
}

export function getRoom(roomId) {
  return authRequest('GET', `/rooms/${roomId}/`);
}

export function joinRoom(roomId, token) {
  return authRequest('POST', `/rooms/${roomId}/join/${token}/`);
}

export function startGame(roomId) {
  return authRequest('POST', `/rooms/${roomId}/start/`);
}

export function getRoomState(roomId) {
  // ゲストの場合、localStorageのトークンをクエリパラメータとして送信
  const token = localStorage.getItem(`room_${roomId}_token`);
  const tokenParam = token ? `?token=${token}` : '';
  return authRequest('GET', `/rooms/${roomId}/state/${tokenParam}`);
}
