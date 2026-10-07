import 'package:flutter/material.dart';
import '../OrderingSystem/ordershopsystem.dart';
import '2PlaceOrder.dart';
import 'LaundryCount.dart';

class OrderConfirmScreen extends StatefulWidget {
  final int userId;
  final String token;
  final Service service;
  final Map<String, int> selectedItems;
  final String deliveryOption;
  final String notes;
  final double subtotal;
  final double deliveryFee;
  final double voucherDiscount;
  final Map<String, dynamic> shopData;

  const OrderConfirmScreen({
    super.key,
    required this.userId,
    required this.token,
    required this.service,
    required this.selectedItems,
    required this.deliveryOption,
    required this.notes,
    required this.subtotal,
    required this.deliveryFee,
    required this.shopData,
    this.voucherDiscount = 0.0,
  });

  @override
  _OrderConfirmScreenState createState() => _OrderConfirmScreenState();
}

class _OrderConfirmScreenState extends State<OrderConfirmScreen> {
  late final TextEditingController noteController;
  final Color navyBlue = const Color(0xFF1A0066);

  @override
  void initState() {
    super.initState();
    noteController = TextEditingController(text: widget.notes);
  }

  double get totalAmount => widget.subtotal + widget.deliveryFee - widget.voucherDiscount;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: _buildAppBar(),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              _buildOrderSummaryCard(),
              _buildServicesCard(),
              _buildNoteCard(),
              _buildTotalSection(),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _buildCheckoutButton(),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
        onPressed: () => Navigator.pop(context),
      ),
      title: Text(
        'Order Summary',
        style: TextStyle(
          color: navyBlue,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildOrderSummaryCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Image.asset(
                  'assets/basket.png',
                  height: 24,
                  color: navyBlue,
                ),
                const SizedBox(width: 12),
                const Text(
                  'Order Summary',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            Row(
              children: [
                Text(
                  '₱${widget.subtotal.toStringAsFixed(2)}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: navyBlue,
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.edit, size: 20, color: navyBlue),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServicesCard() {
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildServicesHeader(),
            if (widget.selectedItems.isNotEmpty)
              _buildSelectedItemsList(),
          ],
        ),
      ),
    );
  }

  Widget _buildServicesHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Image.asset(
              'assets/washingmachine.png',
              height: 24,
              color: navyBlue,
            ),
            const SizedBox(width: 12),
            Text(
              'Services',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: navyBlue,
              ),
            ),
          ],
        ),
        IconButton(
          icon: Icon(Icons.edit, color: navyBlue),
          onPressed: () async {
            final result = await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const EditLaundriesScreen(),
              ),
            );
            if (result != null) {
              setState(() {});
            }
          },
        ),
      ],
    );
  }

  Widget _buildSelectedItemsList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: widget.selectedItems.entries
          .where((entry) => entry.value > 0)
          .map((entry) => _buildSelectedItemRow(entry))
          .toList(),
    );
  }

  Widget _buildSelectedItemRow(MapEntry<String, int> entry) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            entry.key,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[800],
            ),
          ),
          Text(
            '${entry.value}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: navyBlue,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoteCard() {
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Note to Laundry Shop',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: navyBlue,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: noteController,
              decoration: InputDecoration(
                hintText: 'Add your note here',
                hintStyle: TextStyle(color: Colors.grey[400]),
                border: InputBorder.none,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalSection() {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildPriceRow('Subtotal', widget.subtotal),
          const SizedBox(height: 8),
          _buildPriceRow('Delivery Fee', widget.deliveryFee),
          const SizedBox(height: 8),
          _buildVoucherRow(),
          const Divider(height: 24),
          _buildTotalRow(),
        ],
      ),
    );
  }

  Widget _buildPriceRow(String label, double amount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(color: Colors.grey[600]),
        ),
        Text(
          '₱${amount.toStringAsFixed(2)}',
          style: TextStyle(
            fontWeight: FontWeight.w500,
            color: navyBlue,
          ),
        ),
      ],
    );
  }

  Widget _buildVoucherRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Voucher',
          style: TextStyle(color: Colors.grey[600]),
        ),
        Text(
          '-₱${widget.voucherDiscount.toStringAsFixed(2)}',
          style: const TextStyle(
            fontWeight: FontWeight.w500,
            color: Colors.green,
          ),
        ),
      ],
    );
  }

  Widget _buildTotalRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Total',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: navyBlue,
          ),
        ),
        Text(
          '₱${totalAmount.toStringAsFixed(2)}',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: navyBlue,
          ),
        ),
      ],
    );
  }

  Widget _buildCheckoutButton() {
    return Container(
      padding: const EdgeInsets.all(16.0),
      color: Colors.white,
      child: ElevatedButton(
        onPressed: () => _navigateToCheckout(),
        style: ElevatedButton.styleFrom(
          backgroundColor: navyBlue,
          padding: const EdgeInsets.symmetric(vertical: 16.0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8.0),
          ),
        ),
        child: const Text(
          'Proceed to checkout',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  void _navigateToCheckout() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CheckoutScreen(
          userId: widget.userId,
          token: widget.token,
          service: widget.service,
          selectedItems: widget.selectedItems,
          notes: noteController.text,
          deliveryOption: widget.deliveryOption,
          subtotal: widget.subtotal,
          deliveryFee: widget.deliveryFee,
          voucherDiscount: widget.voucherDiscount,
          shopData: widget.shopData,
        ),
      ),
    );
  }

  @override
  void dispose() {
    noteController.dispose();
    super.dispose();
  }
}