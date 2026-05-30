import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// ✅ Middleware de reconexão automática para erros de conexão
// (evita o erro "terminating connection due to administrator command" na Discloud)
let reconnectAttempts = 0;
const MAX_RECONNECT = 3;

prisma.$use(async (params, next) => {
  try {
    const result = await next(params);
    reconnectAttempts = 0; // reset em sucesso
    return result;
  } catch (error) {
    const isConnErr =
      error.code === 'P1000' ||
      error.code === 'P1001' ||
      error.code === 'P1002' ||
      error.code === 'P2034' ||
      (error.message && (
        error.message.includes('terminating')   ||
        error.message.includes('administrator') ||
        error.message.includes('connection')    ||
        error.message.includes('FATAL')
      ));

    if (isConnErr && reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      const delay = Math.min(1000 * reconnectAttempts, 5000);
      console.warn(`⚠️ [Prisma] Erro de conexão — retry ${reconnectAttempts}/${MAX_RECONNECT} em ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      try {
        const result = await next(params);
        reconnectAttempts = 0;
        return result;
      } catch (retryErr) {
        reconnectAttempts = 0;
        throw retryErr;
      }
    }
    throw error;
  }
});

// ✅ Graceful shutdown
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

export default prisma;
