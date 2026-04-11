import { z } from 'zod';

export function parseBbox(bbox: string): { minLat: number; minLon: number; maxLat: number; maxLon: number } {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    throw new Error('bbox must be minLat,minLon,maxLat,maxLon');
  }
  return { minLat: parts[0], minLon: parts[1], maxLat: parts[2], maxLon: parts[3] };
}

export function parseCoordString(coord: string): { lat: number; lon: number } {
  const parts = coord.split(',').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) {
    throw new Error('Coordinate must be lat,lon');
  }
  return { lat: parts[0], lon: parts[1] };
}

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const traceSchema = z.object({
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.array(z.number()).length(2)),
  }),
  started_at: z.string(),
  ended_at: z.string(),
  mode: z.enum(['walk', 'run']).default('walk'),
});

export const pinSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  type: z.enum(['hazard', 'closure', 'construction', 'tip', 'photo']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  photo_url: z.string().url().optional(),
  expires_at: z.string().optional(),
});

export const routeQuerySchema = z.object({
  orig: z.string(),
  dest: z.string(),
  avoid_stairs: z.string().optional(),
  prefer_shade: z.string().optional(),
  mode: z.enum(['walk', 'run']).optional().default('walk'),
});

export const shortcutSchema = z.object({
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.array(z.number()).length(2)),
  }),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  time_saved_s: z.number().positive(),
});

export const edgeCloseSchema = z.object({
  edge_id: z.number(),
  reason: z.string().min(1),
  expiry: z.string().optional(),
});

export const preferencesSchema = z.object({
  avoid_stairs: z.boolean().optional(),
  prefer_shade: z.boolean().optional(),
  default_mode: z.enum(['walk', 'run']).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
});
