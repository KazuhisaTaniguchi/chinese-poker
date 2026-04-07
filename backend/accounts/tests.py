"""
アカウント & ルーム API テスト

実行:
    python manage.py test accounts --settings=config.settings_test -v 2
"""
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from .models import Room, PlayerSlot


class TestAuthAPI(APITestCase):
    """認証エンドポイントのテスト"""

    def test_register_success(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'testuser',
            'password': 'pass1234',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], 'testuser')

    def test_register_duplicate_username(self):
        User.objects.create_user(username='existing', password='pass1234')
        response = self.client.post('/api/auth/register/', {
            'username': 'existing',
            'password': 'pass1234',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_password(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'testuser',
            'password': 'ab',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success(self):
        User.objects.create_user(username='alice', password='pass1234')
        response = self.client.post('/api/auth/login/', {
            'username': 'alice',
            'password': 'pass1234',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'alice')

    def test_login_wrong_password(self):
        User.objects.create_user(username='alice', password='pass1234')
        response = self.client.post('/api/auth/login/', {
            'username': 'alice',
            'password': 'wrongpass',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_success(self):
        user = User.objects.create_user(username='alice', password='pass1234')
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/auth/logout/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_logout_requires_auth(self):
        response = self.client.post('/api/auth/logout/', format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_me_authenticated(self):
        user = User.objects.create_user(username='alice', password='pass1234')
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'alice')

    def test_me_anonymous(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['user'])


class TestRoomAPI(APITestCase):
    """ルーム管理エンドポイントのテスト"""

    def setUp(self):
        self.host = User.objects.create_user(username='host', password='pass1234')
        self.other = User.objects.create_user(username='other', password='pass1234')
        self.client.force_authenticate(user=self.host)

    def _create_room(self, room_name='TestRoom', player_names=None):
        names = player_names or ['Alice', 'Bob']
        return self.client.post('/api/auth/rooms/', {
            'room_name': room_name,
            'player_names': names,
        }, format='json')

    def test_create_room_success(self):
        response = self._create_room()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'TestRoom')
        self.assertEqual(len(response.data['slots']), 2)

    def test_create_room_three_players(self):
        response = self._create_room(player_names=['Alice', 'Bob', 'Carol'])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['slots']), 3)

    def test_create_room_host_slot_assigned(self):
        response = self._create_room()
        # 最初のスロットがホストに紐づく
        first_slot = response.data['slots'][0]
        self.assertEqual(first_slot['username'], 'host')

    def test_list_rooms(self):
        self._create_room('Room1')
        self._create_room('Room2')
        response = self.client.get('/api/auth/rooms/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_get_room_detail(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        response = self.client.get(f'/api/auth/rooms/{room_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'TestRoom')

    def test_delete_room_by_host(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        response = self.client.delete(f'/api/auth/rooms/{room_id}/delete/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Room.objects.filter(id=room_id).exists())

    def test_delete_room_by_non_host_forbidden(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        self.client.force_authenticate(user=self.other)
        response = self.client.delete(f'/api/auth/rooms/{room_id}/delete/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_join_room_via_token(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        second_slot_token = create_response.data['slots'][1]['token']
        # 未認証のクライアントでトークン参加
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f'/api/auth/rooms/{room_id}/join/{second_slot_token}/',
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['joined'])

    def test_join_room_invalid_token(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        fake_token = '00000000-0000-0000-0000-000000000000'
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f'/api/auth/rooms/{room_id}/join/{fake_token}/',
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_start_game(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        response = self.client.post(f'/api/auth/rooms/{room_id}/start/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data['game_id'])

    def test_start_game_not_host(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        self.client.force_authenticate(user=self.other)
        response = self.client.post(f'/api/auth/rooms/{room_id}/start/', format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_abort_game(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        self.client.post(f'/api/auth/rooms/{room_id}/start/', format='json')
        response = self.client.post(f'/api/auth/rooms/{room_id}/abort/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        room = Room.objects.get(id=room_id)
        self.assertIsNone(room.game)

    def test_abort_game_no_game_started(self):
        create_response = self._create_room()
        room_id = create_response.data['id']
        response = self.client.post(f'/api/auth/rooms/{room_id}/abort/', format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_room_not_found(self):
        fake_id = '00000000-0000-0000-0000-000000000000'
        response = self.client.get(f'/api/auth/rooms/{fake_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_room_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/auth/rooms/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestRoomStateTokenAuth(APITestCase):
    """room_state のトークン認証（セッション切れ対応）テスト"""

    def setUp(self):
        self.host = User.objects.create_user(username='host', password='pass1234')
        self.client.force_authenticate(user=self.host)
        response = self.client.post('/api/auth/rooms/', {
            'room_name': 'TestRoom',
            'player_names': ['Alice', 'Bob'],
        }, format='json')
        self.room_id = response.data['id']
        self.host_slot_token = response.data['slots'][0]['token']
        self.guest_slot_token = response.data['slots'][1]['token']

    def test_room_state_returns_my_token_for_host(self):
        """ログイン済みホストの room_state に my_token が含まれる"""
        response = self.client.get(f'/api/auth/rooms/{self.room_id}/state/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('my_token', response.data)
        self.assertEqual(response.data['my_token'], self.host_slot_token)

    def test_room_state_returns_my_token_for_guest(self):
        """トークン参加ゲストの room_state にも my_token が含まれる"""
        self.client.force_authenticate(user=None)
        self.client.post(
            f'/api/auth/rooms/{self.room_id}/join/{self.guest_slot_token}/',
            format='json'
        )
        response = self.client.get(
            f'/api/auth/rooms/{self.room_id}/state/?token={self.guest_slot_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('my_token', response.data)
        self.assertEqual(response.data['my_token'], self.guest_slot_token)

    def test_room_state_accessible_via_token_without_session(self):
        """セッションなし（未認証）でもトークンがあれば room_state にアクセスできる"""
        self.client.force_authenticate(user=None)
        response = self.client.get(
            f'/api/auth/rooms/{self.room_id}/state/?token={self.host_slot_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['my_player_index'], 0)

    def test_room_state_host_identified_via_token(self):
        """トークン経由で特定したホストは is_host=True になる"""
        self.client.force_authenticate(user=None)
        # ゲームを開始してから is_host を確認する
        self.client.force_authenticate(user=self.host)
        self.client.post(f'/api/auth/rooms/{self.room_id}/start/', format='json')
        self.client.force_authenticate(user=None)
        response = self.client.get(
            f'/api/auth/rooms/{self.room_id}/state/?token={self.host_slot_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('is_host'))

    def test_room_state_without_auth_and_token_returns_403(self):
        """認証もトークンもない場合は 403"""
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/auth/rooms/{self.room_id}/state/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_room_state_invalid_token_returns_403(self):
        """無効なトークンは 403"""
        self.client.force_authenticate(user=None)
        fake_token = '00000000-0000-0000-0000-000000000000'
        response = self.client.get(
            f'/api/auth/rooms/{self.room_id}/state/?token={fake_token}'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
