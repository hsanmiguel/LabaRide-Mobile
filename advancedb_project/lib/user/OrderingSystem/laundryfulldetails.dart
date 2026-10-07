import 'package:flutter/material.dart';

class LaundryFullDetails extends StatelessWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const LaundryFullDetails({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A0066),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          shopData['shop_name'] ?? "Full Details",
          style: const TextStyle(color: Colors.white),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              shopData['shop_name'] ?? "Shop Name",
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              "Shop ID: ${shopData['id'] ?? 'N/A'}",
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Text(
                  shopData['rating']?.toString() ?? "0.0",
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A0066),
                  ),
                ),
                const SizedBox(width: 8),
                Row(
                  children: List.generate(
                    5,
                    (index) => Icon(
                      Icons.star,
                      size: 20,
                      color: index < (shopData['rating'] ?? 0) 
                          ? Colors.amber 
                          : Colors.amber[200],
                    ),
                  ),
                ),
              ],
            ),
            Text(
              "${shopData['total_ratings'] ?? '0'} ratings",
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 32),
            const Text(
              "About",
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              "Pricing",
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              shopData['pricing_info'] ?? 
              "Prices may vary based on the transaction of the user. Prices are also changed by the admin.",
              style: TextStyle(
                color: Colors.grey[600],
                height: 1.5,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              "Business Hours",
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Monday to Sunday:",
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: Colors.grey[800],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  "${shopData['opening_time'] ?? '8:00am'} - ${shopData['closing_time'] ?? '5:00pm'}",
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              "Address",
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "${shopData['zone'] ?? ''} ${shopData['street'] ?? ''}, ${shopData['barangay'] ?? ''}, ${shopData['building'] ?? ''}",
              style: TextStyle(
                color: Colors.grey[600],
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}