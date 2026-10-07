import 'package:flutter/material.dart';
import '../../loginscreen.dart';

class SignUpCompleteScreen extends StatefulWidget {
  const SignUpCompleteScreen({super.key});

  @override
  State<SignUpCompleteScreen> createState() => _SignUpCompleteScreenState();
}

class _SignUpCompleteScreenState extends State<SignUpCompleteScreen> {
  @override
  void initState() {
    super.initState();
    // Navigate to login screen after 2 seconds
    Future.delayed(const Duration(seconds: 2), () {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => const UnifiedLoginScreen(),
        ),
        (route) => false, // Remove all previous routes
      );
    });
  }
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              color: Color(0xFF375DFB),
            ),
            SizedBox(height: 24),
            Text(
              'Registration Complete!',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A0066),
                fontFamily: 'Inter',
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Redirecting to login...',
              style: TextStyle(
                fontSize: 16,
                color: Color(0xFF666666),
                fontFamily: 'Inter',
              ),
            ),
          ],
        ),
      ),
    );
  }
}