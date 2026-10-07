import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../OrderScreen/OrderScreen.dart';
import '../Services/ServiceScreen1.dart';
import '../ProfileShop/ShopProfile.dart';
import '../CustomerOrder/CustomerOrder.dart';
import 'notifpage.dart';
import 'shop_map.dart';

class DashboardScreen extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const DashboardScreen({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int todayOrderCount = 0;
  List<Map<String, dynamic>> recentTransactions = [];
  bool isLoading = true;
  MapController mapController = MapController();
  List<Marker> markers = [];
  Position? currentPosition;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
    _getCurrentLocation();
  }

  Future<void> _getCurrentLocation() async {
  try {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return;
      }
    }

    Position position = await Geolocator.getCurrentPosition();
    setState(() {
      currentPosition = position;
    });

    markers.add(
      Marker(
        point: LatLng(position.latitude, position.longitude),
        child: const Icon(
          Icons.location_on,
          color: Colors.blue,
          size: 40,
        ),
      ),
    );

    _fetchNearbyShops(position);
  } catch (e) {
    print('Error getting location: $e');
  }
}

Future<void> _fetchNearbyShops(Position position) async {
  try {
    final response = await http.get(
      Uri.parse('http://localhost:5000/nearby_shops?lat=${position.latitude}&lng=${position.longitude}'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final shops = List<Map<String, dynamic>>.from(data['shops']);
      
      setState(() {
        for (var shop in shops) {
          markers.add(
            Marker(
              point: LatLng(shop['latitude'], shop['longitude']),
              child: GestureDetector(
                onTap: () => _showShopDetails(shop),
                child: const Icon(
                  Icons.local_laundry_service,
                  color: Colors.purple,
                  size: 40,
                ),
              ),
            ),
          );
        }
      });
    }
  } catch (e) {
    print('Error fetching nearby shops: $e');
  }
}

void _showShopDetails(Map<String, dynamic> shop) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(shop['name']),
      content: Text(shop['address']),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

  Future<void> _loadDashboardData() async {
    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/shop_transactions/${widget.shopData['id']}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final transactions = List<Map<String, dynamic>>.from(data['transactions']);
        
        // Calculate today's orders
        final today = DateTime.now();
        final todayOrders = transactions.where((t) {
          final orderDate = DateTime.parse(t['created_at']);
          return orderDate.year == today.year && 
                orderDate.month == today.month && 
                orderDate.day == today.day;
        }).toList();

        setState(() {
          todayOrderCount = todayOrders.length;
          recentTransactions = transactions.take(3).toList();
          isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading dashboard data: $e');
      setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color.fromARGB(255, 91, 50, 215),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: const Color(0xFF1A0066),
        elevation: 0,
        title: const Text(
          'DASHBOARD',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: Image.asset('assets/adminIcon/bell.png'),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const NotificationsScreen(),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: WillPopScope(
      onWillPop: () async => false, // Prevent back navigation
      child: RefreshIndicator(
        onRefresh: _loadDashboardData,
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(), // Changed from AlwaysScrollableScrollPhysics
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Map Section
                ShopMap(
                  token: widget.token,
                  shopData: widget.shopData,
                ),
                const SizedBox(height: 16),
                // Total Orders Today Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'TOTAL ORDERS TODAY',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A0066),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Center(
                        child: Text(
                          '$todayOrderCount',
                          style: const TextStyle(
                            fontSize: 48,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1A0066),
                          ),
                        ),
                      ),
                      const Center(
                        child: Text(
                          'Orders',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Recent Transactions Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'RECENT TRANSACTIONS',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A0066),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        physics: const ClampingScrollPhysics(), // Added physics
                        child: DataTable(
                          columns: const [
                            DataColumn(label: Text('Customer Name')),
                            DataColumn(label: Text('Date')),
                            DataColumn(label: Text('Service')),
                            DataColumn(label: Text('Delivery Type')),
                            DataColumn(label: Text('Status')),
                            DataColumn(label: Text('Total')),
                          ],
                          rows: recentTransactions.map((transaction) {
                            final date = DateTime.parse(transaction['created_at']);
                            return _buildDataRow(
                              transaction['customer_name'] ?? 'N/A',
                              '${date.month}/${date.day}/${date.year}',
                              transaction['service_name'] ?? 'N/A',
                              transaction['delivery_type'] ?? 'N/A',
                              transaction['status'] ?? 'N/A',
                              '₱${transaction['total_amount']?.toStringAsFixed(2) ?? '0.00'}',
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: const Color(0xFF1A0066),
        unselectedItemColor: Colors.grey,
        currentIndex: 0,
        onTap: (index) {
          switch (index) {
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
          _buildNavItem('Home', 'assets/OrderScreenIcon/Home.png'),
          _buildNavItem('Orders', 'assets/OrderScreenIcon/Orders.png'),
          _buildNavItem('Services', 'assets/OrderScreenIcon/Services.png'),
          _buildNavItem('Customers', 'assets/OrderScreenIcon/Customers.png'),
          _buildNavItem('Profile', 'assets/OrderScreenIcon/Profile.png'),
        ],
      ),
    );
  }

  DataRow _buildDataRow(
    String name,
    String date,
    String service,
    String deliveryType,
    String status,
    String total,
  ) {
    return DataRow(
      cells: [
        DataCell(Text(name)),
        DataCell(Text(date)),
        DataCell(Text(service)),
        DataCell(Text(deliveryType)),
        DataCell(_buildStatusChip(status)),
        DataCell(Text(total)),
      ],
    );
  }

  Widget _buildStatusChip(String status) {
    Color backgroundColor;
    Color textColor;
    switch (status.toLowerCase()) {
      case 'pending':
        backgroundColor = Colors.orange.withOpacity(0.2);
        textColor = Colors.orange;
        break;
      case 'processing':
        backgroundColor = Colors.blue.withOpacity(0.2);
        textColor = Colors.blue;
        break;
      case 'completed':
        backgroundColor = Colors.green.withOpacity(0.2);
        textColor = Colors.green;
        break;
      case 'cancelled':
        backgroundColor = Colors.red.withOpacity(0.2);
        textColor = Colors.red;
        break;
      default:
        backgroundColor = Colors.grey.withOpacity(0.2);
        textColor = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(color: textColor, fontSize: 14),
      ),
    );
  }

  BottomNavigationBarItem _buildNavItem(String label, String iconPath) {
    return BottomNavigationBarItem(
      icon: Image.asset(iconPath, height: 24, color: Colors.grey),
      activeIcon: Image.asset(
        iconPath,
        height: 24,
        color: const Color(0xFF1A0066),
      ),
      label: label,
    );
  }
}