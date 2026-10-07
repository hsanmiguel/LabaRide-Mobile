import 'package:flutter/material.dart';
import '../../loginscreen.dart';

class AccountDelete extends StatefulWidget {
  const AccountDelete({super.key});

  @override
  State<AccountDelete> createState() => _AccountDeleteScreenState();
}

class _AccountDeleteScreenState extends State<AccountDelete> {
  @override
  void initState() {
    super.initState();
    // Delay for 2 seconds then navigate to admin login
    Future.delayed(const Duration(seconds: 2), () {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const UnifiedLoginScreen()),
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
            // Account Deleted Icon
            Image.asset(
              'assets/AccountInfo/Logo.png', 
              width: 120,
              height: 100, 
            ),
            const SizedBox(height: 24),
            // Account Deleted Text
            const Text(
              'Account Deleted',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A0066),
                fontFamily: 'Inter',
              ),
            ),
            const SizedBox(height: 8),
            // Subtitle Text
            const Text(
              'We hope to see you again',
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