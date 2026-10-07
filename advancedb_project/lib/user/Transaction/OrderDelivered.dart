import 'package:flutter/material.dart';

class OrderDeliveredScreen extends StatefulWidget {
  const OrderDeliveredScreen({super.key});

  @override
  _OrderDeliveredScreenState createState() => _OrderDeliveredScreenState();
}

class _OrderDeliveredScreenState extends State<OrderDeliveredScreen> {
  bool isDetailsExpanded = false;
  final Color navyBlue = const Color(0xFF1A0066);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Image.asset(
            'assets/exit.png', 
            height: 24,
            width: 24,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Order Delivered',
          style: TextStyle(
            color: navyBlue,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Order Complete Section
              Text(
                'Order Complete',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: navyBlue,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Thank you for your order in our laundry shop! We hope to see you and serve you again.',
                style: TextStyle(fontSize: 14, color: Colors.grey[600]),
              ),
              const SizedBox(height: 16),
              const Divider(),
              // Order Details Section
              Text(
                'Order Details',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: navyBlue,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Order number',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  Text(
                    'ABMWE23213',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Order from', style: TextStyle(color: Colors.grey[600])),
                  Text(
                    'Erick De Belen',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Delivery address',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  Text(
                    '259 Naga City',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total (incl. VAT)',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: navyBlue,
                    ),
                  ),
                  Text(
                    '₱ 185',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: navyBlue,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(),
              // View Details Section
              GestureDetector(
                onTap: () {
                  setState(() {
                    isDetailsExpanded = !isDetailsExpanded; // Toggle the state
                  });
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'View Details (1 Items)',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: navyBlue,
                      ),
                    ),
                    Icon(
                      isDetailsExpanded
                          ? Icons
                              .expand_less // Upward arrow
                          : Icons.expand_more, // Downward arrow
                      color: navyBlue,
                    ),
                  ],
                ),
              ),
              if (isDetailsExpanded) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Subtotal', style: TextStyle(color: Colors.grey[600])),
                    Text(
                      '₱ 165',
                      style: TextStyle(color: navyBlue),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Delivery Fee',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                    Text(
                      '₱ 30.00',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Voucher', style: TextStyle(color: Colors.grey[600])),
                    Text(
                      '-₱ 10.00',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Colors.green,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Total',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: navyBlue,
                      ),
                    ),
                    Text(
                      '₱ 185.00',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: navyBlue,
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              const Divider(),
              // Payment Method Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Paid with:',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: navyBlue,
                    ),
                  ),
                  Text(
                    'Gcash\n+00**12***567',
                    textAlign: TextAlign.right,
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(),
              // Tip and Rate Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.star, color: Colors.yellow[700]),
                      const SizedBox(width: 8),
                      Text(
                        'Tip and Rate',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: navyBlue,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
