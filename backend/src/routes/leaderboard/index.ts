import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../config/database.js';
import { optionalAuth, authenticate } from '../../middleware/auth.js';
import { cacheGet, cacheSet } from '../../config/redis.js';

export default async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [optionalAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { period = 'all', limit = '20' } = request.query as Record<string, string>;

    const cacheKey = `leaderboard:${period}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) { reply.send(JSON.parse(cached)); return; }

    let timeFilter = '';
    if (period === 'week') timeFilter = "AND pe.created_at > NOW() - INTERVAL '7 days'";
    else if (period === 'month') timeFilter = "AND pe.created_at > NOW() - INTERVAL '30 days'";

    const result = await query(
      `SELECT u.id as user_id, u.email as display_name, COALESCE(SUM(pe.points), 0)::int as points
       FROM users u LEFT JOIN point_events pe ON pe.user_id = u.id ${timeFilter}
       GROUP BY u.id, u.email HAVING COALESCE(SUM(pe.points), 0) > 0
       ORDER BY points DESC LIMIT $1`,
      [parseInt(limit)]
    );

    const entries = result.rows.map((r: { user_id: string; display_name: string; points: number }, i: number) => ({
      rank: i + 1, ...r,
    }));

    let user_rank = null;
    if (request.userData) {
      const allResult = await query(
        `SELECT user_id, rank FROM (
          SELECT u.id as user_id, ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pe.points), 0) DESC) as rank
          FROM users u LEFT JOIN point_events pe ON pe.user_id = u.id ${timeFilter}
          GROUP BY u.id HAVING COALESCE(SUM(pe.points), 0) > 0
        ) sub WHERE user_id = $1`,
        [request.userData.id]
      );
      user_rank = allResult.rows[0] ? parseInt(String(allResult.rows[0].rank)) : null;
    }

    const response = { entries, total: entries.length, user_rank };
    await cacheSet(cacheKey, JSON.stringify(response), 60);
    reply.send(response);
  });

  app.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      `WITH ranked AS (
        SELECT u.id, u.email as display_name, COALESCE(SUM(pe.points), 0)::int as points,
               ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pe.points), 0) DESC) as rank
        FROM users u LEFT JOIN point_events pe ON pe.user_id = u.id GROUP BY u.id, u.email
      )
      SELECT * FROM ranked WHERE id = $1
      UNION ALL
      (SELECT * FROM ranked WHERE rank BETWEEN
        (SELECT rank - 2 FROM ranked WHERE id = $1) AND
        (SELECT rank + 2 FROM ranked WHERE id = $1))
      ORDER BY rank`,
      [request.userData!.id]
    );
    reply.send({ entries: result.rows });
  });
}
