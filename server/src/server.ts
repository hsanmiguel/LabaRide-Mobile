import http from 'http';
import app from './app';
import { env } from './config/env';
import { setupSocketIO } from './sockets';
import prisma from './config/database';
import { describeDatabaseError } from './utils/database-error';

const server = http.createServer(app);

// Setup Socket.IO
export const io = setupSocketIO(server);
app.set('io', io);

// Start Server
const startServer = async () => {
  try {
    // Check Database connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database');

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(env.PORT, () => {
        server.removeListener('error', reject);
        console.log(`Server running on port ${env.PORT}`);
        resolve();
      });
    });
  } catch (error) {
    const failure = describeDatabaseError(error);
    console.error(failure.isDatabaseError
      ? `Failed to start server (${failure.code}). ${failure.message}`
      : 'Failed to start HTTP server. Check port availability and server configuration.');
    try { await prisma.$disconnect(); } catch { /* Preserve the startup failure. */ }
    process.exit(1);
  }
};

startServer();

// Handle unexpected shutdown
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await prisma.$disconnect();
    process.exit(0);
  } catch {
    console.error('Server cleanup failed.');
    process.exit(1);
  }
};
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
