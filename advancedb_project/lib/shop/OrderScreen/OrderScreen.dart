import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'IndividualTransact.dart';
import '../Services/ServiceScreen1.dart';
import '../CustomerOrder/CustomerOrder.dart';
import '../ProfileShop/ShopProfile.dart';
import '../ShopDashboard/homescreen.dart';

class TransactionsScreen extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const TransactionsScreen({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  final Color navyBlue = const Color(0xFF1A0066);
  bool isItemSelected = false;
  final Map<int, bool> selectedItems = {};
  String selectedFilter = 'All';
  List<Map<String, dynamic>> transactionsData = [];
  bool isLoading = true;
  String? error;
  bool isDeleting = false;

  @override
  void initState() {
    super.initState();
    fetchTransactions();
  }

Future<void> fetchTransactions() async {
  setState(() {
    isLoading = true;
    error = null;
  });

  try {
    // Changed null check to properly verify shop ID
    if (widget.shopData.isEmpty || widget.shopData['id'] == null) {
      throw Exception('No shop data available');
    }

    print('Fetching transactions for shop ID: ${widget.shopData['id']}');
    final response = await http.get(
      Uri.parse('http://localhost:5000/shop_transactions/${widget.shopData['id']}'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      },
    );

    print('Response status: ${response.statusCode}');
    print('Response body: ${response.body}');

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      
      if (data is Map<String, dynamic> && data.containsKey('transactions')) {
        final transactions = List<Map<String, dynamic>>.from(data['transactions']).map((transaction) {
          return {
            'id': transaction['id'],
            'transaction_id': transaction['id'],
            'user_name': transaction['customer_name'] ?? transaction['user_name'] ?? 'N/A',
            'service_name': transaction['service_name']?.toString() ?? 'N/A',
            'delivery_type': transaction['delivery_type']?.toString() ?? 'N/A',
            'status': transaction['status']?.toString() ?? 'N/A',
            'payment_method': transaction['payment_method']?.toString() ?? 'N/A',
            'total_amount': transaction['total_amount']?.toString() ?? '0',
            'created_at': transaction['created_at']?.toString() ?? 'N/A',
          };
        }).toList();

        setState(() {
          transactionsData = transactions;
          isLoading = false;
        });
      } else {
        setState(() {
          transactionsData = [];
          isLoading = false;
        });
      }
    } else {
      throw Exception('Failed to load transactions: ${response.statusCode}');
    }
  } catch (e) {
    print('Error in fetchTransactions: $e');
    setState(() {
      error = e.toString();
      isLoading = false;
    });
    if (mounted) {
      _showErrorSnackBar('Error fetching transactions: $e');
    }
  }
}

  void _showErrorSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _deleteSelectedTransactions() async {
    if (isDeleting) return;

    setState(() => isDeleting = true);

    try {
      final selectedTransactionIds = selectedItems.entries
          .where((entry) => entry.value)
          .map((entry) => entry.key)
          .toList();

      for (final id in selectedTransactionIds) {
        final response = await http.delete(
          Uri.parse('http://localhost:5000/transactions/$id'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${widget.token}',
          },
        );

        if (response.statusCode != 200) {
          throw Exception('Failed to delete transaction $id');
        }
      }

      setState(() {
        transactionsData.removeWhere(
          (transaction) => selectedTransactionIds.contains(transaction['transaction_id'])
        );
        selectedItems.clear();
        isItemSelected = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Transactions deleted successfully')),
        );
      }
    } catch (e) {
      _showErrorSnackBar('Error deleting transactions: $e');
    } finally {
      if (mounted) {
        setState(() => isDeleting = false);
      }
    }
  }

  List<Map<String, dynamic>> getFilteredTransactions() {
    if (selectedFilter == 'All') {
      return transactionsData;
    }
    return transactionsData.where((transaction) {
      return transaction['status']?.toString().toLowerCase() == 
             selectedFilter.toLowerCase();
    }).toList();
  }

  Future<void> _viewSelectedTransaction() async {
    final selectedTransactionId = selectedItems.entries
        .firstWhere(
          (entry) => entry.value,
          orElse: () => const MapEntry(0, false),
        )
        .key;

    if (selectedTransactionId == 0) {
      _showErrorSnackBar('Please select a transaction to view.');
      return;
    }

    try {
      final transactionData = transactionsData.firstWhere(
        (transaction) => transaction['transaction_id'] == selectedTransactionId,
        orElse: () => {},
      );

      if (transactionData.isEmpty) {
        _showErrorSnackBar('Transaction not found.');
        return;
      }

      final stringifiedTransactionData = transactionData.map(
        (key, value) => MapEntry(key, value?.toString() ?? ''),
      );

      if (!mounted) return;

      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => IndividualTransact(
            transactionData: stringifiedTransactionData,
          ),
        ),
      );
    } catch (e) {
      _showErrorSnackBar('Error viewing transaction: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: navyBlue,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          Expanded(
            child: isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.white))
                : error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Error: $error',
                              style: const TextStyle(color: Colors.white),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: fetchTransactions,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      )
                    : _buildDataTableSection(),
          ),
        ],
      ),
      bottomNavigationBar:
          isItemSelected ? _buildSelectionActionBar() : _buildDefaultNavigationBar(),
    );
  }


  Widget _buildDataTableSection() {
    final filteredData = getFilteredTransactions();
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SingleChildScrollView(
          child: DataTable(
            columnSpacing: 20,
            columns: const [
              DataColumn(label: Text('Customer ID')),
              DataColumn(label: Text('Recipient Name')),
              DataColumn(label: Text('Date')),
              DataColumn(label: Text('Service')),
              DataColumn(label: Text('Delivery Type')),
              DataColumn(label: Text('Status')),
              DataColumn(label: Text('Payment Type')),
              DataColumn(label: Text('Total Amount')),
            ],
            rows:
                filteredData.map((data) {
                  final transactionId = data['transaction_id'];
                  return DataRow(
                    selected: selectedItems[transactionId] ?? false,
                    onSelectChanged: (selected) {
                      setState(() {
                        selectedItems[transactionId] = selected ?? false;
                        isItemSelected = selectedItems.containsValue(true);
                      });
                    },
                    cells: [
                      DataCell(Text(data['transaction_id'].toString())),
                      DataCell(Text(data['user_name'] ?? 'N/A')),
                      DataCell(Text(data['created_at'] ?? 'N/A')),
                      DataCell(Text(data['service_name'] ?? 'N/A')),
                      DataCell(Text(data['delivery_type'] ?? 'N/A')),
                      DataCell(Text(data['status'] ?? 'N/A')),
                      DataCell(Text(data['payment_method'] ?? 'N/A')),
                      DataCell(Text('₱${data['total_amount'] ?? '0'}')),
                    ],
                  );
                }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 48, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TRANSACTIONS',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('All', 'assets/OrderScreenIcon/All.png'),
                const SizedBox(width: 8),
                _buildFilterChip(
                  'Cancelled',
                  'assets/OrderScreenIcon/Cancelled.png',
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  'In Progress', 
                  'assets/OrderScreenIcon/Active.png',
                ),
                const SizedBox(width: 8),
                _buildFilterChip(
                  'Completed',
                  'assets/OrderScreenIcon/Completed.png',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String iconPath) {
    final bool isSelected = selectedFilter == label;
    return FilterChip(
      selected: isSelected,
      label: Row(
        children: [
          Image.asset(
            iconPath,
            height: 16,
            color: isSelected ? Colors.white : navyBlue,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(color: isSelected ? Colors.white : navyBlue),
          ),
        ],
      ),
      backgroundColor: Colors.white,
      selectedColor: navyBlue,
      onSelected: (bool selected) {
        setState(() {
          selectedFilter = selected ? label : 'All';
        });
      },
    );
  }

  Widget _buildSelectionActionBar() {
    final selectedCount = selectedItems.values.where((isSelected) => isSelected).length;

    return Container(
      height: 80,
      decoration: const BoxDecoration(color: Colors.white),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          TextButton(
            onPressed: () {
              setState(() {
                selectedItems.clear();
                isItemSelected = false;
              });
            },
            style: TextButton.styleFrom(backgroundColor: Colors.transparent),
            child: const Text(
              'Back',
              style: TextStyle(color: Color(0xFF1A0066), fontSize: 18),
            ),
          ),
          if (selectedCount == 1)
            TextButton(
              onPressed: _viewSelectedTransaction,
              style: TextButton.styleFrom(backgroundColor: Colors.transparent),
              child: const Text(
                'View Transaction',
                style: TextStyle(color: Color(0xFF1A0066), fontSize: 18),
              ),
            ),
          TextButton(
            onPressed: isDeleting ? null : _deleteSelectedTransactions,
            style: TextButton.styleFrom(backgroundColor: Colors.transparent),
            child: isDeleting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.red),
                    ),
                  )
                : const Text(
                    'Delete',
                    style: TextStyle(color: Colors.red, fontSize: 16),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefaultNavigationBar() {
  return BottomNavigationBar(
    currentIndex: 1, 
    type: BottomNavigationBarType.fixed,
    selectedItemColor: navyBlue,
    unselectedItemColor: Colors.grey,
     onTap: (index) {
      switch (index) {
        case 0:
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => DashboardScreen(
                userId: widget.userId,
                token: widget.token,
                shopData: widget.shopData,
              ),
            ),
          );
          break;
        case 1:
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => TransactionsScreen(
                userId: widget.userId,
                token: widget.token,
                shopData: widget.shopData,
              ),
            ),
          );
          break;
        case 2:
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => ServiceScreen1(
                userId: widget.userId,
                token: widget.token,
                shopData: widget.shopData,
              ),
            ),
          );
          break;
          case 3:
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => CustomerOrders(
                userId: widget.userId,
                token: widget.token,
                shopData: widget.shopData,
              ),
            ),
          );
          break;
          case 4:
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => ProfileScreenAdmin(
                  userId: widget.userId,
                  token: widget.token,
                  shopData: widget.shopData,
                  onSwitchToUser: () => Navigator.pop(context),
                ),
              ),
            );
            break;
        }
      },
      items: [
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/OrderScreenIcon/Home.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Home',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/OrderScreenIcon/Orders.png',
            height: 24,
            color: navyBlue,
          ),
          label: 'Orders',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/OrderScreenIcon/Services.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Services',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/OrderScreenIcon/Customers.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Customers',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/OrderScreenIcon/Profile.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Profile',
        ),
      ],
    );
  }
}