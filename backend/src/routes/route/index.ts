import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { routeQuerySchema, parseCoordString } from '../../utils/validation.js';

function encodePolyline(coords: number[][]): string {
  let encoded = '';
  let prevLat = 0, prevLon = 0;
  for (const [lon, lat] of coords) {
    encoded += encodeVal(Math.round((lat - prevLat) * 1e5));
    encoded += encodeVal(Math.round((lon - prevLon) * 1e5));
    prevLat = lat; prevLon = lon;
  }
  return encoded;
}
function encodeVal(v: number): string {
  v = v < 0 ? ~(v << 1) : v << 1;
  let s = '';
  while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
  s += String.fromCharCode(v + 63);
  return s;
}

// Round coords to create virtual node IDs
function nodeKey(lon: number, lat: number): string {
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

interface GraphEdge {
  edgeId: number; toKey: string; timeCost: number; length: number;
  elevation: number; shade: number; sampleCount: number;
  geometry: { type: string; coordinates: number[][] };
}

export default async function routeRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = routeQuerySchema.parse(request.query);
    const orig = parseCoordString(params.orig);
    const dest = parseCoordString(params.dest);
    const avoidStairs = params.avoid_stairs === 'true';
    const preferShade = params.prefer_shade === 'true';

    const cacheKey = `route:${params.orig}:${params.dest}:${params.mode}:${avoidStairs}:${preferShade}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { reply.send(JSON.parse(cached)); return; }

    // Load all open edges
    let filter = 'WHERE NOT is_closed';
    if (avoidStairs) filter += ' AND NOT stairs_flag';

    const edgesResult = await query(
      `SELECT edge_id, length_m, elevation_gain, shade_score, stairs_flag, sample_count,
        COALESCE(avg_time_walk, static_estimated_time, length_m/1.4) as time_cost,
        ST_AsGeoJSON(geometry)::json as geometry,
        ST_X(ST_StartPoint(geometry)) as start_lon, ST_Y(ST_StartPoint(geometry)) as start_lat,
        ST_X(ST_EndPoint(geometry)) as end_lon, ST_Y(ST_EndPoint(geometry)) as end_lat
       FROM edges ${filter}`
    );
    const edges = edgesResult.rows;

    // Build graph using geometry endpoints as virtual nodes
    const graph = new Map<string, GraphEdge[]>();
    for (const e of edges) {
      const startKey = nodeKey(e.start_lon, e.start_lat);
      const endKey = nodeKey(e.end_lon, e.end_lat);
      const base = {
        edgeId: e.edge_id, timeCost: parseFloat(e.time_cost),
        length: e.length_m, elevation: e.elevation_gain, shade: e.shade_score,
        sampleCount: e.sample_count, geometry: e.geometry,
      };
      if (!graph.has(startKey)) graph.set(startKey, []);
      if (!graph.has(endKey)) graph.set(endKey, []);
      graph.get(startKey)!.push({ ...base, toKey: endKey });
      graph.get(endKey)!.push({ ...base, toKey: startKey });
    }

    // Find nearest node to a coordinate
    function findNearest(lon: number, lat: number): string | null {
      let best: string | null = null;
      let bestDist = Infinity;
      for (const key of graph.keys()) {
        const [nlon, nlat] = key.split(',').map(Number);
        const d = (nlon - lon) ** 2 + (nlat - lat) ** 2;
        if (d < bestDist) { bestDist = d; best = key; }
      }
      return best;
    }

    const origKey = findNearest(orig.lon, orig.lat);
    const destKey = findNearest(dest.lon, dest.lat);
    if (!origKey || !destKey) { reply.send({ routes: [] }); return; }

    function dijkstra(weightFn: (e: GraphEdge) => number): number[] | null {
      const dist = new Map<string, number>();
      const prev = new Map<string, { key: string; edgeId: number }>();
      const visited = new Set<string>();
      const pq: [number, string][] = [[0, origKey!]];
      dist.set(origKey!, 0);

      while (pq.length) {
        pq.sort((a, b) => a[0] - b[0]);
        const [cost, key] = pq.shift()!;
        if (visited.has(key)) continue;
        visited.add(key);
        if (key === destKey) break;
        for (const edge of graph.get(key) || []) {
          const nd = cost + weightFn(edge);
          if (!dist.has(edge.toKey) || nd < dist.get(edge.toKey)!) {
            dist.set(edge.toKey, nd);
            prev.set(edge.toKey, { key, edgeId: edge.edgeId });
            pq.push([nd, edge.toKey]);
          }
        }
      }
      if (!prev.has(destKey!) && origKey !== destKey) return null;
      const edgeIds: number[] = [];
      let cur = destKey!;
      while (cur !== origKey) {
        const p = prev.get(cur);
        if (!p) return null;
        edgeIds.unshift(p.edgeId);
        cur = p.key;
      }
      return edgeIds;
    }

    function buildRoute(edgeIds: number[] | null, type: string, ts: number) {
      if (!edgeIds || !edgeIds.length) return null;
      const re = edgeIds.map(id => edges.find((e: { edge_id: number }) => e.edge_id === id)!);
      let time = 0, dist = 0, elev = 0, shadeSum = 0, verified = 0;
      const coords: number[][] = [[orig.lon, orig.lat]];
      const steps = re.map((e: any) => {
        time += parseFloat(e.time_cost); dist += e.length_m; elev += e.elevation_gain; shadeSum += e.shade_score;
        if (e.sample_count > 2) verified++;
        coords.push(...e.geometry.coordinates);
        return { instruction: 'Continue walking', distance_m: e.length_m, edge_id: String(e.edge_id), verified: e.sample_count > 2 };
      });
      coords.push([dest.lon, dest.lat]);
      const total = re.length;
      return {
        id: `r_${type}_${ts}`, type, estimated_time_s: Math.round(time), distance_m: Math.round(dist),
        energy_kcal: Math.round(dist * 0.046),
        verification_score: total ? Math.round(verified / total * 100) / 100 : 0,
        percent_unverified: total ? Math.round((total - verified) / total * 100) / 100 : 0,
        elevation_gain_m: elev, shade_percentage: total ? Math.round(shadeSum / total * 100) : 0,
        polyline: encodePolyline(coords), geometry: { type: 'LineString', coordinates: coords }, steps,
      };
    }

    const ts = Date.now();
    const routes = [
      buildRoute(dijkstra(e => e.timeCost), 'fastest', ts),
      buildRoute(dijkstra(e => e.timeCost + e.elevation * 10), 'easiest', ts),
      buildRoute(dijkstra(e => e.timeCost * (2 - e.shade)), 'scenic', ts),
    ].filter(Boolean);

    const avgCoverage = routes.length > 0
      ? routes.reduce((sum, r) => sum + (r?.verification_score || 0), 0) / routes.length
      : 0;
    const result = { routes, coverage: avgCoverage, source: 'community' as const };
    await cacheSet(cacheKey, JSON.stringify(result), 120);
    reply.send(result);
  });
}
