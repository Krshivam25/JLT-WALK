import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { checkDatabase } from './config/database.js';
import { initRedis, getRedis } from './config/redis.js';
import { errorHandler } from './utils/errors.js';
import authRoutes from './routes/auth/index.js';
import traceRoutes from './routes/traces/index.js';
import routeRoutes from './routes/route/index.js';
import pinRoutes from './routes/pins/index.js';
import heatmapRoutes from './routes/heatmap/index.js';
import edgeRoutes from './routes/edges/index.js';
import userRoutes from './routes/user/index.js';
import adminRoutes from './routes/admin/index.js';
import shortcutRoutes from './routes/shortcuts/index.js';
import leaderboardRoutes from './routes/leaderboard/index.js';
import discoveredRouteRoutes from './routes/discovered-routes/index.js';

const app = Fastify({ logger: true });

app.setErrorHandler((error, _request, reply) => {
  const result = errorHandler(error);
  reply.code(result.statusCode).send(result);
});

async function start() {
  // CORS
  await app.register(cors, { origin: config.corsOrigin });

  // JWT
  await app.register(jwt, { secret: config.jwtSecret });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });

  // Swagger
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'JLT Walk API',
        description: 'Pedestrian routing API with trace learning and community features for Jumeirah Lakes Towers',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development' },
        { url: 'https://api.jltwalk.app', description: 'Production' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Redis
  initRedis();

  // Health check
  app.get('/health', async () => {
    const dbOk = await checkDatabase();
    const redisOk = !!getRedis();
    return {
      status: dbOk ? (redisOk ? 'ok' : 'degraded') : 'error',
      timestamp: new Date().toISOString(),
      services: { database: dbOk, redis: redisOk },
    };
  });

  // API routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(traceRoutes, { prefix: '/api/v1/traces' });
  await app.register(routeRoutes, { prefix: '/api/v1/route' });
  await app.register(pinRoutes, { prefix: '/api/v1/pins' });
  await app.register(heatmapRoutes, { prefix: '/api/v1/heatmap' });
  await app.register(edgeRoutes, { prefix: '/api/v1/edges' });
  await app.register(userRoutes, { prefix: '/api/v1/user' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(shortcutRoutes, { prefix: '/api/v1/shortcuts' });
  await app.register(leaderboardRoutes, { prefix: '/api/v1/leaderboard' });
  await app.register(discoveredRouteRoutes, { prefix: '/api/v1/discovered-routes' });

  // Start
  await app.listen({ port: config.port, host: config.host });
  console.log(`Server running at http://${config.host}:${config.port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
