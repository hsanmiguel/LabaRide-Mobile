import 'package:flutter/material.dart';
import '../Dashboard/laundry_dashboard_screen.dart';

class OrderCancelledScreen extends StatefulWidget {
  final int userId;
  final String token;

  const OrderCancelledScreen({
    super.key,
    required this.userId,
    required this.token,
  });

  @override
  State<OrderCancelledScreen> createState() => _OrderCancelledScreenState();
}

class _OrderCancelledScreenState extends State<OrderCancelledScreen> {
  @override
  void initState() {
    super.initState();
    // Navigate after 2 seconds
    Future.delayed(const Duration(seconds: 2), () {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (context) => LaundryDashboardScreen(
            userId: widget.userId,
            token: widget.token,
          ),
        ),
        (route) => false,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 180,
              height: 200,
              decoration: const BoxDecoration(
                image: DecorationImage(
                  image: AssetImage('assets/logosplash.jpg'),
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Order Cancelled',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
                fontFamily: 'Inter',
              ),
            ),
            const SizedBox(height: 24),
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF1A0066)),
            ),
          ],
        ),
      ),
    );
  }
}