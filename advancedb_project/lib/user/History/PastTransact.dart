import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'ActiveTransact.dart';
import 'DetailTransact.dart';
import '../ProfileUser/UserProfile.dart';

class PastTransact extends StatefulWidget {
  final int userId;
  final String token;

  const PastTransact({
    super.key,
    required this.userId,
    required this.token,
  });

  @override
  State<PastTransact> createState() => _PastTransactState();
}

class _PastTransactState extends State<PastTransact> {
  bool _isLoading = false;
  String _error = '';
  List<Map<String, dynamic>> _pastOrders = [];

  @override
  void initState() {
    super.initState();
    _fetchPastOrders();
  }

  Future<void> _fetchPastOrders() async {
  setState(() {
    _isLoading = true;
    _error = '';
  });

  try {
    final response = await http.get(
      // Changed from /completed to filtering in the frontend
      Uri.parse('http://localhost:5000/user_transactions/${widget.userId}'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final allTransactions = List<Map<String, dynamic>>.from(data['data'] ?? []);
      
      // Filter completed or cancelled orders
      final pastOrders = allTransactions.where((order) {
        final status = order['status']?.toString().toLowerCase() ?? '';
        return status == 'completed' || status == 'cancelled';
      }).toList();

      setState(() {
        _pastOrders = pastOrders;
        _isLoading = false;
      });
    } else {
      throw Exception('Failed to load past orders');
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
    // Keep existing build method
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
          onPressed: () => Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => ProfileScreen(
                userId: widget.userId,
                token: widget.token,
              ),
            ),
          ),
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
          // Keep existing custom tab bar
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
                GestureDetector(
                  onTap: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ActiveTransact(
                          userId: widget.userId,
                          token: widget.token,
                        ),
                      ),
                    );
                  },
                  child: Column(
                    children: [
                      Text(
                        'Active Order',
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
                const SizedBox(width: 24),
                Column(
                  children: const [
                    Text(
                      'Past Order',
                      style: TextStyle(
                        color: Color(0xFF375DFB),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: 8),
                    SizedBox(
                      height: 2,
                      width: 100,
                      child: ColoredBox(color: Color(0xFF375DFB)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Updated Orders List
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
                              onPressed: _fetchPastOrders,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _pastOrders.isEmpty
                        ? Center(
                            child: Text(
                              'No past orders',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 16,
                              ),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchPastOrders,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  children: _pastOrders.map((order) {
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 16.0),
                                      child: _buildOrderCard(
                                        context,
                                        date: _formatDateTime(order['created_at'] ?? ''),
                                        orderId: '#${order['id'] ?? ''}',
                                        location: order['shop_name'] ?? 'Unknown Location',
                                        amount: '₱${order['total_amount'] ?? '0.00'}',
                                        deliveryFee: '₱${order['delivery_fee'] ?? '0.00'}',
                                        status: order['status'] ?? 'Completed',
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

  Widget _buildOrderCard(
    BuildContext context, {
    required String date,
    required String orderId,
    required String location,
    required String amount,
    required String deliveryFee,
    required String status,
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
                        color: Colors.green[50],
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          color: Colors.green[700],
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
                              orderDetails: orderDetails,
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