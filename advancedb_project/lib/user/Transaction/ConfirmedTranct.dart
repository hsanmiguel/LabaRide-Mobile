import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../Dashboard/laundry_dashboard_screen.dart';
import 'CancelOrder.dart';

class OrderDetailsScreen extends StatefulWidget {
  final int userId;
  final String token;
  final String? transactionId;
  final Map<String, dynamic>? transactionData;

  const OrderDetailsScreen({
    super.key,
    required this.userId,
    required this.token,
    required this.transactionId, 
    this.transactionData,
  });

  @override
  _OrderDetailsScreenState createState() => _OrderDetailsScreenState();
}

class _OrderDetailsScreenState extends State<OrderDetailsScreen> {
  final Color navyBlue = const Color(0xFF1A0066);
  bool isDetailsExpanded = false;
  bool isLoading = true;
  Map<String, dynamic>? orderData;

  @override
  void initState() {
    super.initState();
    print('Transaction ID: ${widget.transactionId}');
    print('Transaction Data: ${widget.transactionData}');

    if (widget.transactionData != null) {
      setState(() {
        orderData = widget.transactionData;
        print('Setting orderData in initState: $orderData');
        isLoading = false;
      });
    } else if (widget.transactionId != null) {
      print('Fetching order details for ID: ${widget.transactionId}');
      _fetchOrderDetails();
    } else {
      setState(() {
        isLoading = false;
        orderData = null;
      });
    }
  }

  Future<void> _fetchOrderDetails() async {
    if (widget.transactionId == null) {
      print('No transaction ID provided');
      setState(() {
        isLoading = false;
        orderData = null;
      });
      return;
    }

    try {
      print('Making API request for transaction ${widget.transactionId}');
      final response = await http.get(
        Uri.parse('http://localhost:5000/transactions/${widget.transactionId}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      print('Response Status: ${response.statusCode}');
      print('Response Body: ${response.body}');

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        print('Decoded Response: $responseData');
        
        setState(() {
          orderData = responseData['data'];
          print('Setting orderData from API: $orderData');
          isLoading = false;
        });
      } else {
        print('Using fallback transaction data');
        setState(() {
          orderData = widget.transactionData;
          isLoading = false;
        });
      }
    } catch (e) {
      print('Error fetching details: $e');
      setState(() {
        isLoading = false;
        orderData = widget.transactionData;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (orderData == null) {
      return const Scaffold(
        body: Center(child: Text('No order details found')),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Image.asset('assets/backarrowblue.png', height: 24, width: 24),
          onPressed: () {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => LaundryDashboardScreen(
                  userId: widget.userId,
                  token: widget.token,
                  initialMessage: 'Your laundry is currently being washed',
                  transactionId: widget.transactionId,
                ),
              ),
            );
          },
        ),
        title: Text(
          'Order Details',
          style: TextStyle(color: navyBlue, fontSize: 18),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildOrderHeader(),
            const SizedBox(height: 16),
            _buildOrderDetails(),
            const Divider(height: 32),
            _buildItemsList(),
            const Divider(height: 32),
            _buildPriceDetails(),
            const SizedBox(height: 24),
            _buildCancelButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Thank you for your order!',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: navyBlue,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Order #${widget.transactionId ?? orderData!['id']}',
          style: const TextStyle(
            fontSize: 16,
            color: Colors.grey,
          ),
        ),
      ],
    );
  }

  Widget _buildOrderDetails() {
    final kiloAmount = orderData!['kilo_amount']?.toString() ?? '0.0';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Service Details',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: navyBlue,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Service: ${orderData!['service_name']}\n'
          'Weight: $kiloAmount kg\n'
          'Delivery Type: ${orderData!['delivery_type']}\n'
          'Address: ${orderData!['zone']}, ${orderData!['street']}, ${orderData!['barangay']}\n'
          'Building: ${orderData!['building']}',
          style: const TextStyle(fontSize: 14),
        ),
      ],
    );
  }

Widget _buildItemsList() {
  // Handle case where items might be null or not properly formatted
  List<dynamic> items = [];
  try {
    if (orderData!['items'] != null) {
      items = json.decode(orderData!['items'].toString()) as List<dynamic>;
    }
  } catch (e) {
    print('Error parsing items: $e');
    // If parsing fails, try to use items directly if it's already a List
    if (orderData!['items'] is List) {
      items = orderData!['items'];
    }
  }
  
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Items',
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: navyBlue,
        ),
      ),
      const SizedBox(height: 8),
      if (items.isEmpty)
        const Text('No items found')
      else
        ...items.map((item) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${item['name'] ?? item['item_name'] ?? 'Unknown'} x${item['quantity'] ?? 0}'),
              Text('₱${((double.tryParse(item['quantity']?.toString() ?? '0') ?? 0) * 100).toStringAsFixed(2)}'),
            ],
          ),
        )).toList(),
    ],
  );
}

  Widget _buildPriceDetails() {
    final subtotal = double.tryParse(orderData!['subtotal'].toString()) ?? 0.0;
    final deliveryFee = double.tryParse(orderData!['delivery_fee'].toString()) ?? 0.0;
    final voucherDiscount = double.tryParse(orderData!['voucher_discount'].toString()) ?? 0.0;
    final totalAmount = double.tryParse(orderData!['total_amount'].toString()) ?? 0.0;

    return Column(
      children: [
        _buildPriceRow('Subtotal', subtotal),
        _buildPriceRow('Delivery Fee', deliveryFee),
        if (voucherDiscount > 0)
          _buildPriceRow('Voucher Discount', voucherDiscount, isDiscount: true),
        const Divider(height: 16),
        _buildPriceRow('Total Amount', totalAmount, isTotal: true),
      ],
    );
  }

  Widget _buildPriceRow(String label, double amount, {
    bool isTotal = false,
    bool isDiscount = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              fontSize: isTotal ? 16 : 14,
            ),
          ),
          Text(
            isDiscount ? '-₱${amount.toStringAsFixed(2)}' : '₱${amount.toStringAsFixed(2)}',
            style: TextStyle(
              color: isDiscount ? Colors.green : null,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              fontSize: isTotal ? 16 : 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCancelButton() {
    return Center(
      child: TextButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ConfirmCancelScreen(
                userId: widget.userId,
                token: widget.token,
                transactionId: widget.transactionId!,
              ),
            ),
          );
        },
        child: const Text(
          'Cancel Order',
          style: TextStyle(
            color: Colors.red,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}