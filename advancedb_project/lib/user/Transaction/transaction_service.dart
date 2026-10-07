import 'dart:convert';
import 'package:http/http.dart' as http;

class TransactionService {
  static Future<Map<String, dynamic>> createTransaction({
    required int userId,
    required Map<String, dynamic> data,
    required String token,
  }) async {
    try {
      // Add validation checks
      if (data['kilo_amount'] <= 0) {
        throw Exception('Invalid kilo amount');
      }

      final response = await http.post(
        Uri.parse('http://localhost:5000/create_transaction/$userId'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(data),
      );

      if (response.statusCode == 201) {
        final responseData = jsonDecode(response.body);
        print('Transaction created successfully: $responseData'); // Debug log
        return responseData;
      } else {
        final error = jsonDecode(response.body)['message'] ?? 'Failed to create transaction';
        print('Transaction creation failed: $error'); // Debug log
        throw Exception(error);
      }
    } catch (e) {
      print('Error in createTransaction: $e'); // Debug log
      throw Exception('Failed to create transaction: $e');
    }
  }
}