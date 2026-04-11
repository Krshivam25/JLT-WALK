import { FastifyRequest, FastifyReply } from 'fastify';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userData?: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<JwtPayload>();
    request.userData = decoded;
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<JwtPayload>();
    request.userData = decoded;
  } catch {
    // No auth is fine
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!request.userData || !roles.includes(request.userData.role)) {
      reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}
