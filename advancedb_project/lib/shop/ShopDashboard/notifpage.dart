import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Image.asset(
            'assets/circlebackarrow.png', 
            height: 34,
            width: 34,
          ),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
        title: Text(
          'Notifications',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Color.fromARGB(255, 36, 26, 71), // Dark purple color
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.more_vert, color: Color.fromARGB(255, 36, 26, 71)),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Today Section
            Text(
              'Today',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color.fromARGB(255, 36, 26, 71),
              ),
            ),
            SizedBox(height: 8.0),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png', // Replace with your purple circle asset
              title: 'Order #12345678 for John Doe (2kg Wash & Fold) has been completed.',
              subtitle: '',
            ),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Weekend Special drove 23% more orders (₦182K revenue).',
              subtitle: '',
            ),
            SizedBox(height: 16.0),

            // Earlier Section
            Text(
              'Earlier',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color.fromARGB(255, 36, 26, 71),
              ),
            ),
            SizedBox(height: 8.0),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Invoice unpaid for 48 hours.',
              subtitle: '',
            ),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Order #12345678 for Erick Marilog (5kg Wash & Fold) has been completed.',
              subtitle: '',
            ),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Customer #78901 (120/month) complaint: Stained silk blouse.',
              subtitle: '',
            ),
            SizedBox(height: 16.0),

            // April 4, 2025 Section
            Text(
              'April 4, 2025',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color.fromARGB(255, 36, 26, 71),
              ),
            ),
            SizedBox(height: 8.0),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Platinum member #8881 reported missing items (Order #LR-6123). Urgent resolution needed.',
              subtitle: '',
            ),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Good news! Yo!Detergent stock (Lavender) below safety level: 3 units remaining.',
              subtitle: '',
            ),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Order #LR-5683: Card payment failed 3x. Customer attempting cash. Flag for review?',
              subtitle: '',
            ),
            NotificationItem(
              icon: 'assets/adminIcon/ellipseblue.png',
              title: 'Platinum member [User#8801] placed 3rd order this week. Auto-apply 15% discount?',
              subtitle: '',
            ),
          ],
        ),
      ),
    );
  }
}

class NotificationItem extends StatelessWidget {
  final String icon;
  final String title;
  final String subtitle;

  const NotificationItem({super.key, required this.icon, required this.title, this.subtitle = ''});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Image.asset(
            icon,
            height: 40,
            width: 40,
          ),
          SizedBox(width: 12.0),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    color: Color.fromARGB(255, 36, 26, 71),
                  ),
                ),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
              ],
            ),
          ),
          Icon(Icons.more_vert, color: Color.fromARGB(255, 36, 26, 71)),
        ],
      ),
    );
  }
}