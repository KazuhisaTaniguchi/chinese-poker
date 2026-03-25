"""ポーカーハンドの評価"""
from collections import Counter
from .deck import RANK_VALUES

# ハンドランク定数
HAND_RANKS = {
    'HIGH_CARD': 0,
    'ONE_PAIR': 1,
    'TWO_PAIR': 2,
    'THREE_OF_A_KIND': 3,
    'STRAIGHT': 4,
    'FLUSH': 5,
    'FULL_HOUSE': 6,
    'FOUR_OF_A_KIND': 7,
    'STRAIGHT_FLUSH': 8,
    'ROYAL_FLUSH': 9,
}

HAND_NAMES = {
    0: 'ハイカード',
    1: 'ワンペア',
    2: 'ツーペア',
    3: 'スリーカード',
    4: 'ストレート',
    5: 'フラッシュ',
    6: 'フルハウス',
    7: 'フォーカード',
    8: 'ストレートフラッシュ',
    9: 'ロイヤルフラッシュ',
}


def _get_rank_value(rank):
    return RANK_VALUES.get(rank, 0)


def _sort_by_rank(cards):
    return sorted(cards, key=lambda c: _get_rank_value(c['rank']), reverse=True)


def _is_flush(cards):
    if len(cards) < 3:
        return False
    return all(c['suit'] == cards[0]['suit'] for c in cards)


def _is_straight(cards):
    if len(cards) < 3:
        return False
    values = [_get_rank_value(c['rank']) for c in _sort_by_rank(cards)]

    # A-2-3-4-5 (ホイール)
    if len(cards) == 5 and values == [14, 5, 4, 3, 2]:
        return True

    for i in range(len(values) - 1):
        if values[i] - values[i + 1] != 1:
            return False
    return True


def evaluate_hand(cards):
    """ハンドを評価 (3枚のトップ行にも対応)"""
    if not cards:
        return {'rank': 0, 'values': [], 'kickers': []}

    sorted_cards = _sort_by_rank(cards)
    rank_counts = Counter(c['rank'] for c in cards)
    group_sizes = sorted(rank_counts.values(), reverse=True)
    flush = _is_flush(cards)
    straight = _is_straight(cards)
    values = [_get_rank_value(c['rank']) for c in sorted_cards]

    # ホイールストレート
    if straight and values[0] == 14 and values[-1] == 2 and len(cards) == 5:
        values = [5, 4, 3, 2, 1]

    # 5枚の場合のみストレート/フラッシュ系
    if len(cards) == 5:
        if straight and flush:
            if values[0] == 14 and values[1] == 13:
                return {'rank': 9, 'values': values, 'kickers': []}  # Royal Flush
            return {'rank': 8, 'values': values, 'kickers': []}  # Straight Flush
        if flush:
            return {'rank': 5, 'values': values, 'kickers': []}
        if straight:
            return {'rank': 4, 'values': values, 'kickers': []}

    # ペア系
    if group_sizes[0] == 4:
        quad_rank = [r for r, c in rank_counts.items() if c == 4][0]
        kickers = [_get_rank_value(c['rank']) for c in sorted_cards if c['rank'] != quad_rank]
        return {'rank': 7, 'values': [_get_rank_value(quad_rank)], 'kickers': kickers}

    if group_sizes[0] == 3 and len(group_sizes) > 1 and group_sizes[1] == 2:
        triple_rank = [r for r, c in rank_counts.items() if c == 3][0]
        pair_rank = [r for r, c in rank_counts.items() if c == 2][0]
        return {'rank': 6, 'values': [_get_rank_value(triple_rank), _get_rank_value(pair_rank)], 'kickers': []}

    if group_sizes[0] == 3:
        triple_rank = [r for r, c in rank_counts.items() if c == 3][0]
        kickers = [_get_rank_value(c['rank']) for c in sorted_cards if c['rank'] != triple_rank]
        return {'rank': 3, 'values': [_get_rank_value(triple_rank)], 'kickers': kickers}

    if group_sizes[0] == 2 and len(group_sizes) > 1 and group_sizes[1] == 2:
        pair_ranks = sorted(
            [_get_rank_value(r) for r, c in rank_counts.items() if c == 2],
            reverse=True
        )
        kickers = [_get_rank_value(c['rank']) for c in sorted_cards
                    if _get_rank_value(c['rank']) not in pair_ranks]
        return {'rank': 2, 'values': pair_ranks, 'kickers': kickers}

    if group_sizes[0] == 2:
        pair_rank = [r for r, c in rank_counts.items() if c == 2][0]
        kickers = [_get_rank_value(c['rank']) for c in sorted_cards if c['rank'] != pair_rank]
        return {'rank': 1, 'values': [_get_rank_value(pair_rank)], 'kickers': kickers}

    return {'rank': 0, 'values': values, 'kickers': []}


def compare_hands(eval1, eval2):
    """2つのハンド評価を比較。正: eval1の勝ち、負: eval2の勝ち、0: 引き分け"""
    if eval1['rank'] != eval2['rank']:
        return eval1['rank'] - eval2['rank']

    for v1, v2 in zip(eval1['values'], eval2['values']):
        if v1 != v2:
            return v1 - v2

    for k1, k2 in zip(eval1['kickers'], eval2['kickers']):
        if k1 != k2:
            return k1 - k2

    return 0


def get_hand_name(evaluation):
    """役名を取得"""
    return HAND_NAMES.get(evaluation['rank'], 'ハイカード')
