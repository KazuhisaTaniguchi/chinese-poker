export interface User {
  id: string | number;
  username: string;
}

export interface PlayerSlot {
  order: number;
  name: string;
  username: string | null;
  token?: string;
  status?: string;
}

export interface Room {
  id: string;
  name: string;
  host_name: string;
  slots: PlayerSlot[];
  game_id: string | null;
}

export interface Card {
  id: string;
  suit: 'spade' | 'heart' | 'diamond' | 'club';
  rank: string;
  value: number;
}

export interface Player {
  order: number;
  name: string;
  inFantasyland?: boolean;
  fantasylandBonus?: number;
  isPlacementDone?: boolean;
  board_top: Card[];
  board_middle: Card[];
  board_bottom: Card[];
  hand: Card[];
  locked_board?: {
    top: string[];
    middle: string[];
    bottom: string[];
  };
}

export interface GameState {
  phase: 'title' | 'setup' | 'placing' | 'round_result' | 'game_over';
  currentRound: number;
  players: Player[];
  dealerIndex: number;
  currentPlayerIndex: number;
  roundScores?: any;
  gameRound?: number;
}
