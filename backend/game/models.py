import uuid
from django.db import models


class Game(models.Model):
    """ゲーム全体の状態"""
    PHASE_CHOICES = [
        ('title', 'タイトル'),
        ('setup', 'セットアップ'),
        ('placing', 'カード配置中'),
        ('turn_switch', 'ターン切替'),
        ('round_result', 'ラウンド結果'),
        ('game_over', 'ゲーム終了'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES, default='placing')
    current_player_index = models.IntegerField(default=0)
    round_number = models.IntegerField(default=0)
    game_round = models.IntegerField(default=1)
    dealer_index = models.IntegerField(default=0)
    deck = models.JSONField(default=list)
    round_scores = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        player_names = ', '.join(p.name for p in self.players.all())
        return f'Game {self.id} ({player_names})'

    def get_board(self, player_index):
        """指定プレイヤーのボードをdict形式で取得"""
        player = self.players.filter(order=player_index).first()
        if not player:
            return {'top': [], 'middle': [], 'bottom': []}
        return player.get_board()

    def get_all_boards(self):
        """全プレイヤーのボードをリストで取得"""
        return [p.get_board() for p in self.players.order_by('order')]


class Player(models.Model):
    """各プレイヤーの状態"""
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='players')
    name = models.CharField(max_length=50)
    order = models.IntegerField()
    hand = models.JSONField(default=list)
    board_top = models.JSONField(default=list)
    board_middle = models.JSONField(default=list)
    board_bottom = models.JSONField(default=list)
    total_score = models.IntegerField(default=0)
    in_fantasyland = models.BooleanField(default=False)
    fantasyland_bonus = models.IntegerField(default=0)  # 0,9,10,11,12

    class Meta:
        ordering = ['order']
        unique_together = ['game', 'order']

    def __str__(self):
        return f'{self.name} (Game {self.game_id})'

    def get_board(self):
        return {
            'top': self.board_top,
            'middle': self.board_middle,
            'bottom': self.board_bottom,
        }

    def set_board(self, board):
        self.board_top = board.get('top', [])
        self.board_middle = board.get('middle', [])
        self.board_bottom = board.get('bottom', [])
