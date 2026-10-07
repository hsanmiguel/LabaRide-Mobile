import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'PastTransact.dart';
import 'DetailTransact.dart';
import '../../Sockets/socketService.dart';

class ActiveTransact extends StatefulWidget {
  final int userId;
  final String token;

  const ActiveTransact({
    super.key,
    required this.userId,
    required this.token,
  });

  @override
  State<ActiveTransact> createState() => _ActiveTransactState();
}

class _ActiveTransactState extends State<ActiveTransact> {
  bool _isLoading = false;
  String _error = '';
  List<Map<String, dynamic>> _activeOrders = [];

  @override
  void initState() {
    super.initState();
    _initializeSocket();
    _fetchActiveOrders();
  }

  void _initializeSocket() {
    try {
      SocketService.initializeSocket();
      SocketService.joinUserRoom(widget.userId.toString());
      
      SocketService.listenToStatusUpdates((data) {
        if (!mounted) return;
        
        try {
          setState(() {
            final index = _activeOrders.indexWhere((t) => 
              t['id'].toString() == data['transaction_id'].toString());
              
            if (index != -1) {
              _activeOrders[index]['status'] = data['status'];
              _activeOrders[index]['notes'] = data['notes'];
              
              if (data['total_amount'] != null) {
                _activeOrders[index]['total_amount'] = data['total_amount'];
              }
              
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Order ${data['transaction_id']} status updated to: ${data['status']}'
                  ),
                  backgroundColor: const Color(0xFF1A0066),
                  duration: const Duration(seconds: 3),
                ),
              );
              
              if (data['status'].toString().toLowerCase() == 'completed' || 
                  data['status'].toString().toLowerCase() == 'cancelled') {
                _activeOrders.removeAt(index);
              }
            }
          });
        } catch (e) {
          print('Error handling status update: $e');
        }
      });
    } catch (e) {
      print('Error initializing socket: $e');
    }
  }

  @override
  void dispose() {
    try {
      SocketService.dispose();
    } catch (e) {
      print('Error disposing socket: $e');
    }
    super.dispose();
  }

 Future<void> _fetchActiveOrders() async {
  setState(() {
    _isLoading = true;
    _error = '';
  });

  try {
    final response = await http.get(
      // Changed from /active to filtering in the frontend
      Uri.parse('http://localhost:5000/user_transactions/${widget.userId}'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final allTransactions = List<Map<String, dynamic>>.from(data['data'] ?? []);
      
      // Filter active orders (status is 'Processing' or 'Pending')
      final activeOrders = allTransactions.where((order) {
        final status = order['status']?.toString().toLowerCase() ?? '';
        return status == 'processing' || status == 'pending';
      }).toList();

      setState(() {
        _activeOrders = activeOrders;
        _isLoading = false;
      });
    } else {
      throw Exception('Failed to load active orders');
    }
  } catch (e) {
    setState(() {
      _error = e.toString();
      _isLoading = false;
    });
  }
}

  String _formatDateTime(String dateTime) {
    try {
      final date = DateTime.parse(dateTime);
      final now = DateTime.now();
      final difference = now.difference(date);

      if (difference.inDays == 0) {
        return 'Today';
      } else if (difference.inDays == 1) {
        return 'Yesterday';
      } else {
        return '${date.day}/${date.month}/${date.year}';
      }
    } catch (e) {
      return dateTime;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'History',
          style: TextStyle(
            color: Color(0xFF1A0066),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Column(
        children: [
          // Custom Tab Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: Colors.grey[200]!),
              ),
            ),
            child: Row(
              children: [
                Column(
                  children: [
                    const Text(
                      'Active Order',
                      style: TextStyle(
                        color: Color(0xFF375DFB),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 2,
                      width: 100,
                      color: const Color(0xFF375DFB),
                    ),
                  ],
                ),
                const SizedBox(width: 24),
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => PastTransact(
                          userId: widget.userId,
                          token: widget.token,
                        ),
                      ),
                    );
                  },
                  child: Column(
                    children: [
                      Text(
                        'Past Order',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        height: 2,
                        width: 100,
                        color: Colors.transparent,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Orders List
          Expanded(
            child: _isLoading 
                ? const Center(child: CircularProgressIndicator())
                : _error.isNotEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(_error),
                            ElevatedButton(
                              onPressed: _fetchActiveOrders,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _activeOrders.isEmpty
                        ? Center(
                            child: Text(
                              'No active orders',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 16,
                              ),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchActiveOrders,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  children: _activeOrders.map((order) {
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 16.0),
                                      child: _buildOrderCard(
                                        date: _formatDateTime(order['created_at'] ?? ''),
                                        orderId: '#${order['id'] ?? ''}',
                                        location: order['shop_name'] ?? 'Unknown Location',
                                        amount: '₱${order['total_amount'] ?? '0.00'}',
                                        deliveryFee: '₱${order['delivery_fee'] ?? '0.00'}',
                                        status: order['status'] ?? 'Processing',
                                        service: order['service_name'] ?? 'Unknown Service',
                                        orderDetails: order,
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderCard({
    required String date,
    required String orderId,
    required String location,
    required String amount,
    required String deliveryFee,
    required String status,
    required String service,
    required Map<String, dynamic> orderDetails,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 1,
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text(
              date,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 12,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Order ID: $orderId',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: status.toLowerCase() == 'processing'
                            ? Colors.orange[50]
                            : Colors.blue[50],
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          color: status.toLowerCase() == 'processing'
                              ? Colors.orange
                              : Colors.blue,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  location,
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Service: $service',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Amount Paid',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            amount,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Delivery Charges',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            deliveryFee,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => DetailTransact(
                              orderDetails: {
                                'date': date,
                                'orderId': orderId,
                                'location': location,
                                'serviceAmount': amount,
                                'deliveryFee': deliveryFee,
                                'status': status,
                                'service_name': service,
                                ...orderDetails,
                              },
                            ),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF375DFB),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text(
                        'Details',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}