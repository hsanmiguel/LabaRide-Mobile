import 'package:flutter/material.dart';
import 'DeclineOrder/DeclineOrder1.dart';

class AcceptingOrder extends StatelessWidget {
  final Map<String, dynamic> orderDetails;  // Kept as dynamic for flexibility
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const AcceptingOrder({
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
    // Convert dynamic values to String where needed
    String serviceType = (orderDetails['service'] ?? 'WASH ONLY').toString();
    
    final List<Map<String, String>> clothesList = [
      {'quantity': '5', 'item': 'Shirts', 'price': '50'},
      {'quantity': '3', 'item': 'Pants', 'price': '36'},
      {'quantity': '1', 'item': 'Uniforms', 'price': '12'},
    ];

    final List<Map<String, String>> householdList = [
      {'quantity': '2', 'item': 'Blankets', 'price': '30'},
      {'quantity': '5', 'item': 'Pillowcases', 'price': '50'},
    ];

    // Calculate totals
    int subtotal = 0;
    for (var item in clothesList) {
      subtotal += int.parse(item['price']!);
    }
    for (var item in householdList) {
      subtotal += int.parse(item['price']!);
    }

    const int deliveryFee = 50;
    final int total = subtotal + deliveryFee;

    return Scaffold(
      backgroundColor: const Color(0xFF48006A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
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
                        orderDetails['orderId']?.toString() ?? '#0123456891',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: () {
                      showDialog(
                        context: context,
                        builder: (BuildContext context) {
                          return DeclineOrderDialog(
                            onReasonSelected: (String reason) {
                              print('Order declined: $reason');
                              Navigator.of(context).pop();
                              Navigator.of(context).pop();
                            },
                            userId: userId,
                            token: token,
                            shopData: shopData,
                            orderDetails: orderDetails,  // Keep passing orderDetails
                          );
                        },
                      );
                    },
                    child: const Text(
                      'Decline',
                      style: TextStyle(
                        color: Colors.red,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
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
                        Text(
                          orderDetails['orderId']?.toString() ?? '#0123456891',
                          style: const TextStyle(
                            fontSize: 16,
                            color: Color(0xFF9747FF),
                          ),
                        ),
                        const SizedBox(height: 16),
                        // Service type
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: _getServiceColor(serviceType),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Center(
                            child: Text(
                              serviceType.toUpperCase(),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        ),
                        // ...rest of your existing widget tree...
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
                              '${item['item']}',
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
                              '${item['item']}',
                              '₱${item['price']}',
                            )),
                        const SizedBox(height: 24),
                        // Total section
                        _buildPriceRow('Subtotal', '₱$subtotal'),
                        _buildPriceRow('Delivery Fee', '₱$deliveryFee'),
                        const Divider(height: 24),
                        _buildPriceRow('Total', '₱$total', isTotal: true),
                        const Spacer(),
                        // Accept button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: const Text(
                              'Accept',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ],
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

  // Helper widgets remain unchanged
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

  Widget _buildPriceRow(String label, String amount, {bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 16 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
              color: isTotal ? const Color(0xFF1A0066) : Colors.grey[600],
            ),
          ),
          Text(
            amount,
            style: TextStyle(
              fontSize: isTotal ? 16 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
              color: isTotal ? const Color(0xFF9747FF) : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }
}