-- JLT Walk Database Schema
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(50),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  preferences JSONB DEFAULT '{}',
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edges (walking path segments)
CREATE TABLE IF NOT EXISTS edges (
  edge_id SERIAL PRIMARY KEY,
  geometry GEOMETRY(LineString, 4326) NOT NULL,
  length_m REAL NOT NULL,
  elevation_gain REAL DEFAULT 0,
  stairs_flag BOOLEAN DEFAULT FALSE,
  shade_score REAL DEFAULT 0.5,
  avg_time_walk REAL,
  avg_time_run REAL,
  sample_count INTEGER DEFAULT 0,
  static_estimated_time REAL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  level INTEGER DEFAULT 0,
  is_closed BOOLEAN DEFAULT FALSE,
  closure_expiry TIMESTAMPTZ,
  closure_reason TEXT,
  from_node INTEGER,
  to_node INTEGER
);

CREATE INDEX IF NOT EXISTS idx_edges_geometry ON edges USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_edges_from_node ON edges(from_node);
CREATE INDEX IF NOT EXISTS idx_edges_to_node ON edges(to_node);

-- Observations (travel time samples per edge)
CREATE TABLE IF NOT EXISTS observations (
  id SERIAL PRIMARY KEY,
  edge_id INTEGER REFERENCES edges(edge_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  travel_time_s REAL NOT NULL,
  speed_mps REAL,
  mode VARCHAR(10) DEFAULT 'walk' CHECK (mode IN ('walk', 'run')),
  accuracy REAL,
  observed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observations_edge ON observations(edge_id);
CREATE INDEX IF NOT EXISTS idx_observations_user ON observations(user_id);

-- Traces (GPS traces submitted by users)
CREATE TABLE IF NOT EXISTS traces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  geometry GEOMETRY(LineString, 4326) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  mode VARCHAR(10) DEFAULT 'walk' CHECK (mode IN ('walk', 'run')),
  distance_m REAL,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traces_user ON traces(user_id);
CREATE INDEX IF NOT EXISTS idx_traces_geometry ON traces USING GIST(geometry);

-- Pins (community markers)
CREATE TABLE IF NOT EXISTS pins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('hazard', 'closure', 'construction', 'tip', 'photo')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  photo_url TEXT,
  verified_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pins_location ON pins USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_pins_type ON pins(type);

-- Pin verifications
CREATE TABLE IF NOT EXISTS pin_verifications (
  id SERIAL PRIMARY KEY,
  pin_id INTEGER REFERENCES pins(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pin_id, user_id)
);

-- Shortcuts (user-discovered shortcuts)
CREATE TABLE IF NOT EXISTS shortcuts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  geometry GEOMETRY(LineString, 4326) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  time_saved_s REAL,
  validated BOOLEAN DEFAULT FALSE,
  validation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shortcuts_geometry ON shortcuts USING GIST(geometry);

-- Discovered routes
CREATE TABLE IF NOT EXISTS discovered_routes (
  id SERIAL PRIMARY KEY,
  geometry GEOMETRY(LineString, 4326) NOT NULL,
  origin_lat REAL NOT NULL,
  origin_lon REAL NOT NULL,
  dest_lat REAL NOT NULL,
  dest_lon REAL NOT NULL,
  distance_m REAL,
  estimated_time_s REAL,
  endorsement_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovered_routes_geometry ON discovered_routes USING GIST(geometry);

-- Points log (gamification)
CREATE TABLE IF NOT EXISTS points_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_log_user ON points_log(user_id);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  criteria_json JSONB,
  icon_url TEXT
);

-- User badges
CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Edge closures history
CREATE TABLE IF NOT EXISTS edge_closures (
  id SERIAL PRIMARY KEY,
  edge_id INTEGER REFERENCES edges(edge_id) ON DELETE CASCADE,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  reopened_at TIMESTAMPTZ
);

-- Route endorsements
CREATE TABLE IF NOT EXISTS route_endorsements (
  id SERIAL PRIMARY KEY,
  route_id INTEGER REFERENCES discovered_routes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_id, user_id)
);

-- Shortcut validations
CREATE TABLE IF NOT EXISTS shortcut_validations (
  id SERIAL PRIMARY KEY,
  shortcut_id INTEGER REFERENCES shortcuts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shortcut_id, user_id)
);
