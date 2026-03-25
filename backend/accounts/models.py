import uuid
from django.db import models
from django.contrib.auth.models import User


class Room(models.Model):
    """ゲームルーム"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_rooms')
    game = models.OneToOneField('game.Game', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} (Host: {self.host.username})'


class PlayerSlot(models.Model):
    """ルーム内のプレイヤー枠"""
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='slots')
    name = models.CharField(max_length=50)
    order = models.IntegerField()  # 0, 1, 2
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='player_slots')

    class Meta:
        ordering = ['order']
        unique_together = ['room', 'order']

    def __str__(self):
        return f'{self.name} (Slot {self.order}, Room {self.room_id})'
