import express from 'express';
import app from './src/app';

// Vercel serves the HTTP API without starting the standalone Socket.IO server.
const handler = express();
handler.use(app);

export default handler;
