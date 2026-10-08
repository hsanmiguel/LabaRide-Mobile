import { io, Socket } from "socket.io-client";
import { API_URL } from "../api/client";

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private userId: number | null = null;
  private shopId: number | null = null;

  initialize() {
    if (this.socket) return;

    this.socket = io(API_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on("connect", () => {
      console.log("Socket Connected");
      this.isConnected = true;
      if (this.userId !== null)
        this.socket?.emit("join_user_room", { user_id: this.userId });
      if (this.shopId !== null)
        this.socket?.emit("join_shop_room", { shop_id: this.shopId });
    });

    this.socket.on("disconnect", () => {
      console.log("Socket Disconnected");
      this.isConnected = false;
    });
  }

  joinUserRoom(userId: number) {
    this.userId = userId;
    if (!this.isConnected) this.initialize();
    this.socket?.emit("join_user_room", { user_id: userId });
    console.log(`Joining user room: ${userId}`);
  }

  joinShopRoom(shopId: number) {
    this.shopId = shopId;
    if (!this.isConnected) this.initialize();
    this.socket?.emit("join_shop_room", { shop_id: shopId });
    console.log(`Joining shop room: ${shopId}`);
  }

  onTransactionUpdate(callback: (data: unknown) => void) {
    this.socket?.on("status_update", callback);
    return () => {
      this.socket?.off("status_update", callback);
    };
  }

  onNewTransaction(callback: (data: unknown) => void) {
    this.socket?.on("new_transaction", callback);
    return () => {
      this.socket?.off("new_transaction", callback);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.userId = null;
      this.shopId = null;
    }
  }
}

export const socketService = new SocketService();
