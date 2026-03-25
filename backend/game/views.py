from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Game, Player
from .serializers import (
    GameSerializer, GameCreateSerializer,
    PlaceCardSerializer, UndoSerializer,
)
from .logic.deck import create_deck, shuffle_deck, deal_cards
from .logic.rules import (
    can_place_card, is_board_complete,
    get_cards_to_deal, get_cards_to_discard,
    check_fantasyland_qualification, get_fantasyland_total_cards,
    get_fantasyland_discard_count, TOTAL_CARDS,
    NUM_PLAYERS,
)
from .logic.scoring import calculate_scores, check_foul, calculate_royalties
from rest_framework.permissions import AllowAny


def _create_game_internal(player_names):
    """内部用: ゲーム作成ロジック (Room APIからも呼ばれる)"""
    game = Game.objects.create(phase='placing', round_number=0, game_round=1)

    players = []
    for i, name in enumerate(player_names):
        players.append(Player.objects.create(
            game=game, name=name, order=i
        ))

    deck = shuffle_deck(create_deck())
    remaining = deck
    for player in players:
        result = deal_cards(remaining, 5)
        player.hand = result['dealt']
        # 初回ターン: ボードは空なのでロック状態も空
        player.locked_board = {'top': [], 'middle': [], 'bottom': []}
        player.save()
        remaining = result['remaining']

    game.deck = remaining
    game.save()
    return game


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def game_list(request):
    """GET: セーブ一覧, POST: 新規ゲーム作成"""
    if request.method == 'GET':
        games = Game.objects.exclude(phase='game_over')[:10]
        serializer = GameSerializer(games, many=True)
        return Response(serializer.data)

    ser = GameCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    player_names = ser.validated_data['player_names']

    game = _create_game_internal(player_names)

    return Response(GameSerializer(game).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def game_detail(request, game_id):
    """ゲーム状態取得"""
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'ゲームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    return Response(GameSerializer(game).data)


@api_view(['POST'])
def place_card(request, game_id):
    """カード配置"""
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'ゲームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    if game.phase != 'placing':
        return Response({'error': '配置フェーズではありません'}, status=status.HTTP_400_BAD_REQUEST)

    ser = PlaceCardSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    card_id = ser.validated_data['card_id']
    row = ser.validated_data['row']

    player = game.players.filter(order=game.current_player_index).first()
    if not player:
        return Response({'error': 'プレイヤーが見つかりません'}, status=status.HTTP_400_BAD_REQUEST)

    # 手札からカードを探す
    card = None
    for c in player.hand:
        if c['id'] == card_id:
            card = c
            break

    if not card:
        return Response({'error': 'カードが見つかりません'}, status=status.HTTP_400_BAD_REQUEST)

    # 配置可能か確認
    board = player.get_board()
    if not can_place_card(board, row):
        return Response({'error': 'この列は満杯です'}, status=status.HTTP_400_BAD_REQUEST)

    # 配置
    board[row].append(card)
    player.set_board(board)
    player.hand = [c for c in player.hand if c['id'] != card_id]
    player.save()

    return Response(GameSerializer(game).data)


@api_view(['POST'])
def undo_place(request, game_id):
    """配置を元に戻す"""
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'ゲームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    ser = UndoSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    row = ser.validated_data['row']
    card_id = ser.validated_data.get('card_id')

    player = game.players.filter(order=game.current_player_index).first()
    board = player.get_board()

    if not board[row]:
        return Response({'error': 'この列にカードがありません'}, status=status.HTTP_400_BAD_REQUEST)

    # ロック済みカードのIDセット
    locked = player.locked_board or {'top': [], 'middle': [], 'bottom': []}
    locked_ids = set()
    for r in ['top', 'middle', 'bottom']:
        for c in locked.get(r, []):
            locked_ids.add(c['id'])

    # 特定のカードを指定された場合はそのカードを、なければ最後のカードを戻す
    if card_id:
        # ロック済みカードは移動不可
        if card_id in locked_ids:
            return Response({'error': 'このカードは前のターンで配置済みのため動かせません'}, status=status.HTTP_400_BAD_REQUEST)
        removed_card = None
        for i, c in enumerate(board[row]):
            if c['id'] == card_id:
                removed_card = board[row].pop(i)
                break
        if not removed_card:
            return Response({'error': 'カードが見つかりません'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        # 最後のカードがロック済みかチェック
        last_card = board[row][-1]
        if last_card['id'] in locked_ids:
            return Response({'error': 'このカードは前のターンで配置済みのため動かせません'}, status=status.HTTP_400_BAD_REQUEST)
        removed_card = board[row].pop()

    player.set_board(board)
    player.hand = player.hand + [removed_card]
    player.save()

    return Response(GameSerializer(game).data)


def _get_discard_count_for_player(player, game):
    """プレイヤーの現在の捨て札枚数を取得"""
    if player.in_fantasyland:
        return get_fantasyland_discard_count(player.fantasyland_bonus)
    return get_cards_to_discard(game.round_number)


def _get_next_player_index(game, current_index):
    """次のプレイヤーを取得
    - ボード完成済みプレイヤーをスキップ
    - 非ファンタジーランドプレイヤーがまだ残っている場合、FLプレイヤーはスキップ
    """
    all_players = list(game.players.order_by('order'))

    # 非ファンタジーランドプレイヤーで手札が残っている人がいるか
    non_fl_remaining = any(
        p.hand and not p.in_fantasyland
        for p in all_players
    )

    for i in range(1, NUM_PLAYERS + 1):
        next_idx = (current_index + i) % NUM_PLAYERS
        next_player = all_players[next_idx]

        # ボード完成済みで手札なし → スキップ
        if not next_player.hand and is_board_complete(next_player.get_board()):
            continue

        # 非ファンタジーランドがまだ残っているなら、FLプレイヤーは後回し
        if non_fl_remaining and next_player.in_fantasyland:
            continue

        return next_idx

    return (current_index + 1) % NUM_PLAYERS


@api_view(['POST'])
def confirm_placement(request, game_id):
    """配置確定 → ターン進行 (パイナップルOFC + ファンタジーランド対応)"""
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'ゲームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    player = game.players.filter(order=game.current_player_index).first()
    discard_count = _get_discard_count_for_player(player, game)

    # 手札残り枚数が捨て札枚数と一致しているか
    if len(player.hand) != discard_count:
        placed = sum(len(v) for v in player.get_board().values())
        remaining_to_place = TOTAL_CARDS - placed
        return Response(
            {'error': f'あと{remaining_to_place}枚配置してください'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 捨て札を処理
    if discard_count > 0:
        player.hand = []
        player.save()

    # ファンタジーランドプレイヤーはこの時点でボード完成
    if player.in_fantasyland:
        player.in_fantasyland = False
        player.fantasyland_bonus = 0
        player.save()

    # 全プレイヤーの配置完了チェック
    all_placed = all(not p.hand for p in game.players.all())

    if not all_placed:
        # 次のプレイヤーへ
        next_idx = _get_next_player_index(game, game.current_player_index)
        game.current_player_index = next_idx
        game.phase = 'turn_switch'
        game.save()
        return Response(GameSerializer(game).data)

    # 全員完了 → ボード埋まりチェック
    all_complete = all(
        is_board_complete(p.get_board()) for p in game.players.all()
    )

    if all_complete:
        # ラウンド終了 → スコア計算 + ファンタジーランド判定
        boards = game.get_all_boards()
        round_scores = calculate_scores(boards)
        game.round_scores = round_scores

        for i, p in enumerate(game.players.order_by('order')):
            p.total_score += round_scores[i]

            # ファンタジーランド判定 (ファウルでない場合のみ)
            if not check_foul(p.get_board()):
                bonus = check_fantasyland_qualification(p.board_top)
                if bonus > 0:
                    p.in_fantasyland = True
                    p.fantasyland_bonus = bonus
            p.save()

        game.phase = 'round_result'
        game.save()
        return Response(GameSerializer(game).data)

    # 次のカード配布ラウンド
    game.round_number += 1
    remaining = game.deck

    for p in game.players.order_by('order'):
        # ファンタジーランドで既にボード完成済みならスキップ
        if is_board_complete(p.get_board()):
            continue
        result = deal_cards(remaining, get_cards_to_deal(game.round_number))
        p.hand = result['dealt']
        # 現在のボードをロック (このターンで配置済みカードは移動不可に)
        p.locked_board = p.get_board()
        p.save()
        remaining = result['remaining']

    game.deck = remaining
    # 非FLプレイヤーから開始、FLは最後
    start_idx = game.dealer_index
    found = False
    # まず非FLプレイヤーを探す
    for i in range(NUM_PLAYERS):
        idx = (game.dealer_index + i) % NUM_PLAYERS
        p = game.players.filter(order=idx).first()
        if p and p.hand and not p.in_fantasyland:
            start_idx = idx
            found = True
            break
    # 非FLがいなければ手札ありのプレイヤーから
    if not found:
        for i in range(NUM_PLAYERS):
            idx = (game.dealer_index + i) % NUM_PLAYERS
            p = game.players.filter(order=idx).first()
            if p and p.hand:
                start_idx = idx
                break
    game.current_player_index = start_idx
    game.phase = 'placing'
    game.save()

    return Response(GameSerializer(game).data)


@api_view(['POST'])
def confirm_turn_switch(request, game_id):
    """ターン切替確認 → プレイ画面へ"""
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'ゲームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    if game.phase != 'turn_switch':
        return Response({'error': 'ターン切替フェーズではありません'}, status=status.HTTP_400_BAD_REQUEST)

    game.phase = 'placing'
    game.save()

    return Response(GameSerializer(game).data)


@api_view(['POST'])
def next_round(request, game_id):
    """次ラウンド開始 (ファンタジーランド対応)"""
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'ゲームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    # デッキリセット
    deck = shuffle_deck(create_deck())
    game.dealer_index = (game.dealer_index + 1) % NUM_PLAYERS
    game.round_number = 0
    game.game_round += 1
    game.round_scores = []

    # プレイヤーのボード・手札リセット & カード配布
    remaining = deck
    for player in game.players.order_by('order'):
        player.board_top = []
        player.board_middle = []
        player.board_bottom = []

        if player.in_fantasyland:
            # ファンタジーランド: 全カードを一度に配布
            total = get_fantasyland_total_cards(player.fantasyland_bonus)
            result = deal_cards(remaining, total)
        else:
            # 通常: 5枚配布
            result = deal_cards(remaining, 5)

        player.hand = result['dealt']
        player.save()
        remaining = result['remaining']

    game.deck = remaining

    # 非ファンタジーランドプレイヤーから開始（FLプレイヤーは最後）
    start_idx = game.dealer_index
    # まず非FLプレイヤーを探す
    found_non_fl = False
    for i in range(NUM_PLAYERS):
        idx = (game.dealer_index + i) % NUM_PLAYERS
        p = game.players.filter(order=idx).first()
        if p and p.hand and not p.in_fantasyland:
            start_idx = idx
            found_non_fl = True
            break

    # 非FLがいなければFLプレイヤーから
    if not found_non_fl:
        for i in range(NUM_PLAYERS):
            idx = (game.dealer_index + i) % NUM_PLAYERS
            p = game.players.filter(order=idx).first()
            if p and p.hand:
                start_idx = idx
                break

    game.current_player_index = start_idx
    game.phase = 'placing'
    game.save()

    return Response(GameSerializer(game).data)


@api_view(['POST'])
def end_game(request, game_id):
    """ゲーム終了"""
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'ゲームが見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    game.phase = 'game_over'
    game.save()

    return Response(GameSerializer(game).data)
