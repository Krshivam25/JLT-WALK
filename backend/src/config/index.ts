import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/jltwalk_api',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: '7d',
  jwtRefreshExpiresIn: '30d',
  corsOrigin: true as const,
  rateLimit: {
    max: 100,
    timeWindow: '1 minute',
  },
};
