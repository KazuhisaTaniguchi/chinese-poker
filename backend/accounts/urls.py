from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('register/', views.register_view, name='auth-register'),
    path('login/', views.login_view, name='auth-login'),
    path('logout/', views.logout_view, name='auth-logout'),
    path('me/', views.me_view, name='auth-me'),

    # Rooms
    path('rooms/', views.room_list, name='room-list'),
    path('rooms/<uuid:room_id>/', views.room_detail, name='room-detail'),
    path('rooms/<uuid:room_id>/join/<uuid:token>/', views.room_join, name='room-join'),
    path('rooms/<uuid:room_id>/start/', views.room_start_game, name='room-start'),
    path('rooms/<uuid:room_id>/state/', views.room_state, name='room-state'),
]
