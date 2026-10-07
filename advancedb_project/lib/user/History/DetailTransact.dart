import 'package:flutter/material.dart';

class DetailTransact extends StatelessWidget {
  final Map<String, dynamic> orderDetails;

  const DetailTransact({
    super.key,
    required this.orderDetails,
  });

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
          'Full Details',
          style: TextStyle(
            color: Color(0xFF1A0066),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: () async {
              // Refresh functionality if needed
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status Card
                  Container(
                    color: const Color(0xFF1A0066),
                    padding: const EdgeInsets.all(16),
                    width: double.infinity,
                    child: Text(
                      orderDetails['status'] ?? 'Order Status',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),

                  // Shipping Information
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Shipping Information',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'LabaRider: ${orderDetails['rider_id'] ?? 'Assigning Rider'}',
                          style: const TextStyle(fontSize: 14),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Image.asset(
                              'assets/delivery.png',
                              width: 24,
                              height: 24,
                              color: Colors.blue,
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _getStatusText(orderDetails['status']),
                                  style: const TextStyle(
                                    color: Colors.blue,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  orderDetails['created_at'] ?? 'Processing',
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Delivery Information
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Delivery Information',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Image.asset(
                              'assets/shop.png',
                              width: 24,
                              height: 24,
                              color: Colors.grey[600],
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    orderDetails['user_name'] ?? 'Customer Name',
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                  Text(
                                    _formatAddress(orderDetails),
                                    style: TextStyle(
                                      color: Colors.grey[600],
                                      fontSize: 12,
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

                  // Shop Section
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          orderDetails['shop_name'] ?? 'Shop Name',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Image.asset(
                              'assets/washonly.png',
                              width: 50,
                              height: 50,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    orderDetails['service_name'] ?? 'Service',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w500,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const Text(
                                    'Standard laundering, folding.',
                                    style: TextStyle(
                                      color: Colors.grey,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              '₱${orderDetails['total_amount']?.toString() ?? '0.00'}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Order Summary
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _buildSummaryRow(
                          'Subtotal',
                          '₱${orderDetails['subtotal']?.toString() ?? '0.00'}'
                        ),
                        const SizedBox(height: 8),
                        _buildSummaryRow(
                          'Delivery Fee',
                          '₱${orderDetails['delivery_fee']?.toString() ?? '0.00'}'
                        ),
                        if (orderDetails['voucher_discount'] != null &&
                            orderDetails['voucher_discount'] > 0) ...[
                          const SizedBox(height: 8),
                          _buildSummaryRow(
                            'Voucher Discount',
                            '-₱${orderDetails['voucher_discount']?.toString() ?? '0.00'}',
                            isDiscount: true,
                          ),
                        ],
                        const Divider(height: 24),
                        _buildSummaryRow(
                          'Total',
                          '₱${orderDetails['total_amount']?.toString() ?? '0.00'}',
                          isTotal: true,
                        ),
                      ],
                    ),
                  ),

                  // Order Details
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _buildSummaryRow(
                          'Order ID:',
                          '#${orderDetails['id']?.toString() ?? ''}'
                        ),
                        const SizedBox(height: 8),
                        _buildSummaryRow(
                          'Payment Method',
                          orderDetails['payment_method'] ?? 'Cash on Delivery'
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),

          // Order Again Button
          if (orderDetails['status']?.toLowerCase() == 'completed')
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 4,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
                child: ElevatedButton(
                  onPressed: () {
                    // Implement order again functionality
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.red,
                    elevation: 0,
                    side: const BorderSide(color: Colors.red),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    minimumSize: const Size(double.infinity, 48),
                  ),
                  child: const Text(
                    'Order Again',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _getStatusText(String? status) {
    if (status == null) return 'Processing';
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Order has been delivered';
      case 'processing':
        return 'Order is being processed';
      case 'cancelled':
        return 'Order was cancelled';
      default:
        return status;
    }
  }

  String _formatAddress(Map<String, dynamic> details) {
  try {
    final List<String> addressParts = [];
    
    // Check for address fields and add them if they exist
    if (details['address'] != null && details['address'].toString().isNotEmpty) {
      addressParts.add(details['address'].toString());
    }
    
    // Only add specific parts if they exist and aren't empty
    final locationDetails = details['location'] ?? {};
    if (locationDetails is Map) {
      if (locationDetails['zone'] != null && locationDetails['zone'].toString().isNotEmpty) {
        addressParts.add('Zone ${locationDetails['zone']}');
      }
      if (locationDetails['street'] != null && locationDetails['street'].toString().isNotEmpty) {
        addressParts.add(locationDetails['street'].toString());
      }
      if (locationDetails['barangay'] != null && locationDetails['barangay'].toString().isNotEmpty) {
        addressParts.add(locationDetails['barangay'].toString());
      }
      if (locationDetails['building'] != null && locationDetails['building'].toString().isNotEmpty) {
        addressParts.add(locationDetails['building'].toString());
      }
    }

    // If no address parts are available, return a default message
    return addressParts.isEmpty ? 'Address not available' : addressParts.join(', ');
  } catch (e) {
    print('Error formatting address: $e');
    return 'Address not available';
  }
}

  Widget _buildSummaryRow(String label, String value, {bool isTotal = false, bool isDiscount = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isTotal ? Colors.black : Colors.grey[600],
            fontSize: isTotal ? 16 : 14,
            fontWeight: isTotal ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: isDiscount ? Colors.green : (isTotal ? Colors.black : Colors.grey[600]),
            fontSize: isTotal ? 16 : 14,
            fontWeight: isTotal ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ],
    );
  }
}