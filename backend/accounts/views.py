from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.utils.decorators import method_decorator
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    RoomSerializer, RoomCreateSerializer, PlayerSlotSerializer,
)
from .models import Room, PlayerSlot


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """新規ユーザー登録"""
    ser = RegisterSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    user = User.objects.create_user(
        username=ser.validated_data['username'],
        password=ser.validated_data['password'],
    )
    login(request, user)
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """ログイン"""
    ser = LoginSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    user = authenticate(
        request,
        username=ser.validated_data['username'],
        password=ser.validated_data['password'],
    )
    if not user:
        return Response(
            {'error': 'ユーザー名またはパスワードが正しくありません'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    login(request, user)
    return Response(UserSerializer(user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """ログアウト"""
    logout(request)
    return Response({'detail': 'ログアウトしました'})


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def me_view(request):
    """現在のユーザー情報"""
    if request.user.is_authenticated:
        return Response(UserSerializer(request.user).data)
    return Response({'user': None})


# ===== Room API =====

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def room_list(request):
    """ルーム一覧 / ルーム作成"""
    if request.method == 'GET':
        rooms = Room.objects.filter(host=request.user)
        return Response(RoomSerializer(rooms, many=True).data)

    ser = RoomCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    room = Room.objects.create(
        name=ser.validated_data['room_name'],
        host=request.user,
    )

    # 3人分のプレイヤー枠を作成
    player_names = ser.validated_data['player_names']
    for i, name in enumerate(player_names):
        slot = PlayerSlot.objects.create(
            room=room,
            name=name,
            order=i,
        )
        # 最初のスロットはホストに紐づけ
        if i == 0:
            slot.user = request.user
            slot.save()

    return Response(RoomSerializer(room).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def room_detail(request, room_id):
    """ルーム詳細"""
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        return Response({'error': 'ルームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    # トークンはホストのみ / 自分のスロットのみ表示
    data = RoomSerializer(room).data

    # 自分のスロット以外のトークンを隠す
    for slot in data['slots']:
        own_slot = room.slots.filter(user=request.user, order=slot['order']).exists()
        is_host = room.host == request.user
        if not is_host and not own_slot:
            slot.pop('token', None)

    return Response(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def room_delete(request, room_id):
    """ルーム削除 (ホストのみ)"""
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        return Response({'error': 'ルームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    if room.host != request.user:
        return Response({'error': '権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 関連ゲームも削除
    if room.game:
        room.game.delete()
    room.delete()
    return Response({'success': True}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def room_abort_game(request, room_id):
    """ゲーム中断 (ホストのみ)"""
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        return Response({'error': 'ルームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    if room.host != request.user:
        return Response({'error': '権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    if not room.game:
        return Response({'error': 'ゲームが開始されていません'}, status=status.HTTP_400_BAD_REQUEST)

    room.game.delete()
    room.game = None
    room.save()
    return Response({'success': True, 'message': 'ゲームを中断しました'})


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def room_join(request, room_id, token):
    """招待トークンでルームに参加 (ログイン不要)"""
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        return Response({'error': 'ルームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    try:
        slot = PlayerSlot.objects.get(room=room, token=token)
    except PlayerSlot.DoesNotExist:
        return Response({'error': '無効な招待リンクです'}, status=status.HTTP_400_BAD_REQUEST)

    # セッションにトークンを保存 (ゲスト認証用)
    request.session[f'room_{room_id}_token'] = str(token)
    request.session.save()

    # ログイン済みの場合はスロットに紐づけ
    if request.user.is_authenticated:
        if not slot.user or slot.user == request.user:
            slot.user = request.user
            slot.save()

    return Response({
        'room_id': str(room.id),
        'room_name': room.name,
        'slot_name': slot.name,
        'slot_order': slot.order,
        'joined': True,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def room_start_game(request, room_id):
    """ゲームを開始 (ホストのみ)"""
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        return Response({'error': 'ルームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    if room.host != request.user:
        return Response({'error': 'ホストのみ開始できます'}, status=status.HTTP_403_FORBIDDEN)

    if room.game:
        return Response({'error': '既にゲームが開始されています'}, status=status.HTTP_400_BAD_REQUEST)

    # game appのcreate_gameを呼ぶ
    from game.views import _create_game_internal
    player_names = list(room.slots.order_by('order').values_list('name', flat=True))
    game = _create_game_internal(player_names)

    room.game = game
    room.save()

    return Response(RoomSerializer(room).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def room_state(request, room_id):
    """ルームのゲーム状態取得 (ポーリング用 / ログイン不要)"""
    try:
        room = Room.objects.get(id=room_id)
    except Room.DoesNotExist:
        return Response({'error': 'ルームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    # プレイヤー特定: 1) ログインユーザー 2) トークン(クエリ) 3) セッション
    my_slot = None
    is_host = False

    if request.user.is_authenticated:
        my_slot = room.slots.filter(user=request.user).first()
        is_host = room.host == request.user

    if not my_slot:
        # クエリパラメータのトークンで特定
        token = request.query_params.get('token')
        if not token:
            # セッションから取得
            token = request.session.get(f'room_{room_id}_token')
        if token:
            my_slot = room.slots.filter(token=token).first()

    if not my_slot:
        return Response({'error': 'このルームの参加者ではありません'}, status=status.HTTP_403_FORBIDDEN)

    if not room.game:
        return Response({
            'game_started': False,
            'room': RoomSerializer(room).data,
            'my_player_index': my_slot.order,
        })

    from game.serializers import GameSerializer
    game_data = GameSerializer(room.game).data

    # ホストにはスロット情報（トークン含む）を返す
    slots_data = None
    if is_host:
        slots_data = PlayerSlotSerializer(room.slots.all(), many=True).data

    return Response({
        'game_started': True,
        'game': game_data,
        'my_player_index': my_slot.order,
        'is_host': is_host,
        'room_id': str(room.id),
        'slots': slots_data,
    })
