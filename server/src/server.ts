import http from 'http';
import app from './app';
import { env } from './config/env';
import { setupSocketIO } from './sockets';
import prisma from './config/database';

const server = http.createServer(app);

// Setup Socket.IO
export const io = setupSocketIO(server);

// Start Server
const startServer = async () => {
  try {
    // Check Database connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database');

    server.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle unexpected shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
