import 'package:flutter/material.dart';
import '../CustomerOrder.dart'; 

class OrderDeclined extends StatelessWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const OrderDeclined({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => CustomerOrders(
              userId: userId,
              token: token,
              shopData: shopData,
            ),
          ),
        );
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon/Image
              Image.asset(
                'assets/DeclineOrderIcon/purplelogo.png', // Replace with your image path
                width: 150,
                height: 150,
              ),
              const SizedBox(height: 16),
              // Text
              const Text(
                'Order Cancelled',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1A0066), // Purple color
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}