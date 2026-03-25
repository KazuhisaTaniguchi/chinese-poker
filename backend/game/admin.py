from django.contrib import admin
from .models import Game, Player


class PlayerInline(admin.TabularInline):
    model = Player
    extra = 0


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ['id', 'phase', 'game_round', 'current_player_index', 'updated_at']
    inlines = [PlayerInline]
