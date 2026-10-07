import 'package:flutter/material.dart';
import 'ExpandCancelledOrder.dart';

class CancelDetails extends StatelessWidget {
  final Map<String, dynamic> orderDetails; 
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const CancelDetails({
    super.key,
    required this.orderDetails,
    required this.userId,
    required this.token,
    required this.shopData,
  });

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

  @override
  Widget build(BuildContext context) {
    final List<Map<String, String>> clothesList = [
      {'quantity': '5', 'item': 'Shirts', 'price': '50'},
      {'quantity': '3', 'item': 'Pants', 'price': '36'},
      {'quantity': '1', 'item': 'Uniforms', 'price': '12'},
    ];

    final List<Map<String, String>> householdList = [
      {'quantity': '2', 'item': 'Blankets', 'price': '30'},
      {'quantity': '5', 'item': 'Pillowcases', 'price': '50'},
    ];

    // Calculate subtotal
    int subtotal = 0;
    for (var item in clothesList) {
      subtotal += int.parse(item['price']!);
    }
    for (var item in householdList) {
      subtotal += int.parse(item['price']!);
    }

    double deliveryFee = 50.0; // Set to 50 instead of 0
    double total = subtotal + deliveryFee;

    return Scaffold(
      backgroundColor: const Color(0xFF48006A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Header with back button
              Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ExpandCancelledOrder(
                            userId: userId,
                            token: token,
                            shopData: shopData,
                          ),
                        ),
                      );
                    },
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
                    orderDetails['orderId'] ?? '#0123456891',
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
                  child: SingleChildScrollView(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Order details
                          const Text(
                            'Order',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A0066),
                            ),
                          ),
                          Row(
                            children: [
                              Text(
                                orderDetails['orderId'] ?? '#0123456891',
                                style: const TextStyle(
                                  fontSize: 16,
                                  color: Color(0xFF9747FF),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.red[50],
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  'Cancelled',
                                  style: TextStyle(
                                    color: Colors.red[400],
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          // Service type - Dynamic based on orderDetails
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: _getServiceColor(orderDetails['service'] ?? 'WASH ONLY'),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Center(
                              child: Text(
                                orderDetails['service']?.toUpperCase() ?? 'WASH ONLY',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          // Types of clothes
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
                          const SizedBox(height: 16),
                          // Household items
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
                          const SizedBox(height: 24),
                          // Pricing Details
                          Column(
                            children: [
                              // Subtotal
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
                              // Delivery Fee
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
                              // Total
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
                          const SizedBox(height: 24),
                          // Reason for cancellation
                          const Text(
                            'Reason of cancellation',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A0066),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            orderDetails['reason'] ?? 'Shop Closed',
                            style: TextStyle(
                              fontSize: 16,
                              color: Colors.red[400],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
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