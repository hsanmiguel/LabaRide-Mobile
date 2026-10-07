import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'OrderDeclined.dart';

class DeclineOrder4 extends StatefulWidget {
  final String reason;
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;
  final Map<String, dynamic> orderDetails; // Add orderDetails

  const DeclineOrder4({
    super.key,
    required this.reason,
    required this.userId,
    required this.token,
    required this.shopData,
    required this.orderDetails, // Add this parameter
  });

  @override
  _DeclineOrder4State createState() => _DeclineOrder4State();
}

class _DeclineOrder4State extends State<DeclineOrder4> {
  final Map<String, bool> services = {
    'Wash Only': false,
    'Dry Clean': false,
    'Steam Press': false,
    'Full Service': false,
  };
  
  bool _isSubmitting = false;
  String _error = '';

  Future<void> _declineOrder() async {
    setState(() {
      _isSubmitting = true;
      _error = '';
    });

    try {
      // Get selected services
      final selectedServices = services.entries
          .where((entry) => entry.value)
          .map((entry) => entry.key)
          .toList();

      // Make API call to decline order
      final response = await http.put(
        Uri.parse('http://localhost:5000/update_transaction_status/${widget.orderDetails['id']}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'status': 'cancelled',
          'cancel_reason': widget.reason,
          'unavailable_services': selectedServices,
        }),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => OrderDeclined(
                userId: widget.userId,
                token: widget.token,
                shopData: widget.shopData,
              ),
            ),
          );
        }
      } else {
        throw Exception('Failed to decline order');
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $_error')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Color _getServiceColor(String service) {
    switch (service) {
      case 'Wash Only':
        return const Color(0xFF6FCF97);
      case 'Dry Clean':
        return const Color(0xFF9747FF);
      case 'Steam Press':
        return const Color(0xFF56CCF2);
      case 'Full Service':
        return const Color(0xFF1A0066);
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
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
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Which services are unavailable?',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'These services will be set to unavailable for the rest of the day.',
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF6B7280),
              ),
            ),
            if (_error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  _error,
                  style: const TextStyle(
                    color: Colors.red,
                    fontSize: 14,
                  ),
                ),
              ),
            const SizedBox(height: 24),
            Expanded(
              child: ListView(
                children: services.keys.map((service) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: Row(
                      children: [
                        Checkbox(
                          value: services[service],
                          onChanged: (bool? value) {
                            setState(() {
                              services[service] = value ?? false;
                            });
                          },
                        ),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 16,
                              horizontal: 16,
                            ),
                            decoration: BoxDecoration(
                              color: _getServiceColor(service),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              service.toUpperCase(),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: ElevatedButton(
                onPressed: services.containsValue(true) && !_isSubmitting
                    ? _declineOrder
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: services.containsValue(true)
                      ? const Color(0xFF1A0066)
                      : const Color(0xFFE5E7EB),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        'Continue',
                        style: TextStyle(
                          color: services.containsValue(true)
                              ? Colors.white
                              : const Color(0xFF9CA3AF),
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}