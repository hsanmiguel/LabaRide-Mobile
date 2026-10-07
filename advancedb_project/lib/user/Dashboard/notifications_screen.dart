import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.black),
                    onPressed: () {
                      Navigator.pop(context);
                    },
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Notifications',
                    style: TextStyle(
                      color: Color(0xFF4D3E8C),
                      fontSize: 20,
                      fontFamily: 'Poppins',
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Notifications List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                children: [
                  _buildNotificationItem(
                    name: 'Ashla Mondragon',
                    message: 'Exactly 3pm.',
                    time: '1m ago',
                    notificationCount: '2',
                  ),
                  _buildNotificationItem(
                    name: 'Nathaniel Bogart',
                    message: 'Ser subago p po ako nsa lowas',
                    time: '1d ago',
                    notificationCount: '10+',
                  ),
                  _buildNotificationItem(
                    name: 'Carl Bieber',
                    message: 'Kuya nasain ka na?',
                    time: 'Delivered',
                    notificationCount: '2',
                  ),
                  _buildNotificationItem(
                    name: 'Erick Marilag',
                    message: 'yaon tabi ako digdi sa atubangan ning bakery',
                    time: '1m ago',
                    notificationCount: '3',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationItem({
    required String name,
    required String message,
    required String time,
    required String notificationCount,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Row(
        children: [
          // Profile Icon
          Container(
            height: 40,
            width: 40,
            decoration: const BoxDecoration(
              color: Color(0xFF1E54AB), // Blue background
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.person, color: Colors.white),
          ),
          const SizedBox(width: 16),
          // Notification Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    color: Color(0xFF4D3E8C),
                    fontSize: 14,
                    fontFamily: 'Poppins',
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  message,
                  style: const TextStyle(
                    color: Colors.black,
                    fontSize: 12,
                    fontFamily: 'Poppins',
                  ),
                ),
                Text(
                  time,
                  style: const TextStyle(
                    color: Colors.grey,
                    fontSize: 12,
                    fontFamily: 'Poppins',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Notification Count
          Container(
            height: 20,
            width: 20,
            decoration: const BoxDecoration(
              color: Colors.red, // Red background
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                notificationCount,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontFamily: 'Poppins',
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}