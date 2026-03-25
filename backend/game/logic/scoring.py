"""スコアリング・ロイヤリティ・ファウル判定"""
from .hand import evaluate_hand, compare_hands
from .rules import is_board_complete


def _get_top_royalties(cards):
    """トップ行 (3枚) のロイヤリティ"""
    if len(cards) < 3:
        return 0
    eval_ = evaluate_hand(cards)

    if eval_['rank'] == 3:  # THREE_OF_A_KIND
        return 10 + eval_['values'][0]

    if eval_['rank'] == 1:  # ONE_PAIR
        pair_value = eval_['values'][0]
        if pair_value >= 6:
            return pair_value - 5

    return 0


def _get_middle_royalties(cards):
    """ミドル行 (5枚) のロイヤリティ"""
    if len(cards) < 5:
        return 0
    eval_ = evaluate_hand(cards)

    royalties = {3: 2, 4: 4, 5: 8, 6: 12, 7: 20, 8: 30, 9: 50}
    return royalties.get(eval_['rank'], 0)


def _get_bottom_royalties(cards):
    """ボトム行 (5枚) のロイヤリティ"""
    if len(cards) < 5:
        return 0
    eval_ = evaluate_hand(cards)

    royalties = {4: 2, 5: 4, 6: 6, 7: 10, 8: 15, 9: 25}
    return royalties.get(eval_['rank'], 0)


def calculate_royalties(board):
    """ロイヤリティ計算"""
    top = _get_top_royalties(board.get('top', []))
    middle = _get_middle_royalties(board.get('middle', []))
    bottom = _get_bottom_royalties(board.get('bottom', []))
    return {
        'top': top,
        'middle': middle,
        'bottom': bottom,
        'total': top + middle + bottom,
    }


def check_foul(board):
    """ファウル判定: Bottom ≥ Middle ≥ Top の強さ順守チェック"""
    if not is_board_complete(board):
        return False

    top_eval = evaluate_hand(board['top'])
    middle_eval = evaluate_hand(board['middle'])
    bottom_eval = evaluate_hand(board['bottom'])

    if compare_hands(bottom_eval, middle_eval) < 0:
        return True
    if compare_hands(middle_eval, top_eval) < 0:
        return True

    return False


def _calculate_head_to_head(p1_board, p2_board):
    """2人のプレイヤー間のスコア計算"""
    p1_foul = check_foul(p1_board)
    p2_foul = check_foul(p2_board)

    if p1_foul and p2_foul:
        return 0, 0

    if p1_foul:
        p2_royalties = calculate_royalties(p2_board)
        return -6 - p2_royalties['total'], 6 + p2_royalties['total']

    if p2_foul:
        p1_royalties = calculate_royalties(p1_board)
        return 6 + p1_royalties['total'], -6 - p1_royalties['total']

    p1_score = 0
    p2_score = 0
    p1_wins = 0

    for row in ['top', 'middle', 'bottom']:
        eval1 = evaluate_hand(p1_board[row])
        eval2 = evaluate_hand(p2_board[row])
        result = compare_hands(eval1, eval2)

        if result > 0:
            p1_score += 1
            p1_wins += 1
        elif result < 0:
            p2_score += 1

    # スクーピングボーナス
    if p1_wins == 3:
        p1_score += 3
    elif p1_wins == 0:
        p2_score += 3

    # ロイヤリティ
    p1_royalties = calculate_royalties(p1_board)
    p2_royalties = calculate_royalties(p2_board)

    p1_score += p1_royalties['total'] - p2_royalties['total']
    p2_score += p2_royalties['total'] - p1_royalties['total']

    return p1_score, p2_score


def calculate_scores(boards):
    """3人のプレイヤーのボード間のスコア計算"""
    scores = [0] * len(boards)

    for i in range(len(boards)):
        for j in range(i + 1, len(boards)):
            s1, s2 = _calculate_head_to_head(boards[i], boards[j])
            scores[i] += s1
            scores[j] += s2

    return scores
