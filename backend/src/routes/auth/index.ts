import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { registerSchema, loginSchema } from '../../utils/validation.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerSchema.parse(request.body);
    const hash = await bcrypt.hash(body.password, 10);
    try {
      const result = await query(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)
         RETURNING id, email, role, points, prefs, created_at`,
        [body.email.toLowerCase(), hash]
      );
      const user = result.rows[0];
      const access_token = app.jwt.sign({ id: user.id, email: user.email, role: user.role }, { expiresIn: '7d' });
      const refresh_token = app.jwt.sign({ id: user.id, type: 'refresh' }, { expiresIn: '30d' });
      reply.code(201).send({ access_token, refresh_token, user });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        reply.code(409).send({ error: 'Email already registered' }); return;
      }
      throw err;
    }
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);
    const result = await query('SELECT * FROM users WHERE email = $1', [body.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(body.password, user.password_hash))) {
      reply.code(401).send({ error: 'Login failed', message: 'Invalid email or password' }); return;
    }
    const access_token = app.jwt.sign({ id: user.id, email: user.email, role: user.role }, { expiresIn: '7d' });
    const refresh_token = app.jwt.sign({ id: user.id, type: 'refresh' }, { expiresIn: '30d' });
    reply.send({
      access_token, refresh_token,
      user: { id: user.id, email: user.email, role: user.role, points: user.points, prefs: user.prefs },
    });
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refresh_token } = request.body as { refresh_token: string };
    if (!refresh_token) { reply.code(400).send({ error: 'refresh_token required' }); return; }
    try {
      const decoded = app.jwt.verify<{ id: string; type: string }>(refresh_token);
      if (decoded.type !== 'refresh') throw new Error('bad type');
      const result = await query('SELECT id, email, role FROM users WHERE id = $1', [decoded.id]);
      if (!result.rows[0]) { reply.code(401).send({ error: 'User not found' }); return; }
      const user = result.rows[0];
      const access_token = app.jwt.sign({ id: user.id, email: user.email, role: user.role }, { expiresIn: '7d' });
      const new_refresh = app.jwt.sign({ id: user.id, type: 'refresh' }, { expiresIn: '30d' });
      reply.send({ access_token, refresh_token: new_refresh });
    } catch {
      reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  app.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      'SELECT id, email, role, prefs, points, created_at FROM users WHERE id = $1',
      [request.userData!.id]
    );
    if (!result.rows[0]) { reply.code(404).send({ error: 'User not found' }); return; }
    reply.send(result.rows[0]);
  });
}
