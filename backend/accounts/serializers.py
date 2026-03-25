from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Room, PlayerSlot


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=4, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('このユーザー名は既に使われています')
        return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class PlayerSlotSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default=None)

    class Meta:
        model = PlayerSlot
        fields = ['id', 'name', 'order', 'token', 'username']


class RoomSerializer(serializers.ModelSerializer):
    host_name = serializers.CharField(source='host.username', read_only=True)
    slots = PlayerSlotSerializer(many=True, read_only=True)
    game_id = serializers.UUIDField(source='game.id', read_only=True, default=None)

    class Meta:
        model = Room
        fields = ['id', 'name', 'host_name', 'game_id', 'slots', 'created_at']


class RoomCreateSerializer(serializers.Serializer):
    room_name = serializers.CharField(max_length=100)
    player_names = serializers.ListField(
        child=serializers.CharField(max_length=50),
        min_length=3,
        max_length=3,
    )
