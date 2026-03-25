"""デッキの生成・シャッフル・配布"""
import random

SUITS = ['♠', '♥', '♦', '♣']
SUIT_COLORS = {'♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black'}
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
}


def create_deck():
    """52枚のデッキを生成"""
    return [{'suit': suit, 'rank': rank, 'id': f'{rank}{suit}'}
            for suit in SUITS for rank in RANKS]


def shuffle_deck(deck):
    """デッキをシャッフル"""
    shuffled = deck.copy()
    random.shuffle(shuffled)
    return shuffled


def deal_cards(deck, count):
    """デッキからカードを配布"""
    return {
        'dealt': deck[:count],
        'remaining': deck[count:]
    }
