"""OFC パイナップルルール定数・バリデーション"""
from collections import Counter

ROW_LIMITS = {
    'top': 3,
    'middle': 5,
    'bottom': 5,
}

TOTAL_CARDS = 13
INITIAL_DEAL = 5
SUBSEQUENT_DEAL = 3       # パイナップル: 3枚配布
CARDS_TO_PLACE = 2        # パイナップル: 2枚配置
CARDS_TO_DISCARD = 1      # パイナップル: 1枚捨て
TOTAL_ROUNDS = 5          # 初回 + 4ラウンド (5 + 2*4 = 13枚)
NUM_PLAYERS = 3


def can_place_card(board, row):
    """指定の列にカードを配置できるか"""
    return len(board.get(row, [])) < ROW_LIMITS[row]


def is_board_complete(board):
    """ボードが完成しているか"""
    return (
        len(board.get('top', [])) == ROW_LIMITS['top'] and
        len(board.get('middle', [])) == ROW_LIMITS['middle'] and
        len(board.get('bottom', [])) == ROW_LIMITS['bottom']
    )


def get_cards_to_deal(round_number):
    """現在のラウンドで配る枚数"""
    return INITIAL_DEAL if round_number == 0 else SUBSEQUENT_DEAL


def get_cards_to_place(round_number):
    """現在のラウンドで配置すべき枚数"""
    return INITIAL_DEAL if round_number == 0 else CARDS_TO_PLACE


def get_cards_to_discard(round_number):
    """現在のラウンドで捨てる枚数"""
    return 0 if round_number == 0 else CARDS_TO_DISCARD


# ===== ファンタジーランド =====

# 上段の役 → ボーナスカード枚数
FANTASYLAND_BONUS = {
    'QQ': 9,   # クイーンのペア → 5 + 9 = 14枚
    'KK': 10,  # キングのペア → 5 + 10 = 15枚
    'AA': 11,  # エースのペア → 5 + 11 = 16枚
    'TRIPS': 12,  # トリップス → 5 + 12 = 17枚
}


def check_fantasyland_qualification(top_cards):
    """上段のカードからファンタジーランド判定
    
    Returns:
        int: ボーナス枚数 (0 = 不成立)
    """
    if len(top_cards) != 3:
        return 0

    from .deck import RANK_VALUES
    rank_counts = Counter(c['rank'] for c in top_cards)
    
    # トリップス判定
    for rank, count in rank_counts.items():
        if count == 3:
            return FANTASYLAND_BONUS['TRIPS']
    
    # ペア判定 (QQ, KK, AA)
    for rank, count in rank_counts.items():
        if count >= 2:
            value = RANK_VALUES.get(rank, 0)
            if value == 12:  # Q
                return FANTASYLAND_BONUS['QQ']
            elif value == 13:  # K
                return FANTASYLAND_BONUS['KK']
            elif value == 14:  # A
                return FANTASYLAND_BONUS['AA']
    
    return 0


def check_fantasyland_continuation(board):
    """ファンタジーランド継続判定
    - ボトムがフォーカード (rank >= 7) 以上
    - またはトップがスリーカード (rank == 3)
    を満たせば継続 (True) を返す
    """
    from .hand import evaluate_hand
    
    bottom_eval = evaluate_hand(board.get('bottom', []))
    if bottom_eval['rank'] >= 7:
        return True

    top_eval = evaluate_hand(board.get('top', []))
    if top_eval['rank'] == 3:
        return True

    return False


def get_fantasyland_total_cards(bonus):
    """ファンタジーランドの合計カード枚数"""
    return INITIAL_DEAL + bonus


def get_fantasyland_discard_count(bonus):
    """ファンタジーランドの捨て札枚数"""
    return get_fantasyland_total_cards(bonus) - TOTAL_CARDS
