import 'package:flutter/material.dart';
import '../OrderingSystem/ordershopsystem.dart';

class ShopDetailsOverlay extends StatelessWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopDetails;

  const ShopDetailsOverlay({
    super.key,
    required this.userId,
    required this.token,
    required this.shopDetails,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.6,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(16),
          topRight: Radius.circular(16),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    image: const DecorationImage(
                      image: AssetImage('assets/lavanderaakoprfile.png'),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        shopDetails['name'] ?? 'Lavandera ko',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A0066),
                        ),
                      ),
                      Text(
                        'Shop ID: ${shopDetails['shopId'] ?? '#123456ABCD'}',
                        style: const TextStyle(
                          fontSize: 16,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      Row(
                        children: [
                          const Icon(Icons.star, size: 16, color: Colors.amber),
                          const SizedBox(width: 4),
                          Text(
                            '${shopDetails['rating'] ?? '4.8'}',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '(${shopDetails['reviewCount'] ?? '1.2k'} reviews)',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'Business Hours',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 8),
            _buildBusinessHours(
              'Monday to Sunday',
              '${shopDetails['opening_time'] ?? '8:00 AM'} - ${shopDetails['closing_time'] ?? '5:00 PM'}',
            ),

            const SizedBox(height: 24),
            // Added Contact Information section
            const Text(
              'Contact Information',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.phone, size: 20, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Text(
                  shopDetails['contact_number'] ?? 'N/A',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'Address',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.location_on, size: 20, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    shopDetails['address'] ?? 
                    'J5GP+QR4, Elias Angeles St., Corner Paz St., Barangay Sta. Cruz, Naga City',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'Services',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _buildServiceTags(
                shopDetails['services'] ?? [
                  'Wash Only',
                  'Dry Clean',
                  'Steam Press',
                  'Full Service',
                ],
              ),
            ),
            const Spacer(),
              Center(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => OrderShopSystem(
                          userId: userId,
                          token: token,
                          shopData: shopDetails,
                        ),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1A0066),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Open Shop',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
  

  Widget _buildBusinessHours(String day, String hours) {
    return RichText(
      text: TextSpan(
        children: [
          TextSpan(
            text: '$day: ',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A0066),
            ),
          ),
          TextSpan(
            text: hours,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.normal,
              color: Color(0xFF6B7280),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildServiceTags(List<dynamic> services) {
    return services.map((service) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF1A0066).withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        service.toString(),
        style: const TextStyle(
          color: Color(0xFF1A0066),
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    )).toList();
  }
}