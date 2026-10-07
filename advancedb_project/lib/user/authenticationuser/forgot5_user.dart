import 'package:flutter/material.dart';
import '../../loginscreen.dart';

class PasswordChangedComplete extends StatefulWidget {
  const PasswordChangedComplete({super.key});

  @override
  State<PasswordChangedComplete> createState() => _PasswordChangedCompleteState();
}

class _PasswordChangedCompleteState extends State<PasswordChangedComplete> {
  @override
  void initState() {
    super.initState();
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
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: 180,
              height: 200,
              decoration: const BoxDecoration(
                image: DecorationImage(
                  image: AssetImage('assets/blacklogo.png'),
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const Positioned(
              bottom: 10,
              child: Text(
                'Password Changed',
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1A0066),
                  fontFamily: 'Inter',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}