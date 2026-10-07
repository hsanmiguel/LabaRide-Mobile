import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../OrderScreen/OrderScreen.dart';
import '../ProfileShop/ShopProfile.dart';
import '../ShopDashboard/homescreen.dart';
import '../Services/ServiceScreen1.dart';
import 'ExpandNewOrder.dart';
import 'ExpandCancelledOrder.dart';
import 'ExpandOngoingOrder.dart';
import 'ExpandCompleteOrder.dart';
import '../../Sockets/socketService.dart';

class CustomerOrders extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const CustomerOrders({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  State<CustomerOrders> createState() => _CustomerOrdersState();
}

class _CustomerOrdersState extends State<CustomerOrders> {
  bool _isLoading = false;
  String _error = '';
  List<Map<String, dynamic>> _shopOrders = [];

  @override
  void initState() {
    super.initState();
    _initializeSocket();
    _fetchShopOrders();
  }

  void _initializeSocket() {
    SocketService.initializeSocket();
    
    final shopId = widget.shopData['id']?.toString() ?? '';
    if (shopId.isEmpty) {
      print('Error: Invalid shop ID');
      return;
    }
    
    SocketService.joinShopRoom(shopId);
    
    SocketService.listenToTransactionUpdates((data) {
      if (!mounted) return;
      
      if (data['shop_id']?.toString() != shopId) {
        return;
      }

      setState(() {
        _shopOrders.insert(0, data);
        _fetchShopOrders();
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('New order received! Order ID: ${data['transaction_id']}'),
          backgroundColor: const Color(0xFF1A0066),
          duration: const Duration(seconds: 3),
        ),
      );
    });
  }

  @override
  void dispose() {
    SocketService.dispose();
    super.dispose();
  }

  Future<void> _fetchShopOrders() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/user_transactions/${widget.shopData['id']}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _shopOrders = List<Map<String, dynamic>>.from(data['data'] ?? []);
          _isLoading = false;
        });
      } else {
        throw Exception('Failed to load orders');
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> _filterOrdersByStatus(String status) {
    return _shopOrders.where((order) => 
      order['status']?.toString().toLowerCase() == status.toLowerCase()
    ).toList();
  }

  // Helper method to format date
  String _formatDate(String? dateTime) {
    if (dateTime == null) return '';
    try {
      final date = DateTime.parse(dateTime);
      return '${date.month}/${date.day}/${date.year}';
    } catch (e) {
      return dateTime;
    }
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: Colors.white,
      ),
    );
  }

  // Card building methods remain the same as your original implementation
  Widget _buildNewOrdersCard() {
    final newOrders = _filterOrdersByStatus('pending');
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ExpandNewOrder(
              userId: widget.userId,
              token: widget.token,
              shopData: widget.shopData,
            ),
          ),
        );
      },
      child: SizedBox(
        height: 80,
        child: Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: newOrders.isEmpty
                ? const Text(
                    'No new orders yet.',
                    style: TextStyle(fontSize: 16, color: Colors.black87),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        newOrders.length.toString(),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.purple[600],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        'New Order${newOrders.length > 1 ? 's' : ''}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCancelledOrdersCard() {
    final cancelledOrders = _filterOrdersByStatus('cancelled');
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ExpandCancelledOrder(
              userId: widget.userId,
              token: widget.token,
              shopData: widget.shopData,
            ),
          ),
        );
      },
      child: SizedBox(
        height: 80,
        child: Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: cancelledOrders.isEmpty
                ? const Text(
                    'No cancelled orders yet.',
                    style: TextStyle(fontSize: 16, color: Colors.black87),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        cancelledOrders.length.toString(),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.red[600],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        'Cancelled Order${cancelledOrders.length > 1 ? 's' : ''}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOngoingOrderCard() {
    final ongoingOrders = _filterOrdersByStatus('processing');
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ExpandOngoingOrder(
              userId: widget.userId,
              token: widget.token,
              shopData: widget.shopData,
            ),
          ),
        );
      },
      child: SizedBox(
        height: ongoingOrders.isEmpty ? 80 : 110,
        child: Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: ongoingOrders.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'No ongoing orders yet.',
                    style: TextStyle(fontSize: 16, color: Colors.black87),
                  ),
                ),
              )
            : Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '#${ongoingOrders.first['id'] ?? ''}',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          _formatDate(ongoingOrders.first['created_at']),
                          style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.teal[100],
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            ongoingOrders.first['service_name']?.toString().toUpperCase() ?? 'SERVICE',
                            style: const TextStyle(
                              color: Colors.teal,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            '₱${ongoingOrders.first['total_amount']?.toString() ?? '0.00'}',
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
        ),
      ),
    );
  }

  Widget _buildCompletedOrdersCard() {
    final completedOrders = _filterOrdersByStatus('completed');
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ExpandCompleteOrder(
              userId: widget.userId,
              token: widget.token,
              shopData: widget.shopData,
            ),
          ),
        );
      },
      child: SizedBox(
        height: 80,
        child: Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: completedOrders.isEmpty
                ? const Text(
                    'No completed orders yet.',
                    style: TextStyle(fontSize: 16, color: Colors.black87),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        completedOrders.length.toString(),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.green[600],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        'Completed Order${completedOrders.length > 1 ? 's' : ''}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNavigationBar() {
    return BottomNavigationBar(
      currentIndex: 3,
      type: BottomNavigationBarType.fixed,
      selectedItemColor: const Color(0xFF1A0066),
      onTap: (index) {
        switch (index) {
          case 0:
            Navigator.push(
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
            Navigator.push(
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
            Navigator.push(
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
          case 4:
            Navigator.push(
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
            'assets/ProfileScreen/Home.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Home',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/ProfileScreen/Orders.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Orders',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/ProfileScreen/Services.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Services',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/ProfileScreen/Customers.png',
            height: 24,
            color: const Color(0xFF1A0066),
          ),
          label: 'Customers',
        ),
        BottomNavigationBarItem(
          icon: Image.asset(
            'assets/ProfileScreen/Profile.png',
            height: 24,
            color: Colors.grey,
          ),
          label: 'Profile',
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF48006A),
      body: SafeArea(
        child: _isLoading 
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : _error.isNotEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _error,
                      style: const TextStyle(color: Colors.white),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _fetchShopOrders,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: _fetchShopOrders,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Customer Orders',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _buildSectionTitle('New Orders'),
                        const SizedBox(height: 8),
                        _buildNewOrdersCard(),
                        const SizedBox(height: 24),
                        _buildSectionTitle('Cancelled Orders'),
                        const SizedBox(height: 8),
                        _buildCancelledOrdersCard(),
                        const SizedBox(height: 24),
                        _buildSectionTitle('Ongoing Orders'),
                        const SizedBox(height: 8),
                        _buildOngoingOrderCard(),
                        const SizedBox(height: 24),
                        _buildSectionTitle('Completed Orders'),
                        const SizedBox(height: 8),
                        _buildCompletedOrdersCard(),
                      ],
                    ),
                  ),
                ),
              ),
      ),
      bottomNavigationBar: _buildBottomNavigationBar(),
    );
  }
}