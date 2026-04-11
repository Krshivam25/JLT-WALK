import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { parseBbox } from '../../utils/validation.js';

export default async function heatmapRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bbox } = request.query as { bbox?: string };
    if (!bbox) { reply.code(400).send({ error: 'bbox query parameter required' }); return; }

    const cacheKey = `heatmap:${bbox}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { reply.send(JSON.parse(cached)); return; }

    const b = parseBbox(bbox);
    const resolution = 20;
    const latStep = (b.maxLat - b.minLat) / resolution;
    const lonStep = (b.maxLon - b.minLon) / resolution;

    // Use edge observations to build heatmap
    const result = await query(
      `SELECT ROUND(CAST(ST_Y(ST_Centroid(e.geometry)) / $5 AS numeric), 0) * $5 as lat,
              ROUND(CAST(ST_X(ST_Centroid(e.geometry)) / $6 AS numeric), 0) * $6 as lon,
              SUM(o.id)::int as sample_count_raw, COUNT(*)::int as sample_count
       FROM edge_observations o JOIN edges e ON e.edge_id = o.edge_id
       WHERE e.geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       GROUP BY 1, 2 ORDER BY sample_count DESC`,
      [b.minLon, b.minLat, b.maxLon, b.maxLat, latStep, lonStep]
    );

    const maxCount = result.rows.length > 0 ? Math.max(...result.rows.map((r: { sample_count: number }) => r.sample_count)) : 1;
    const cells = result.rows.map((r: { lat: number; lon: number; sample_count: number }) => ({
      lat: parseFloat(String(r.lat)), lon: parseFloat(String(r.lon)),
      sample_count: String(r.sample_count), intensity: r.sample_count / maxCount,
    }));

    const response = { cells, resolution };
    await cacheSet(cacheKey, JSON.stringify(response), 300);
    reply.send(response);
  });

  app.get('/speed', async (request: FastifyRequest, reply: FastifyReply) => {
    const { bbox } = request.query as { bbox?: string };
    if (!bbox) { reply.code(400).send({ error: 'bbox query parameter required' }); return; }
    const b = parseBbox(bbox);

    const result = await query(
      `SELECT o.edge_id, AVG(o.speed_mps) as avg_speed, COUNT(*)::int as sample_count,
              ST_Y(ST_Centroid(e.geometry)) as lat, ST_X(ST_Centroid(e.geometry)) as lon
       FROM edge_observations o JOIN edges e ON e.edge_id = o.edge_id
       WHERE e.geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326) AND o.mode = 'walk'
       GROUP BY o.edge_id, e.geometry`,
      [b.minLon, b.minLat, b.maxLon, b.maxLat]
    );

    const cells = result.rows.map((r: { lat: number; lon: number; sample_count: number; avg_speed: number }) => ({
      lat: r.lat, lon: r.lon, sample_count: r.sample_count, intensity: r.avg_speed,
    }));
    reply.send({ cells, mode: 'walk' });
  });
}
