import 'package:flutter/material.dart';

class IndividualTransact extends StatelessWidget {
  final Map<String, String> transactionData;

  const IndividualTransact({
    super.key,
    required this.transactionData,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A0066),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Order #${transactionData['customerId']?.substring(1) ?? 'N/A'}',
          style: const TextStyle(color: Colors.white),
        ),
      ),
      body: Container(
        margin: const EdgeInsets.only(top: 20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionTitle('Customer Information'),
                _buildDetailItem('Customer ID', transactionData['customerId'] ?? 'N/A'),
                _buildDetailItem('Recipient Name', transactionData['recipientName'] ?? 'N/A'),
                
                const SizedBox(height: 24),
                _buildSectionTitle('Status Information'),
                _buildDetailItem('Status', transactionData['statusType'] ?? 'N/A'),
                _buildDetailItem('Order Status', transactionData['orderStatus'] ?? 'N/A'),

                const SizedBox(height: 24),
                _buildSectionTitle('Order Details'),
                _buildOrderDetailsCard(),

                const SizedBox(height: 24),
                _buildSectionTitle('Payment Information'),
                _buildDetailItem('Payment Type', transactionData['paymentType'] ?? 'N/A'),
                _buildDetailItem('Total Amount', transactionData['totalAmount'] ?? 'N/A'),
                _buildDetailItem('Payment Status', transactionData['paymentStatus'] ?? 'N/A'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOrderDetailsCard() {
    final double totalAmount = double.tryParse(transactionData['totalAmount']?.replaceAll('₱', '') ?? '0') ?? 0.0;
    final double servicePrice = 100.00;
    final double shippingFee = 50.00;
    final double shippingDiscount = -10.00;
    // Calculate laundries subtotal by subtracting shipping and discounts from total
    final double laundriesSubtotal = totalAmount - shippingFee - shippingDiscount;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Image.asset(
                'assets/washonly.png',
                width: 80,
                height: 80,
                fit: BoxFit.cover,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Wash Only',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A0066),
                      ),
                    ),
                    Text(
                      'Standard laundering, folding.',
                      style: TextStyle(
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '₱${servicePrice.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildItemsSection('Types of clothes:', [
            _buildItemRow('5x', 'Shirts'),
            _buildItemRow('3x', 'Pants'),
            _buildItemRow('1x', 'Uniforms'),
          ]),
          const SizedBox(height: 16),
          _buildItemsSection('Household items:', [
            _buildItemRow('2x', 'Blankets'),
            _buildItemRow('5x', 'Pillowcases'),
          ]),
          const SizedBox(height: 20),
          Divider(color: Colors.grey.shade200),
          const SizedBox(height: 12),
          _buildPriceRow('Laundries Subtotal', '₱${laundriesSubtotal.toStringAsFixed(2)}'),
          _buildPriceRow('Shipping Fee', '₱${shippingFee.toStringAsFixed(2)}'),
          _buildPriceRow('Shipping Discount Subtotal', '₱${shippingDiscount.toStringAsFixed(2)}'),
          const SizedBox(height: 12),
          Divider(color: Colors.grey.shade200),
          const SizedBox(height: 12),
          _buildPriceRow('Order Total:', transactionData['totalAmount'] ?? 'N/A', isTotal: true),
        ],
      ),
    );
  }

  Widget _buildItemsSection(String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF1A0066),
          ),
        ),
        const SizedBox(height: 8),
        ...items,
      ],
    );
  }

  Widget _buildItemRow(String quantity, String item) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(
            quantity,
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: Color(0xFF1A0066),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            item,
            style: TextStyle(
              color: Colors.grey[600],
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
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              color: isTotal ? Color(0xFF1A0066) : Colors.grey[600],
            ),
          ),
          Text(
            amount,
            style: TextStyle(
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              color: isTotal ? Color(0xFF1A0066) : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: Color(0xFF1A0066),
        ),
      ),
    );
  }

  Widget _buildDetailItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}