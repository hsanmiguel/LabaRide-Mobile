import 'package:flutter/material.dart';
import 'DeclineOrder4.dart';

class DeclineOrderDialog extends StatelessWidget {
  final Function(String) onReasonSelected;
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;
  final Map<String, dynamic> orderDetails;

  const DeclineOrderDialog({
    super.key, 
    required this.onReasonSelected,
    required this.userId,
    required this.token,
    required this.shopData,
    required this.orderDetails,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Select a reason\nfor declining.',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A0066),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '#${orderDetails['id'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 16,
                        color: Color(0xFF9747FF),
                      ),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      color: Color(0xFF9747FF),
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _buildReasonButton(
              context: context,
              icon: 'assets/DeclineOrderIcon/Shop.png',
              text: 'Shop closed',
              onTap: () {
                onReasonSelected('Shop closed');
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => DeclineOrder4(
                      reason: 'Shop closed',
                      userId: userId,
                      token: token,
                      shopData: shopData,
                      orderDetails: orderDetails,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            _buildReasonButton(
              context: context,
              icon: 'assets/DeclineOrderIcon/Time.png',
              text: 'Too busy',
              onTap: () {
                onReasonSelected('Too busy');
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => DeclineOrder4(
                      reason: 'Too busy',
                      userId: userId,
                      token: token,
                      shopData: shopData,
                      orderDetails: orderDetails,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            _buildReasonButton(
              context: context,
              icon: 'assets/DeclineOrderIcon/NotAvailable.png',
              text: 'Service currently\nunavailable',
              onTap: () {
                onReasonSelected('Service currently unavailable');
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => DeclineOrder4(
                      reason: 'Service currently unavailable',
                      userId: userId,
                      token: token,
                      shopData: shopData,
                      orderDetails: orderDetails,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            _buildReasonButton(
              context: context,
              icon: 'assets/DeclineOrderIcon/Other.png',
              text: 'Other',
              onTap: () {
                onReasonSelected('Other');
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => DeclineOrder4(
                      reason: 'Other',
                      userId: userId,
                      token: token,
                      shopData: shopData,
                      orderDetails: orderDetails,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReasonButton({
    required BuildContext context,
    required String icon,
    required String text,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFE6E6E6)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Image.asset(
              icon,
              width: 24,
              height: 24,
              color: const Color(0xFF1A0066),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(fontSize: 16, color: Color(0xFF1A0066)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}