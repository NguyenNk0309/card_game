CREATE TABLE game_rooms (
  id VARCHAR(12) PRIMARY KEY,
  seed VARCHAR(12) NOT NULL,
  chapter SMALLINT NOT NULL DEFAULT 1,
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE game_players (
  room_id VARCHAR(12) REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  display_name VARCHAR(40) NOT NULL,
  team VARCHAR(12) NOT NULL CHECK (team IN ('veil', 'ember')),
  session_id VARCHAR(64) NOT NULL,
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  hero_json JSONB NOT NULL,
  skill_deck_json JSONB NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (room_id, player_id)
);

CREATE INDEX game_players_room_idx ON game_players(room_id);
CREATE UNIQUE INDEX game_players_room_session_idx ON game_players(room_id, session_id);
