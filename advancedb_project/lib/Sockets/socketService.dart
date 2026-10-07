import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  static IO.Socket? socket;
  static bool isConnected = false;

  static void initializeSocket() {
    if (socket != null) return;

    socket = IO.io('http://localhost:5000', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'reconnection': true,
      'reconnectionDelay': 1000,
      'reconnectionAttempts': 5
    });

    socket?.onConnect((_) {
      print('Socket Connected');
      isConnected = true;
    });

    socket?.onDisconnect((_) {
      print('Socket Disconnected');
      isConnected = false;
    });

    socket?.onConnectError((error) => print('Connect Error: $error'));
    socket?.onError((error) => print('Socket Error: $error'));

    socket?.connect();
  }

  static void joinUserRoom(String userId) {
    if (!isConnected) {
      print('Socket not connected, attempting to connect...');
      initializeSocket();
    }
    
    if (userId.isNotEmpty) {
      socket?.emit('join_user_room', {'user_id': userId});
      print('Joining user room: $userId');
    }
  }

  static void listenToStatusUpdates(Function(dynamic) onStatusUpdate) {
    socket?.on('status_update', (data) {
      print('Status update received: $data');
      onStatusUpdate(data);
    });

    socket?.on('room_joined', (data) {
      print('Room joined confirmation: $data');
    });
  }

  static void joinShopRoom(String shopId) {
    if (!isConnected) {
      print('Socket not connected, attempting to connect...');
      initializeSocket();
    }
    
    if (shopId.isNotEmpty) {
      socket?.emit('join_shop_room', {'shop_id': shopId});
      print('Joining shop room: $shopId');
    }
  }

  static void listenToTransactionUpdates(Function(Map<String, dynamic>) onNewTransaction) {
    socket?.on('new_transaction', (data) {
      print('New transaction received: $data');
      if (data != null && data is Map) {
        onNewTransaction(Map<String, dynamic>.from(data));
      }
    });
  }

  static void dispose() {
    if (socket != null) {
      socket?.disconnect();
      socket?.close();
      socket = null;
      isConnected = false;
      print('Socket disposed');
    }
  }
}