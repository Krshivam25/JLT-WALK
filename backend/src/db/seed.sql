-- JLT Walk Seed Data
-- Test users (passwords: TestWalk123!, ModWalk123!, AdminWalk123!)
INSERT INTO users (email, password_hash, display_name, role, points) VALUES
  ('test@jltwalk.app', '$2b$10$rQXzHjSEG0Y8G8KZFVwQ8eWE1GqEBz7z6KEYhTWY7tMNqHDQvNKZG', 'TestWalker', 'user', 150),
  ('moderator@jltwalk.app', '$2b$10$KJ8L5yvZwE0N6oN5P2dKg.qMHmKj7XQZR3vBxzG8T5eRwY1sKJ3.a', 'ModWalker', 'moderator', 320),
  ('admin@jltwalk.app', '$2b$10$VW3gR0x6z1YQ8x7K0mNwEu5kT9L2eF3jH6rP4zA1bN5cD7gI9wK2S', 'AdminWalker', 'admin', 500)
ON CONFLICT (email) DO NOTHING;

-- Badges
INSERT INTO badges (name, description, criteria_json, icon_url) VALUES
  ('First Steps', 'Record your first trace', '{"traces_count": 1}', '/badges/first-steps.png'),
  ('Explorer', 'Walk 10 unique edges', '{"unique_edges": 10}', '/badges/explorer.png'),
  ('Pathfinder', 'Walk 50 unique edges', '{"unique_edges": 50}', '/badges/pathfinder.png'),
  ('Community Helper', 'Add 5 pins', '{"pins_count": 5}', '/badges/helper.png'),
  ('Verifier', 'Verify 10 pins', '{"verifications": 10}', '/badges/verifier.png'),
  ('Speed Walker', 'Average speed over 1.8 m/s on 5 traces', '{"fast_traces": 5}', '/badges/speed.png'),
  ('Night Owl', 'Record a trace after 10 PM', '{"night_trace": true}', '/badges/night.png'),
  ('Shortcut Finder', 'Discover a validated shortcut', '{"shortcuts_validated": 1}', '/badges/shortcut.png')
ON CONFLICT DO NOTHING;

-- Assign some badges to test users
INSERT INTO user_badges (user_id, badge_id) VALUES (1, 1), (1, 2), (2, 1), (2, 2), (2, 3), (3, 1), (3, 2), (3, 3), (3, 4)
ON CONFLICT DO NOTHING;

-- JLT Walking Network Edges
-- The JLT area spans roughly: lat 25.065-25.080, lon 55.140-55.155
-- Node IDs represent intersections; edges connect them as a walking graph

-- Cluster Z area (south)
INSERT INTO edges (geometry, length_m, elevation_gain, stairs_flag, shade_score, avg_time_walk, sample_count, static_estimated_time, from_node, to_node) VALUES
  (ST_GeomFromText('LINESTRING(55.1440 25.0660, 55.1445 25.0665)', 4326), 70, 0, false, 0.6, 50.0, 5, 50.0, 1, 2),
  (ST_GeomFromText('LINESTRING(55.1445 25.0665, 55.1450 25.0670)', 4326), 70, 0, false, 0.4, 50.0, 4, 50.0, 2, 3),
  (ST_GeomFromText('LINESTRING(55.1450 25.0670, 55.1455 25.0675)', 4326), 70, 0, false, 0.5, 50.0, 5, 50.0, 3, 4),
  (ST_GeomFromText('LINESTRING(55.1455 25.0675, 55.1460 25.0680)', 4326), 70, 0, false, 0.7, 50.0, 4, 50.0, 4, 5),
  (ST_GeomFromText('LINESTRING(55.1445 25.0665, 55.1450 25.0660)', 4326), 80, 0, false, 0.3, 57.1, 3, 57.1, 2, 6),
  (ST_GeomFromText('LINESTRING(55.1450 25.0660, 55.1455 25.0665)', 4326), 75, 0, false, 0.5, 53.6, 5, 53.6, 6, 7),
  (ST_GeomFromText('LINESTRING(55.1455 25.0665, 55.1460 25.0670)', 4326), 75, 0, false, 0.6, 53.6, 4, 53.6, 7, 8),
  (ST_GeomFromText('LINESTRING(55.1460 25.0670, 55.1460 25.0680)', 4326), 110, 0, false, 0.5, 78.6, 5, 78.6, 8, 5),
  (ST_GeomFromText('LINESTRING(55.1450 25.0670, 55.1450 25.0660)', 4326), 110, 0, false, 0.4, 78.6, 4, 78.6, 3, 6),
  (ST_GeomFromText('LINESTRING(55.1440 25.0660, 55.1440 25.0670)', 4326), 110, 0, false, 0.6, 78.6, 5, 78.6, 1, 10),

  -- Cluster Y area (central-south)
  (ST_GeomFromText('LINESTRING(55.1440 25.0670, 55.1445 25.0675)', 4326), 70, 0, false, 0.5, 50.0, 5, 50.0, 10, 11),
  (ST_GeomFromText('LINESTRING(55.1445 25.0675, 55.1450 25.0680)', 4326), 70, 0, false, 0.6, 50.0, 4, 50.0, 11, 12),
  (ST_GeomFromText('LINESTRING(55.1450 25.0680, 55.1455 25.0685)', 4326), 70, 0, false, 0.4, 50.0, 5, 50.0, 12, 13),
  (ST_GeomFromText('LINESTRING(55.1455 25.0685, 55.1460 25.0690)', 4326), 70, 0, false, 0.5, 50.0, 4, 50.0, 13, 14),
  (ST_GeomFromText('LINESTRING(55.1460 25.0680, 55.1460 25.0690)', 4326), 110, 0, false, 0.5, 78.6, 5, 78.6, 5, 14),
  (ST_GeomFromText('LINESTRING(55.1440 25.0670, 55.1450 25.0670)', 4326), 95, 0, false, 0.5, 67.9, 3, 67.9, 10, 3),
  (ST_GeomFromText('LINESTRING(55.1455 25.0675, 55.1455 25.0685)', 4326), 110, 0, false, 0.6, 78.6, 4, 78.6, 4, 13),
  (ST_GeomFromText('LINESTRING(55.1445 25.0675, 55.1445 25.0665)', 4326), 110, 0, false, 0.5, 78.6, 5, 78.6, 11, 2),

  -- Cluster X area (central-north)
  (ST_GeomFromText('LINESTRING(55.1440 25.0690, 55.1445 25.0695)', 4326), 70, 0, false, 0.5, 50.0, 5, 50.0, 15, 16),
  (ST_GeomFromText('LINESTRING(55.1445 25.0695, 55.1450 25.0700)', 4326), 70, 0, false, 0.6, 50.0, 4, 50.0, 16, 17),
  (ST_GeomFromText('LINESTRING(55.1450 25.0700, 55.1455 25.0705)', 4326), 70, 0, false, 0.4, 50.0, 5, 50.0, 17, 18),
  (ST_GeomFromText('LINESTRING(55.1455 25.0705, 55.1460 25.0710)', 4326), 70, 0, false, 0.7, 50.0, 4, 50.0, 18, 19),
  (ST_GeomFromText('LINESTRING(55.1440 25.0690, 55.1445 25.0685)', 4326), 80, 0, false, 0.3, 57.1, 5, 57.1, 15, 20),
  (ST_GeomFromText('LINESTRING(55.1445 25.0685, 55.1450 25.0690)', 4326), 75, 0, false, 0.5, 53.6, 4, 53.6, 20, 21),
  (ST_GeomFromText('LINESTRING(55.1450 25.0690, 55.1455 25.0695)', 4326), 75, 0, false, 0.6, 53.6, 5, 53.6, 21, 22),
  (ST_GeomFromText('LINESTRING(55.1455 25.0695, 55.1460 25.0700)', 4326), 75, 0, false, 0.5, 53.6, 4, 53.6, 22, 23),
  (ST_GeomFromText('LINESTRING(55.1460 25.0700, 55.1460 25.0710)', 4326), 110, 0, false, 0.5, 78.6, 5, 78.6, 23, 19),
  (ST_GeomFromText('LINESTRING(55.1440 25.0690, 55.1440 25.0680)', 4326), 110, 0, false, 0.6, 78.6, 3, 78.6, 15, 24),

  -- Connecting paths between clusters
  (ST_GeomFromText('LINESTRING(55.1440 25.0680, 55.1440 25.0690)', 4326), 110, 0, false, 0.5, 78.6, 5, 78.6, 24, 15),
  (ST_GeomFromText('LINESTRING(55.1460 25.0690, 55.1460 25.0700)', 4326), 110, 0, false, 0.4, 78.6, 4, 78.6, 14, 23),
  (ST_GeomFromText('LINESTRING(55.1450 25.0680, 55.1450 25.0690)', 4326), 110, 0, false, 0.5, 78.6, 5, 78.6, 12, 21),

  -- Cluster W area (north)
  (ST_GeomFromText('LINESTRING(55.1440 25.0710, 55.1445 25.0715)', 4326), 70, 0, false, 0.6, 50.0, 5, 50.0, 25, 26),
  (ST_GeomFromText('LINESTRING(55.1445 25.0715, 55.1450 25.0720)', 4326), 70, 0, false, 0.5, 50.0, 4, 50.0, 26, 27),
  (ST_GeomFromText('LINESTRING(55.1450 25.0720, 55.1455 25.0725)', 4326), 70, 0, false, 0.4, 50.0, 5, 50.0, 27, 28),
  (ST_GeomFromText('LINESTRING(55.1455 25.0725, 55.1460 25.0730)', 4326), 70, 2, false, 0.7, 52.0, 4, 52.0, 28, 29),
  (ST_GeomFromText('LINESTRING(55.1440 25.0710, 55.1450 25.0710)', 4326), 95, 0, false, 0.5, 67.9, 5, 67.9, 25, 30),
  (ST_GeomFromText('LINESTRING(55.1450 25.0710, 55.1460 25.0710)', 4326), 95, 0, false, 0.4, 67.9, 4, 67.9, 30, 19),
  (ST_GeomFromText('LINESTRING(55.1440 25.0710, 55.1440 25.0720)', 4326), 110, 0, false, 0.6, 78.6, 5, 78.6, 25, 31),
  (ST_GeomFromText('LINESTRING(55.1440 25.0720, 55.1450 25.0720)', 4326), 95, 0, false, 0.5, 67.9, 3, 67.9, 31, 27),
  (ST_GeomFromText('LINESTRING(55.1460 25.0710, 55.1460 25.0720)', 4326), 110, 0, false, 0.5, 78.6, 5, 78.6, 19, 32),
  (ST_GeomFromText('LINESTRING(55.1460 25.0720, 55.1455 25.0725)', 4326), 80, 0, false, 0.4, 57.1, 4, 57.1, 32, 28),

  -- Promenade / lakeside paths
  (ST_GeomFromText('LINESTRING(55.1465 25.0660, 55.1465 25.0680)', 4326), 220, 0, false, 0.3, 157.1, 5, 157.1, 33, 34),
  (ST_GeomFromText('LINESTRING(55.1465 25.0680, 55.1465 25.0700)', 4326), 220, 0, false, 0.3, 157.1, 4, 157.1, 34, 35),
  (ST_GeomFromText('LINESTRING(55.1465 25.0700, 55.1465 25.0720)', 4326), 220, 0, false, 0.3, 157.1, 5, 157.1, 35, 36),
  (ST_GeomFromText('LINESTRING(55.1460 25.0680, 55.1465 25.0680)', 4326), 50, 0, false, 0.4, 35.7, 4, 35.7, 5, 34),
  (ST_GeomFromText('LINESTRING(55.1460 25.0700, 55.1465 25.0700)', 4326), 50, 0, false, 0.4, 35.7, 5, 35.7, 23, 35),
  (ST_GeomFromText('LINESTRING(55.1460 25.0720, 55.1465 25.0720)', 4326), 50, 0, false, 0.4, 35.7, 3, 35.7, 32, 36),

  -- Stairs and elevated walkways
  (ST_GeomFromText('LINESTRING(55.1448 25.0675, 55.1448 25.0680)', 4326), 55, 3, true, 0.8, 45.0, 5, 45.0, 37, 38),
  (ST_GeomFromText('LINESTRING(55.1452 25.0695, 55.1452 25.0700)', 4326), 55, 3, true, 0.8, 45.0, 4, 45.0, 39, 40),
  (ST_GeomFromText('LINESTRING(55.1448 25.0715, 55.1448 25.0720)', 4326), 55, 4, true, 0.9, 48.0, 5, 48.0, 41, 42),

  -- Additional connecting paths
  (ST_GeomFromText('LINESTRING(55.1440 25.0660, 55.1465 25.0660)', 4326), 240, 0, false, 0.3, 171.4, 5, 171.4, 1, 33),
  (ST_GeomFromText('LINESTRING(55.1445 25.0685, 55.1455 25.0685)', 4326), 95, 0, false, 0.5, 67.9, 4, 67.9, 20, 13);

-- Observations (250 samples across the edges)
-- Generate observations for various edges
DO $$
DECLARE
  e RECORD;
  i INTEGER;
  base_speed REAL;
  travel_time REAL;
  speed REAL;
BEGIN
  FOR e IN SELECT edge_id, length_m, sample_count FROM edges LOOP
    base_speed := 1.2 + random() * 0.6; -- 1.2-1.8 m/s walking speed
    FOR i IN 1..LEAST(e.sample_count, 6) LOOP
      speed := base_speed + (random() - 0.5) * 0.4;
      travel_time := e.length_m / speed;
      INSERT INTO observations (edge_id, travel_time_s, speed_mps, mode, accuracy, observed_at)
      VALUES (
        e.edge_id,
        travel_time,
        speed,
        'walk',
        10 + random() * 20,
        NOW() - (random() * INTERVAL '30 days')
      );
    END LOOP;
  END LOOP;
END $$;

-- Pins
INSERT INTO pins (user_id, location, type, title, description, verified_count) VALUES
  (1, ST_SetSRID(ST_MakePoint(55.1450, 25.0675), 4326), 'tip', 'Shaded shortcut through Z towers', 'Great shaded path between buildings, perfect for summer walks', 3),
  (1, ST_SetSRID(ST_MakePoint(55.1458, 25.0695), 4326), 'hazard', 'Uneven pavement near X cluster', 'Watch your step, some tiles are loose here', 2),
  (2, ST_SetSRID(ST_MakePoint(55.1465, 25.0685), 4326), 'photo', 'Beautiful lake view spot', 'Amazing sunset photos from this spot by the lake', 5),
  (2, ST_SetSRID(ST_MakePoint(55.1442, 25.0710), 4326), 'construction', 'W tower renovation', 'Construction work ongoing, path partially blocked until March', 1),
  (1, ST_SetSRID(ST_MakePoint(55.1455, 25.0720), 4326), 'tip', 'Best coffee stop on walk', 'Great cafe on the ground floor, good rest spot', 4),
  (2, ST_SetSRID(ST_MakePoint(55.1448, 25.0665), 4326), 'closure', 'Temporary path closure', 'Maintenance work on walkway, use alternate route', 2),
  (1, ST_SetSRID(ST_MakePoint(55.1462, 25.0705), 4326), 'hazard', 'No shade zone warning', 'Completely exposed area, avoid during peak sun hours', 3),
  (3, ST_SetSRID(ST_MakePoint(55.1445, 25.0690), 4326), 'tip', 'Water fountain location', 'Public water fountain near the park entrance', 6);

-- Points log entries
INSERT INTO points_log (user_id, points, reason, created_at) VALUES
  (1, 10, 'trace_submitted', NOW() - INTERVAL '20 days'),
  (1, 10, 'trace_submitted', NOW() - INTERVAL '15 days'),
  (1, 5, 'pin_created', NOW() - INTERVAL '12 days'),
  (1, 2, 'pin_verified', NOW() - INTERVAL '10 days'),
  (1, 10, 'trace_submitted', NOW() - INTERVAL '8 days'),
  (1, 50, 'badge_earned', NOW() - INTERVAL '8 days'),
  (1, 10, 'trace_submitted', NOW() - INTERVAL '5 days'),
  (1, 50, 'badge_earned', NOW() - INTERVAL '5 days'),
  (1, 3, 'edge_first_walk', NOW() - INTERVAL '3 days'),
  (2, 10, 'trace_submitted', NOW() - INTERVAL '25 days'),
  (2, 10, 'trace_submitted', NOW() - INTERVAL '20 days'),
  (2, 10, 'trace_submitted', NOW() - INTERVAL '18 days'),
  (2, 5, 'pin_created', NOW() - INTERVAL '15 days'),
  (2, 10, 'trace_submitted', NOW() - INTERVAL '12 days'),
  (2, 50, 'badge_earned', NOW() - INTERVAL '12 days'),
  (2, 10, 'trace_submitted', NOW() - INTERVAL '10 days'),
  (2, 50, 'badge_earned', NOW() - INTERVAL '10 days'),
  (2, 50, 'badge_earned', NOW() - INTERVAL '8 days'),
  (2, 10, 'trace_submitted', NOW() - INTERVAL '5 days'),
  (2, 100, 'shortcut_discovered', NOW() - INTERVAL '3 days'),
  (3, 10, 'trace_submitted', NOW() - INTERVAL '28 days'),
  (3, 10, 'trace_submitted', NOW() - INTERVAL '25 days'),
  (3, 50, 'badge_earned', NOW() - INTERVAL '25 days'),
  (3, 10, 'trace_submitted', NOW() - INTERVAL '20 days'),
  (3, 50, 'badge_earned', NOW() - INTERVAL '20 days'),
  (3, 50, 'badge_earned', NOW() - INTERVAL '15 days'),
  (3, 10, 'trace_submitted', NOW() - INTERVAL '10 days'),
  (3, 5, 'pin_created', NOW() - INTERVAL '8 days'),
  (3, 50, 'badge_earned', NOW() - INTERVAL '5 days'),
  (3, 250, 'admin_bonus', NOW() - INTERVAL '1 day');

-- Some traces for test users
INSERT INTO traces (user_id, geometry, started_at, ended_at, mode, distance_m) VALUES
  (1, ST_GeomFromText('LINESTRING(55.1440 25.0660, 55.1445 25.0665, 55.1450 25.0670, 55.1455 25.0675)', 4326),
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days' + INTERVAL '5 minutes', 'walk', 210),
  (1, ST_GeomFromText('LINESTRING(55.1440 25.0670, 55.1445 25.0675, 55.1450 25.0680, 55.1455 25.0685)', 4326),
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days' + INTERVAL '6 minutes', 'walk', 210),
  (1, ST_GeomFromText('LINESTRING(55.1440 25.0690, 55.1445 25.0695, 55.1450 25.0700, 55.1455 25.0705, 55.1460 25.0710)', 4326),
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '7 minutes', 'walk', 280),
  (2, ST_GeomFromText('LINESTRING(55.1440 25.0660, 55.1445 25.0665, 55.1450 25.0670, 55.1455 25.0675, 55.1460 25.0680)', 4326),
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days' + INTERVAL '8 minutes', 'walk', 280),
  (2, ST_GeomFromText('LINESTRING(55.1440 25.0710, 55.1445 25.0715, 55.1450 25.0720, 55.1455 25.0725, 55.1460 25.0730)', 4326),
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days' + INTERVAL '8 minutes', 'walk', 280),
  (3, ST_GeomFromText('LINESTRING(55.1465 25.0660, 55.1465 25.0680, 55.1465 25.0700, 55.1465 25.0720)', 4326),
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days' + INTERVAL '15 minutes', 'walk', 660);
