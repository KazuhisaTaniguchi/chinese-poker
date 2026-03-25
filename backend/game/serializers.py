from rest_framework import serializers
from .models import Game, Player


class CardSerializer(serializers.Serializer):
    suit = serializers.CharField()
    rank = serializers.CharField()
    id = serializers.CharField()


class PlayerSerializer(serializers.ModelSerializer):
    board = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = ['id', 'name', 'order', 'hand', 'board', 'total_score',
                  'in_fantasyland', 'fantasyland_bonus']

    def get_board(self, obj):
        return obj.get_board()


class GameSerializer(serializers.ModelSerializer):
    players = PlayerSerializer(many=True, read_only=True)

    class Meta:
        model = Game
        fields = [
            'id', 'phase', 'current_player_index', 'round_number',
            'game_round', 'dealer_index', 'round_scores',
            'players', 'created_at', 'updated_at',
        ]


class GameCreateSerializer(serializers.Serializer):
    player_names = serializers.ListField(
        child=serializers.CharField(max_length=50),
        min_length=3,
        max_length=3,
    )


class PlaceCardSerializer(serializers.Serializer):
    card_id = serializers.CharField()
    row = serializers.ChoiceField(choices=['top', 'middle', 'bottom'])


class UndoSerializer(serializers.Serializer):
    row = serializers.ChoiceField(choices=['top', 'middle', 'bottom'])
