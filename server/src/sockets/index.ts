import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

export const setupSocketIO = (server: HttpServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User Room
    socket.on('join_user_room', (data: { user_id: number | string }) => {
      const room = `user_${data.user_id}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined ${room}`);
      socket.emit('room_joined', { room });
    });

    // Shop Room
    socket.on('join_shop_room', (data: { shop_id: number | string }) => {
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
