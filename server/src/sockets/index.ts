import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/database';

export const setupSocketIO = (server: HttpServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token, env.JWT_SECRET) as jwt.JwtPayload;
      if (!Number.isSafeInteger(decoded.userId) || decoded.userId <= 0) return next(new Error('Authentication required'));
      const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true } });
      if (!user) return next(new Error('Authentication required'));
      socket.data.userId = user.id;
      next();
    } catch { next(new Error('Authentication required')); }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User Room
    socket.on('join_user_room', (data: { user_id: number | string }) => {
      if (Number(data?.user_id) !== socket.data.userId) return;
      const room = `user_${data.user_id}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined ${room}`);
      socket.emit('room_joined', { room });
    });

    // Shop Room
    socket.on('join_shop_room', async (data: { shop_id: number | string }) => {
      const id = Number(data?.shop_id);
      if (!Number.isSafeInteger(id) || id <= 0) return;
      try {
        const shop = await prisma.shop.findUnique({ where: { id }, select: { userId: true, approvalStatus: true } });
        if (!shop || shop.userId !== socket.data.userId || shop.approvalStatus !== 'Approved') return;
      } catch { return; }
      const room = `shop_${data.shop_id}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined ${room}`);
      socket.emit('room_joined', { room });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};
