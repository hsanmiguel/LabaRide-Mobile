import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class OngoingDetails extends StatefulWidget {
  final Map<String, dynamic> orderDetails;
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const OngoingDetails({
    super.key,
    required this.orderDetails,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  State<OngoingDetails> createState() => _OngoingDetailsState();
}

class _OngoingDetailsState extends State<OngoingDetails> {
  String currentStatus = 'In Progress';
  bool isExpanded = false;
  bool _isLoading = false;
  String _error = '';

  final List<String> statusOptions = [
    'In Progress',
    'Washing',
    'Folding',
    'Picked-up',
    'Delivering',
    'Complete',
  ];

  @override
  void initState() {
    super.initState();
    currentStatus = widget.orderDetails['status'] ?? 'In Progress';
  }

  Future<void> _updateOrderStatus(String newStatus) async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final response = await http.put(
        Uri.parse('http://localhost:5000/api/orders/${widget.orderDetails['id']}/status'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'status': newStatus}),
      );

      if (response.statusCode == 200) {
        setState(() {
          currentStatus = newStatus;
          isExpanded = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order status updated to $newStatus')),
        );
      } else {
        throw Exception('Failed to update order status');
      }
    } catch (e) {
      setState(() => _error = e.toString());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $_error')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Color _getServiceColor(String service) {
    switch (service.toUpperCase()) {
      case 'WASH ONLY':
        return const Color(0xFF98D8BF);
      case 'DRY CLEAN':
        return const Color(0xFF64B5F6);
      case 'STEAM PRESS':
        return const Color(0xFFBA68C8);
      case 'FULL SERVICE':
        return const Color(0xFFFFB74D);
      default:
        return const Color(0xFF98D8BF);
    }
  }

  List<Map<String, String>> _parseItems(String jsonString) {
    try {
      if (jsonString.isEmpty) return [];
      final List<dynamic> parsed = jsonDecode(jsonString);
      return parsed.map((item) => Map<String, String>.from(item)).toList();
    } catch (e) {
      return [];
    }
  }

  @override
  Widget build(BuildContext context) {
    // Parse order items from details or use defaults
    final List<Map<String, String>> clothesList = 
        _parseItems(widget.orderDetails['clothes'] ?? '[]');
    final List<Map<String, String>> householdList = 
        _parseItems(widget.orderDetails['household'] ?? '[]');

    // Calculate totals
    int subtotal = 0;
    for (var item in clothesList) {
      subtotal += int.parse(item['price'] ?? '0');
    }
    for (var item in householdList) {
      subtotal += int.parse(item['price'] ?? '0');
    }

    double deliveryFee = 50.0;
    double total = subtotal + deliveryFee;

    return Scaffold(
      backgroundColor: const Color(0xFF48006A),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.white))
            : Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Header
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.arrow_back,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Text(
                          '#${widget.orderDetails['id'] ?? ''}',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    // Order Card
                    Expanded(
                      child: Card(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          children: [
                            Expanded(
                              child: SingleChildScrollView(
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Order details and status
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'Order',
                                                style: TextStyle(
                                                  fontSize: 24,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF1A0066),
                                                ),
                                              ),
                                              Text(
                                                '#${widget.orderDetails['id'] ?? ''}',
                                                style: const TextStyle(
                                                  fontSize: 16,
                                                  color: Color(0xFF9747FF),
                                                ),
                                              ),
                                            ],
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color: currentStatus == 'Complete'
                                                  ? Colors.green[50]
                                                  : Colors.pink[50],
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: Text(
                                              currentStatus,
                                              style: TextStyle(
                                                color: currentStatus == 'Complete'
                                                    ? Colors.green[400]
                                                    : Colors.pink[400],
                                                fontSize: 12,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      // Service type
                                      Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                        decoration: BoxDecoration(
                                          color: _getServiceColor(
                                              widget.orderDetails['service_name'] ?? 'WASH ONLY'),
                                          borderRadius: BorderRadius.circular(16),
                                        ),
                                        child: Center(
                                          child: Text(
                                            widget.orderDetails['service_name']?.toUpperCase() ?? 'WASH ONLY',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 24),
                                      // Customer details
                                      _buildDetailsSection('Customer Details', [
                                        {'label': 'Name', 'value': widget.orderDetails['user_name'] ?? 'N/A'},
                                        {'label': 'Address', 'value': widget.orderDetails['address'] ?? 'N/A'},
                                        {'label': 'Phone', 'value': widget.orderDetails['phone'] ?? 'N/A'},
                                      ]),
                                      const SizedBox(height: 24),
                                      // Types of clothes
                                      if (clothesList.isNotEmpty) ...[
                                        const Text(
                                          'Types of clothes:',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF1A0066),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        ...clothesList.map((item) => _buildOrderItem(
                                              '${item['quantity']}x',
                                              item['item']!,
                                              '₱${item['price']}',
                                            )),
                                      ],
                                      const SizedBox(height: 16),
                                      // Household items
                                      if (householdList.isNotEmpty) ...[
                                        const Text(
                                          'Household items:',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF1A0066),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        ...householdList.map((item) => _buildOrderItem(
                                              '${item['quantity']}x',
                                              item['item']!,
                                              '₱${item['price']}',
                                            )),
                                      ],
                                      const SizedBox(height: 24),
                                      // Payment details
                                      Row(
                                        children: [
                                          const Text(
                                            'Subtotal',
                                            style: TextStyle(
                                              fontSize: 16,
                                              color: Color(0xFF666666),
                                            ),
                                          ),
                                          const Spacer(),
                                          Text(
                                            '₱$subtotal',
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          const Text(
                                            'Delivery Fee',
                                            style: TextStyle(
                                              fontSize: 16,
                                              color: Color(0xFF666666),
                                            ),
                                          ),
                                          const Spacer(),
                                          Text(
                                            '₱${deliveryFee.toInt()}',
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const Padding(
                                        padding: EdgeInsets.symmetric(vertical: 8),
                                        child: Divider(),
                                      ),
                                      Row(
                                        children: [
                                          const Text(
                                            'Total',
                                            style: TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF1A0066),
                                            ),
                                          ),
                                          const Spacer(),
                                          Text(
                                            '₱${total.toInt()}',
                                            style: const TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF9747FF),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            // Progress Section
                            Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: double.infinity,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF00B140),
                                    borderRadius: BorderRadius.vertical(
                                      bottom: Radius.circular(16),
                                    ),
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      InkWell(
                                        onTap: () {
                                          setState(() {
                                            isExpanded = !isExpanded;
                                          });
                                        },
                                        child: Padding(
                                          padding: const EdgeInsets.all(16),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                currentStatus,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                              Icon(
                                                isExpanded
                                                    ? Icons.keyboard_arrow_up
                                                    : Icons.keyboard_arrow_down,
                                                color: Colors.white,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      if (isExpanded)
                                        Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.all(16),
                                          decoration: const BoxDecoration(
                                            color: Color(0xFF006E1C),
                                            borderRadius: BorderRadius.vertical(
                                              bottom: Radius.circular(16),
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: statusOptions.map((status) => InkWell(
                                              onTap: () => _updateOrderStatus(status),
                                              child: Padding(
                                                padding: const EdgeInsets.symmetric(vertical: 8),
                                                child: Text(
                                                  status,
                                                  style: TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 16,
                                                    fontWeight: currentStatus == status
                                                        ? FontWeight.bold
                                                        : FontWeight.w500,
                                                  ),
                                                ),
                                              ),
                                            )).toList(),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildDetailsSection(String title, List<Map<String, String>> details) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1A0066),
          ),
        ),
        const SizedBox(height: 8),
        ...details.map((detail) => Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              Text(
                '${detail['label']}: ',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
              Text(
                detail['value']!,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        )),
      ],
    );
  }

  Widget _buildOrderItem(String quantity, String item, String price) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            quantity,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Color(0xFF9747FF),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            item,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
          const Spacer(),
          Text(
            price,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}