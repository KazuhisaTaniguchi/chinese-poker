"""
OFC Poker バックエンド ユニット & API テスト

実行:
    python manage.py test game --settings=config.settings_test -v 2
"""
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth.models import User

from .logic.deck import create_deck, shuffle_deck, deal_cards, SUITS, RANKS
from .logic.hand import evaluate_hand, compare_hands, get_hand_name, HAND_RANKS
from .logic.rules import (
    can_place_card, is_board_complete,
    get_cards_to_deal, get_cards_to_place, get_cards_to_discard,
    check_fantasyland_qualification, check_fantasyland_continuation,
    get_fantasyland_total_cards, get_fantasyland_discard_count,
    FANTASYLAND_BONUS,
)
from .logic.scoring import (
    calculate_royalties, check_foul, calculate_scores,
    _get_top_royalties, _get_middle_royalties, _get_bottom_royalties,
    _calculate_head_to_head,
)
from .models import Game, Player


# ===== ヘルパー =====

def c(rank, suit='♠'):
    """テスト用カード生成"""
    return {'rank': rank, 'suit': suit, 'id': f'{rank}{suit}'}


def make_board(top=None, middle=None, bottom=None):
    return {
        'top': top or [],
        'middle': middle or [],
        'bottom': bottom or [],
    }


# ===== デッキ =====

class TestDeck(TestCase):
    def test_create_deck_has_52_cards(self):
        deck = create_deck()
        self.assertEqual(len(deck), 52)

    def test_create_deck_all_suits_and_ranks(self):
        deck = create_deck()
        ids = {card['id'] for card in deck}
        for suit in SUITS:
            for rank in RANKS:
                self.assertIn(f'{rank}{suit}', ids)

    def test_create_deck_unique_cards(self):
        deck = create_deck()
        ids = [card['id'] for card in deck]
        self.assertEqual(len(ids), len(set(ids)))

    def test_shuffle_returns_same_cards(self):
        deck = create_deck()
        shuffled = shuffle_deck(deck)
        self.assertEqual(len(shuffled), 52)
        self.assertEqual(
            sorted(d['id'] for d in deck),
            sorted(d['id'] for d in shuffled)
        )

    def test_shuffle_does_not_modify_original(self):
        deck = create_deck()
        original_first = deck[0]['id']
        shuffle_deck(deck)
        self.assertEqual(deck[0]['id'], original_first)

    def test_deal_cards_count(self):
        deck = create_deck()
        result = deal_cards(deck, 5)
        self.assertEqual(len(result['dealt']), 5)

    def test_deal_cards_remaining(self):
        deck = create_deck()
        result = deal_cards(deck, 5)
        self.assertEqual(len(result['remaining']), 47)

    def test_deal_cards_no_overlap(self):
        deck = create_deck()
        result = deal_cards(deck, 13)
        dealt_ids = {card['id'] for card in result['dealt']}
        remaining_ids = {card['id'] for card in result['remaining']}
        self.assertEqual(len(dealt_ids & remaining_ids), 0)


# ===== ハンド評価 (3枚) =====

class TestHandEvaluation3Card(TestCase):
    def test_high_card(self):
        cards = [c('A'), c('K', '♥'), c('J', '♦')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['HIGH_CARD'])

    def test_one_pair(self):
        cards = [c('A'), c('A', '♥'), c('K', '♦')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['ONE_PAIR'])
        self.assertEqual(result['values'], [14])

    def test_three_of_a_kind(self):
        cards = [c('A'), c('A', '♥'), c('A', '♦')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['THREE_OF_A_KIND'])
        self.assertEqual(result['values'], [14])


# ===== ハンド評価 (5枚) =====

class TestHandEvaluation5Card(TestCase):
    def test_high_card(self):
        cards = [c('A'), c('K', '♥'), c('J', '♦'), c('9', '♣'), c('7', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['HIGH_CARD'])

    def test_one_pair(self):
        cards = [c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['ONE_PAIR'])
        self.assertEqual(result['values'], [14])

    def test_two_pair(self):
        cards = [c('A'), c('A', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['TWO_PAIR'])
        self.assertEqual(result['values'], [14, 13])

    def test_three_of_a_kind(self):
        cards = [c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['THREE_OF_A_KIND'])

    def test_straight(self):
        cards = [c('5'), c('6', '♥'), c('7', '♦'), c('8', '♣'), c('9', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['STRAIGHT'])

    def test_wheel_straight(self):
        """A-2-3-4-5 ホイールストレート"""
        cards = [c('A'), c('2', '♥'), c('3', '♦'), c('4', '♣'), c('5', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['STRAIGHT'])
        self.assertEqual(result['values'], [5, 4, 3, 2, 1])

    def test_flush(self):
        cards = [c('A'), c('K'), c('J'), c('9'), c('7')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['FLUSH'])

    def test_full_house(self):
        cards = [c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('K', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['FULL_HOUSE'])
        self.assertEqual(result['values'], [14, 13])

    def test_four_of_a_kind(self):
        cards = [c('A'), c('A', '♥'), c('A', '♦'), c('A', '♣'), c('K', '♠')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['FOUR_OF_A_KIND'])
        self.assertEqual(result['values'], [14])

    def test_straight_flush(self):
        cards = [c('5'), c('6'), c('7'), c('8'), c('9')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['STRAIGHT_FLUSH'])

    def test_royal_flush(self):
        cards = [c('10'), c('J'), c('Q'), c('K'), c('A')]
        result = evaluate_hand(cards)
        self.assertEqual(result['rank'], HAND_RANKS['ROYAL_FLUSH'])

    def test_no_straight_flush_for_3_cards(self):
        """3枚ではストレートフラッシュにならない"""
        cards = [c('5'), c('6'), c('7')]
        result = evaluate_hand(cards)
        self.assertNotIn(result['rank'], [
            HAND_RANKS['STRAIGHT_FLUSH'],
            HAND_RANKS['FLUSH'],
            HAND_RANKS['STRAIGHT'],
        ])


# ===== ハンド比較 =====

class TestHandComparison(TestCase):
    def test_higher_rank_wins(self):
        flush = evaluate_hand([c('A'), c('K'), c('J'), c('9'), c('7')])
        straight = evaluate_hand([c('5'), c('6', '♥'), c('7', '♦'), c('8', '♣'), c('9', '♠')])
        self.assertGreater(compare_hands(flush, straight), 0)

    def test_same_rank_higher_value_wins(self):
        pair_aces = evaluate_hand([c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')])
        pair_kings = evaluate_hand([c('K'), c('K', '♥'), c('A', '♦'), c('Q', '♣'), c('J', '♠')])
        self.assertGreater(compare_hands(pair_aces, pair_kings), 0)

    def test_same_pair_kicker_decides(self):
        pair_a_k = evaluate_hand([c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')])
        pair_a_q = evaluate_hand([c('A'), c('A', '♥'), c('Q', '♦'), c('J', '♣'), c('9', '♠')])
        self.assertGreater(compare_hands(pair_a_k, pair_a_q), 0)

    def test_identical_hands_tie(self):
        hand1 = evaluate_hand([c('A'), c('K', '♥'), c('J', '♦'), c('9', '♣'), c('7', '♠')])
        hand2 = evaluate_hand([c('A', '♥'), c('K', '♦'), c('J', '♣'), c('9', '♠'), c('7', '♥')])
        self.assertEqual(compare_hands(hand1, hand2), 0)

    def test_lower_rank_loses(self):
        trips = evaluate_hand([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')])
        two_pair = evaluate_hand([c('A'), c('A', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')])
        self.assertLess(compare_hands(two_pair, trips), 0)


# ===== ハンド名 =====

class TestHandName(TestCase):
    def test_hand_names_all_ranks(self):
        expected = {
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
        for rank, name in expected.items():
            result = get_hand_name({'rank': rank, 'values': [], 'kickers': []})
            self.assertEqual(result, name)


# ===== ルール =====

class TestRules(TestCase):
    def test_can_place_card_empty_row(self):
        board = make_board()
        self.assertTrue(can_place_card(board, 'top'))
        self.assertTrue(can_place_card(board, 'middle'))
        self.assertTrue(can_place_card(board, 'bottom'))

    def test_can_place_card_partial_row(self):
        board = make_board(top=[c('A'), c('K', '♥')])
        self.assertTrue(can_place_card(board, 'top'))

    def test_cannot_place_card_full_top(self):
        board = make_board(top=[c('A'), c('K', '♥'), c('Q', '♦')])
        self.assertFalse(can_place_card(board, 'top'))

    def test_cannot_place_card_full_middle(self):
        board = make_board(middle=[c('A'), c('K', '♥'), c('Q', '♦'), c('J', '♣'), c('10', '♠')])
        self.assertFalse(can_place_card(board, 'middle'))

    def test_board_complete(self):
        board = make_board(
            top=[c('A'), c('K', '♥'), c('Q', '♦')],
            middle=[c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠'), c('10', '♥')],
            bottom=[c('9'), c('8', '♥'), c('7', '♦'), c('6', '♣'), c('5', '♠')],
        )
        self.assertTrue(is_board_complete(board))

    def test_board_incomplete_missing_top(self):
        board = make_board(
            top=[c('A'), c('K', '♥')],
            middle=[c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠'), c('10', '♥')],
            bottom=[c('9'), c('8', '♥'), c('7', '♦'), c('6', '♣'), c('5', '♠')],
        )
        self.assertFalse(is_board_complete(board))

    def test_get_cards_to_deal_round0(self):
        self.assertEqual(get_cards_to_deal(0), 5)

    def test_get_cards_to_deal_later_rounds(self):
        for r in [1, 2, 3, 4]:
            self.assertEqual(get_cards_to_deal(r), 3)

    def test_get_cards_to_place_round0(self):
        self.assertEqual(get_cards_to_place(0), 5)

    def test_get_cards_to_place_later_rounds(self):
        for r in [1, 2, 3, 4]:
            self.assertEqual(get_cards_to_place(r), 2)

    def test_get_cards_to_discard_round0(self):
        self.assertEqual(get_cards_to_discard(0), 0)

    def test_get_cards_to_discard_later_rounds(self):
        for r in [1, 2, 3, 4]:
            self.assertEqual(get_cards_to_discard(r), 1)


class TestFantasylandRules(TestCase):
    def test_fl_qualification_below_qq_no_qualify(self):
        top = [c('J'), c('J', '♥'), c('K', '♦')]
        self.assertEqual(check_fantasyland_qualification(top), 0)

    def test_fl_qualification_low_pair_no_qualify(self):
        top = [c('5'), c('5', '♥'), c('A', '♦')]
        self.assertEqual(check_fantasyland_qualification(top), 0)

    def test_fl_qualification_qq(self):
        top = [c('Q'), c('Q', '♥'), c('A', '♦')]
        self.assertEqual(check_fantasyland_qualification(top), FANTASYLAND_BONUS['QQ'])

    def test_fl_qualification_kk(self):
        top = [c('K'), c('K', '♥'), c('A', '♦')]
        self.assertEqual(check_fantasyland_qualification(top), FANTASYLAND_BONUS['KK'])

    def test_fl_qualification_aa(self):
        top = [c('A'), c('A', '♥'), c('K', '♦')]
        self.assertEqual(check_fantasyland_qualification(top), FANTASYLAND_BONUS['AA'])

    def test_fl_qualification_trips(self):
        top = [c('A'), c('A', '♥'), c('A', '♦')]
        self.assertEqual(check_fantasyland_qualification(top), FANTASYLAND_BONUS['TRIPS'])

    def test_fl_qualification_needs_3_cards(self):
        top = [c('A'), c('A', '♥')]
        self.assertEqual(check_fantasyland_qualification(top), 0)

    def test_fl_continuation_basic_hand_no_continue(self):
        board = make_board(
            top=[c('A'), c('K', '♥'), c('Q', '♦')],
            middle=[c('A', '♥'), c('A', '♦'), c('K', '♣'), c('K', '♠'), c('Q', '♣')],
            bottom=[c('2'), c('3', '♥'), c('4', '♦'), c('5', '♣'), c('7', '♠')],
        )
        self.assertFalse(check_fantasyland_continuation(board))

    def test_fl_continuation_four_of_a_kind_bottom(self):
        board = make_board(
            top=[c('A'), c('K', '♥'), c('Q', '♦')],
            middle=[c('9'), c('9', '♥'), c('9', '♦'), c('9', '♣'), c('8', '♠')],
            bottom=[c('K'), c('K', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')],
        )
        self.assertTrue(check_fantasyland_continuation(board))

    def test_fl_continuation_straight_flush_bottom(self):
        board = make_board(
            top=[c('A'), c('K', '♥'), c('Q', '♦')],
            middle=[c('2'), c('3'), c('4'), c('5'), c('6')],
            bottom=[c('7'), c('8'), c('9'), c('10'), c('J')],
        )
        self.assertTrue(check_fantasyland_continuation(board))

    def test_fl_continuation_trips_top(self):
        board = make_board(
            top=[c('A'), c('A', '♥'), c('A', '♦')],
            middle=[c('2'), c('3', '♥'), c('4', '♦'), c('5', '♣'), c('6', '♠')],
            bottom=[c('9'), c('9', '♥'), c('9', '♦'), c('9', '♣'), c('8', '♠')],
        )
        self.assertTrue(check_fantasyland_continuation(board))

    def test_fl_total_cards(self):
        self.assertEqual(get_fantasyland_total_cards(9), 14)
        self.assertEqual(get_fantasyland_total_cards(10), 15)
        self.assertEqual(get_fantasyland_total_cards(11), 16)
        self.assertEqual(get_fantasyland_total_cards(12), 17)

    def test_fl_discard_count(self):
        self.assertEqual(get_fantasyland_discard_count(9), 1)
        self.assertEqual(get_fantasyland_discard_count(10), 2)
        self.assertEqual(get_fantasyland_discard_count(11), 3)
        self.assertEqual(get_fantasyland_discard_count(12), 4)


# ===== スコアリング =====

class TestTopRoyalties(TestCase):
    def test_high_card_no_royalty(self):
        self.assertEqual(_get_top_royalties([c('A'), c('K', '♥'), c('Q', '♦')]), 0)

    def test_pair_55_no_royalty(self):
        self.assertEqual(_get_top_royalties([c('5'), c('5', '♥'), c('A', '♦')]), 0)

    def test_pair_66_royalty_1(self):
        self.assertEqual(_get_top_royalties([c('6'), c('6', '♥'), c('A', '♦')]), 1)

    def test_pair_77_royalty_2(self):
        self.assertEqual(_get_top_royalties([c('7'), c('7', '♥'), c('A', '♦')]), 2)

    def test_pair_qq_royalty_7(self):
        self.assertEqual(_get_top_royalties([c('Q'), c('Q', '♥'), c('A', '♦')]), 7)

    def test_pair_kk_royalty_8(self):
        self.assertEqual(_get_top_royalties([c('K'), c('K', '♥'), c('A', '♦')]), 8)

    def test_pair_aa_royalty_9(self):
        self.assertEqual(_get_top_royalties([c('A'), c('A', '♥'), c('K', '♦')]), 9)

    def test_trips_22_royalty_12(self):
        self.assertEqual(_get_top_royalties([c('2'), c('2', '♥'), c('2', '♦')]), 12)

    def test_trips_aa_royalty_24(self):
        self.assertEqual(_get_top_royalties([c('A'), c('A', '♥'), c('A', '♦')]), 24)


class TestMiddleRoyalties(TestCase):
    def test_high_card_no_royalty(self):
        self.assertEqual(_get_middle_royalties([c('A'), c('K', '♥'), c('J', '♦'), c('9', '♣'), c('7', '♠')]), 0)

    def test_pair_no_royalty(self):
        self.assertEqual(_get_middle_royalties([c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')]), 0)

    def test_trips_royalty_2(self):
        self.assertEqual(_get_middle_royalties([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')]), 2)

    def test_straight_royalty_4(self):
        self.assertEqual(_get_middle_royalties([c('5'), c('6', '♥'), c('7', '♦'), c('8', '♣'), c('9', '♠')]), 4)

    def test_flush_royalty_8(self):
        self.assertEqual(_get_middle_royalties([c('A'), c('K'), c('J'), c('9'), c('7')]), 8)

    def test_full_house_royalty_12(self):
        self.assertEqual(_get_middle_royalties([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('K', '♠')]), 12)

    def test_four_of_a_kind_royalty_20(self):
        self.assertEqual(_get_middle_royalties([c('A'), c('A', '♥'), c('A', '♦'), c('A', '♣'), c('K', '♠')]), 20)

    def test_straight_flush_royalty_30(self):
        self.assertEqual(_get_middle_royalties([c('5'), c('6'), c('7'), c('8'), c('9')]), 30)

    def test_royal_flush_royalty_50(self):
        self.assertEqual(_get_middle_royalties([c('10'), c('J'), c('Q'), c('K'), c('A')]), 50)


class TestBottomRoyalties(TestCase):
    def test_high_card_no_royalty(self):
        self.assertEqual(_get_bottom_royalties([c('A'), c('K', '♥'), c('J', '♦'), c('9', '♣'), c('7', '♠')]), 0)

    def test_pair_no_royalty(self):
        self.assertEqual(_get_bottom_royalties([c('A'), c('A', '♥'), c('K', '♦'), c('Q', '♣'), c('J', '♠')]), 0)

    def test_trips_no_royalty(self):
        """ボトムのトリップスはロイヤリティなし"""
        self.assertEqual(_get_bottom_royalties([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('Q', '♠')]), 0)

    def test_straight_royalty_2(self):
        self.assertEqual(_get_bottom_royalties([c('5'), c('6', '♥'), c('7', '♦'), c('8', '♣'), c('9', '♠')]), 2)

    def test_flush_royalty_4(self):
        self.assertEqual(_get_bottom_royalties([c('A'), c('K'), c('J'), c('9'), c('7')]), 4)

    def test_full_house_royalty_6(self):
        self.assertEqual(_get_bottom_royalties([c('A'), c('A', '♥'), c('A', '♦'), c('K', '♣'), c('K', '♠')]), 6)

    def test_four_of_a_kind_royalty_10(self):
        self.assertEqual(_get_bottom_royalties([c('A'), c('A', '♥'), c('A', '♦'), c('A', '♣'), c('K', '♠')]), 10)

    def test_straight_flush_royalty_15(self):
        self.assertEqual(_get_bottom_royalties([c('5'), c('6'), c('7'), c('8'), c('9')]), 15)

    def test_royal_flush_royalty_25(self):
        self.assertEqual(_get_bottom_royalties([c('10'), c('J'), c('Q'), c('K'), c('A')]), 25)


class TestCalculateRoyalties(TestCase):
    def test_calculate_combined_royalties(self):
        board = make_board(
            top=[c('A'), c('A', '♥'), c('A', '♦')],
            middle=[c('K'), c('K', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')],
            bottom=[c('10'), c('J'), c('Q'), c('K'), c('A')],
        )
        royalties = calculate_royalties(board)
        self.assertEqual(royalties['top'], 24)    # trips A
        self.assertEqual(royalties['middle'], 20) # quads K
        self.assertEqual(royalties['bottom'], 25) # royal flush
        self.assertEqual(royalties['total'], 69)

    def test_zero_royalties(self):
        board = make_board(
            top=[c('A'), c('K', '♥'), c('Q', '♦')],
            middle=[c('2'), c('3', '♥'), c('5', '♦'), c('7', '♣'), c('9', '♠')],
            bottom=[c('2', '♥'), c('4', '♦'), c('6', '♣'), c('8', '♠'), c('J', '♥')],
        )
        royalties = calculate_royalties(board)
        self.assertEqual(royalties['total'], 0)


# ===== ファウル判定 =====

class TestFoulDetection(TestCase):
    def test_valid_board_no_foul(self):
        board = make_board(
            top=[c('A'), c('K', '♥'), c('Q', '♦')],
            middle=[c('A', '♥'), c('A', '♦'), c('K', '♣'), c('K', '♠'), c('Q', '♣')],
            bottom=[c('2'), c('3', '♥'), c('4', '♦'), c('5', '♣'), c('6', '♠')],
        )
        self.assertFalse(check_foul(board))

    def test_foul_bottom_weaker_than_middle(self):
        board = make_board(
            top=[c('A'), c('K', '♥'), c('Q', '♦')],
            middle=[c('A', '♥'), c('A', '♦'), c('A', '♣'), c('K', '♣'), c('K', '♠')],
            bottom=[c('2'), c('3', '♥'), c('5', '♦'), c('7', '♣'), c('9', '♠')],
        )
        self.assertTrue(check_foul(board))

    def test_foul_middle_weaker_than_top(self):
        board = make_board(
            top=[c('A'), c('A', '♥'), c('A', '♦')],
            middle=[c('2'), c('3', '♥'), c('4', '♦'), c('5', '♣'), c('7', '♠')],
            bottom=[c('9'), c('9', '♥'), c('9', '♦'), c('9', '♣'), c('8', '♠')],
        )
        self.assertTrue(check_foul(board))

    def test_no_foul_for_incomplete_board(self):
        board = make_board(top=[c('A'), c('K', '♥')])
        self.assertFalse(check_foul(board))


# ===== ヘッドトゥヘッド =====

class TestHeadToHead(TestCase):
    # 低ロイヤリティ有効ボード (bottom: straight → 2点)
    BOARD_LOW = None
    # ファウルボード
    BOARD_FOUL = None

    def setUp(self):
        self.board_low = make_board(
            top=[c('A', '♥'), c('K', '♦'), c('Q', '♣')],
            middle=[c('3', '♥'), c('3', '♦'), c('4', '♠'), c('5', '♣'), c('6', '♠')],
            bottom=[c('2', '♥'), c('3', '♠'), c('4', '♦'), c('5', '♠'), c('6', '♦')],
        )
        self.board_foul = make_board(
            top=[c('A', '♦'), c('K', '♦'), c('Q', '♦')],
            middle=[c('9', '♦'), c('9', '♥'), c('9', '♠'), c('9', '♣'), c('8', '♠')],
            bottom=[c('2', '♣'), c('3', '♣'), c('5', '♣'), c('7', '♣'), c('9', '♣')],
        )

    def test_both_foul_zero_score(self):
        s1, s2 = _calculate_head_to_head(self.board_foul, self.board_foul)
        self.assertEqual(s1, 0)
        self.assertEqual(s2, 0)

    def test_p1_foul_p2_gets_bonus(self):
        # board_low royalties: straight in bottom → 2
        s1, s2 = _calculate_head_to_head(self.board_foul, self.board_low)
        self.assertEqual(s1, -6 - 2)
        self.assertEqual(s2, 6 + 2)

    def test_p2_foul_p1_wins(self):
        s1, s2 = _calculate_head_to_head(self.board_low, self.board_foul)
        self.assertEqual(s1, 6 + 2)
        self.assertEqual(s2, -6 - 2)

    def test_score_is_zero_sum(self):
        """スコアは常にゼロサム"""
        s1, s2 = _calculate_head_to_head(self.board_low, self.board_low)
        self.assertEqual(s1 + s2, 0)


class TestThreePlayerScores(TestCase):
    def test_zero_sum(self):
        """3人戦のスコア合計は常に0"""
        boards = [
            make_board(
                top=[c('A'), c('A', '♥'), c('A', '♦')],
                middle=[c('K'), c('K', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')],
                bottom=[c('10'), c('J'), c('Q'), c('K'), c('A')],
            ),
            make_board(
                top=[c('A', '♣'), c('K', '♣'), c('Q', '♣')],
                middle=[c('2', '♥'), c('3', '♥'), c('4', '♥'), c('5', '♥'), c('6', '♥')],
                bottom=[c('7', '♥'), c('8', '♥'), c('9', '♥'), c('10', '♥'), c('J', '♥')],
            ),
            make_board(
                top=[c('7', '♦'), c('8', '♦'), c('9', '♦')],
                middle=[c('2', '♦'), c('3', '♦'), c('4', '♦'), c('5', '♦'), c('6', '♦')],
                bottom=[c('7', '♣'), c('8', '♣'), c('9', '♣'), c('J', '♦'), c('Q', '♦')],
            ),
        ]
        scores = calculate_scores(boards)
        self.assertEqual(len(scores), 3)
        self.assertEqual(sum(scores), 0)

    def test_strongest_board_wins(self):
        strongest = make_board(
            top=[c('A'), c('A', '♥'), c('A', '♦')],
            middle=[c('K'), c('K', '♥'), c('K', '♦'), c('K', '♣'), c('Q', '♠')],
            bottom=[c('10'), c('J'), c('Q'), c('K'), c('A')],
        )
        weakest1 = make_board(
            top=[c('2', '♣'), c('3', '♣'), c('4', '♣')],
            middle=[c('2', '♥'), c('3', '♥'), c('5', '♥'), c('7', '♥'), c('9', '♥')],
            bottom=[c('2', '♦'), c('4', '♦'), c('6', '♦'), c('8', '♦'), c('J', '♦')],
        )
        weakest2 = make_board(
            top=[c('5', '♣'), c('6', '♣'), c('7', '♣')],
            middle=[c('2', '♠'), c('4', '♠'), c('6', '♠'), c('8', '♠'), c('10', '♠')],
            bottom=[c('3', '♣'), c('5', '♦'), c('7', '♦'), c('9', '♠'), c('J', '♣')],
        )
        scores = calculate_scores([strongest, weakest1, weakest2])
        self.assertGreater(scores[0], scores[1])
        self.assertGreater(scores[0], scores[2])


# ===== ゲーム API =====

class TestGameAPICreate(APITestCase):
    def test_create_game_two_players(self):
        response = self.client.post('/api/games/', {'player_names': ['Alice', 'Bob']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['players']), 2)
        self.assertEqual(response.data['phase'], 'placing')
        self.assertEqual(response.data['round_number'], 0)

    def test_create_game_three_players(self):
        response = self.client.post('/api/games/', {'player_names': ['Alice', 'Bob', 'Carol']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['players']), 3)

    def test_create_game_invalid_one_player(self):
        response = self.client.post('/api/games/', {'player_names': ['Solo']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_game_invalid_four_players(self):
        response = self.client.post('/api/games/', {'player_names': ['A', 'B', 'C', 'D']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_game_initial_hand_count(self):
        response = self.client.post('/api/games/', {'player_names': ['Alice', 'Bob']}, format='json')
        for p in response.data['players']:
            self.assertEqual(len(p['hand']), 5)

    def test_create_game_player_names(self):
        response = self.client.post('/api/games/', {'player_names': ['Alice', 'Bob']}, format='json')
        names = {p['name'] for p in response.data['players']}
        self.assertEqual(names, {'Alice', 'Bob'})


class TestGameAPIPlay(APITestCase):
    def setUp(self):
        response = self.client.post('/api/games/', {'player_names': ['Alice', 'Bob']}, format='json')
        self.game_id = response.data['id']
        self.game_data = response.data
        self.current_idx = response.data['current_player_index']

    def _current_player(self, data=None):
        data = data or self.game_data
        return next(p for p in data['players'] if p['order'] == self.current_idx)

    def test_get_game_state(self):
        response = self.client.get(f'/api/games/{self.game_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.game_id)

    def test_get_game_not_found(self):
        response = self.client.get('/api/games/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_place_card_valid(self):
        player = self._current_player()
        first_card = player['hand'][0]
        response = self.client.post(
            f'/api/games/{self.game_id}/place/',
            {'card_id': first_card['id'], 'row': 'bottom'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        updated = next(p for p in response.data['players'] if p['order'] == self.current_idx)
        bottom_ids = [c['id'] for c in updated['board']['bottom']]
        self.assertIn(first_card['id'], bottom_ids)

    def test_place_card_not_in_hand(self):
        response = self.client.post(
            f'/api/games/{self.game_id}/place/',
            {'card_id': 'INVALID_ID', 'row': 'bottom'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_place_card_full_row(self):
        player = self._current_player()
        hand = player['hand']
        for i in range(3):
            self.client.post(
                f'/api/games/{self.game_id}/place/',
                {'card_id': hand[i]['id'], 'row': 'top'},
                format='json'
            )
        latest = self.client.get(f'/api/games/{self.game_id}/').data
        updated = next(p for p in latest['players'] if p['order'] == self.current_idx)
        response = self.client.post(
            f'/api/games/{self.game_id}/place/',
            {'card_id': updated['hand'][0]['id'], 'row': 'top'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_undo_place(self):
        player = self._current_player()
        first_card = player['hand'][0]
        self.client.post(
            f'/api/games/{self.game_id}/place/',
            {'card_id': first_card['id'], 'row': 'bottom'},
            format='json'
        )
        response = self.client.post(
            f'/api/games/{self.game_id}/undo/',
            {'row': 'bottom'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        updated = next(p for p in response.data['players'] if p['order'] == self.current_idx)
        self.assertEqual(len(updated['board']['bottom']), 0)

    def test_undo_empty_row(self):
        response = self.client.post(
            f'/api/games/{self.game_id}/undo/',
            {'row': 'top'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_end_game(self):
        response = self.client.post(f'/api/games/{self.game_id}/end/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phase'], 'game_over')

    def test_list_games(self):
        response = self.client.get('/api/games/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertGreater(len(response.data), 0)

    def test_place_card_wrong_phase(self):
        """game_over フェーズでは配置できない"""
        self.client.post(f'/api/games/{self.game_id}/end/', format='json')
        player = self._current_player()
        response = self.client.post(
            f'/api/games/{self.game_id}/place/',
            {'card_id': player['hand'][0]['id'], 'row': 'bottom'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestGameAPIUnauthenticated(APITestCase):
    """セッション切れ（未認証）でもゲーム操作ができることを確認するテスト"""

    def setUp(self):
        # ゲームを作成してから未認証クライアントに切り替え
        response = self.client.post(
            '/api/games/', {'player_names': ['Alice', 'Bob']}, format='json'
        )
        self.game_id = response.data['id']
        self.game_data = response.data
        self.current_idx = response.data['current_player_index']
        # セッション切れをシミュレート（認証情報をクリア）
        self.client.force_authenticate(user=None)
        self.client.credentials()

    def _current_player(self, data=None):
        data = data or self.game_data
        return next(p for p in data['players'] if p['order'] == self.current_idx)

    def test_game_detail_without_auth(self):
        """未認証でもゲーム状態取得が可能"""
        response = self.client.get(f'/api/games/{self.game_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.game_id)

    def test_place_card_without_auth(self):
        """未認証でもカード配置が可能"""
        player = self._current_player()
        first_card = player['hand'][0]
        response = self.client.post(
            f'/api/games/{self.game_id}/place/',
            {'card_id': first_card['id'], 'row': 'bottom'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_undo_place_without_auth(self):
        """未認証でもアンドゥが可能"""
        player = self._current_player()
        first_card = player['hand'][0]
        self.client.post(
            f'/api/games/{self.game_id}/place/',
            {'card_id': first_card['id'], 'row': 'bottom'},
            format='json'
        )
        response = self.client.post(
            f'/api/games/{self.game_id}/undo/',
            {'row': 'bottom'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_end_game_without_auth(self):
        """未認証でもゲーム終了が可能"""
        response = self.client.post(f'/api/games/{self.game_id}/end/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phase'], 'game_over')

    def test_next_round_without_auth(self):
        """未認証でも次ラウンドへの進行が可能"""
        # 全員のボードを完成させてからラウンド結果フェーズへ移行するのは複雑なので、
        # エンドポイントが 403 を返さない（400 または 200）ことだけ確認する
        response = self.client.post(f'/api/games/{self.game_id}/next-round/', format='json')
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_confirm_turn_switch_without_auth(self):
        """未認証でもターン切替確認が可能（ゲーム状態次第で 400 になることもある）"""
        response = self.client.post(f'/api/games/{self.game_id}/confirm-turn/', format='json')
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
