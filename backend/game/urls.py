from django.urls import path
from . import views

urlpatterns = [
    path('games/', views.game_list, name='game-list'),
    path('games/<uuid:game_id>/', views.game_detail, name='game-detail'),
    path('games/<uuid:game_id>/place/', views.place_card, name='place-card'),
    path('games/<uuid:game_id>/undo/', views.undo_place, name='undo-place'),
    path('games/<uuid:game_id>/confirm/', views.confirm_placement, name='confirm-placement'),
    path('games/<uuid:game_id>/confirm-turn/', views.confirm_turn_switch, name='confirm-turn'),
    path('games/<uuid:game_id>/next-round/', views.next_round, name='next-round'),
    path('games/<uuid:game_id>/end/', views.end_game, name='end-game'),
]
