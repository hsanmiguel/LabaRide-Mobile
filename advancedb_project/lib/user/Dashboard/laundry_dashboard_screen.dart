import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'search_screen.dart';
import 'activities_screen.dart';
import 'notifications_screen.dart';
import '../ProfileUser/UserProfile.dart';
import '../OrderingSystem/ordershopsystem.dart';
import 'viewmap.dart';
import '../Transaction/ConfirmedTranct.dart';
import '../../loginscreen.dart';
import 'allshops.dart';

class LaundryShop {
  final String id;
  final String name;
  final String image;
  final double rating;
  final String distance;
  final bool isOpen;
  final String location;
  final String status;
  final String totalPrice;
  final int? userId;         
  final bool isOwnedByCurrentUser; 
  final double? latitude;     
  final double? longitude;   
  final String street;     
  final String barangay; 
  final String building;  

  LaundryShop({
    required this.id,
    required this.name,
    required this.image,
    required this.rating,
    required this.distance,
    required this.isOpen,
    required this.location,
    required this.status,
    required this.totalPrice,
    this.userId,
    this.isOwnedByCurrentUser = false,
    this.latitude,
    this.longitude,
    this.street = '',
    this.barangay = '',
    this.building = '',
  });
}


class LaundryDashboardScreen extends StatefulWidget {
  final int userId;
  final String token;
  final bool isGuest;
  final String? initialMessage;
  final String? transactionId;

  const LaundryDashboardScreen({
    super.key,
    required this.userId,
    required this.token,
    this.isGuest = false,
    this.initialMessage,
    this.transactionId,
  });

  @override
  State<LaundryDashboardScreen> createState() => _LaundryDashboardScreenState();
}

class _LaundryDashboardScreenState extends State<LaundryDashboardScreen> {
  Map<String, dynamic> userData = {};
  bool _isLoading = true;
  String _errorMessage = '';
  List<LaundryShop> recentShops = [];
  List<LaundryShop> nearbyShops = [];
  List<LaundryShop> topShops = [];
  List<LaundryShop> allShops = [];
  String? transactionId;
  String? transactionMessage;

  @override
  void initState() {
    super.initState();
    if (widget.initialMessage != null) {
      transactionMessage = widget.initialMessage;
      transactionId = widget.transactionId;
    }
    _initializeData();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _fetchAllShops();
  }

Future<void> _fetchAllShops() async {
    try {
      setState(() => _isLoading = true);

      final response = await http.get(
        Uri.parse('http://localhost:5000/shops'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final shopsList = data is List ? data : data['shops'] as List;

        setState(() {
          allShops = shopsList.map((shop) {
            final shopUserId = shop['user_id'] is int
                ? shop['user_id']
                : int.tryParse(shop['user_id']?.toString() ?? '');
            return LaundryShop(
              id: shop['id']?.toString() ?? '',
              name: shop['shop_name'] ?? '',
              image: shop['image'] ?? 'assets/default_shop.png',
              rating: 0.0,
              distance: shop['distance']?.toString() ?? 'N/A',
              isOpen: shop['is_open'] ?? false,
              location: buildShopAddress(shop),
              status: shop['status'] ?? 'Unknown',
              totalPrice: shop['total_price']?.toString() ?? 'N/A',
              userId: shopUserId,
              isOwnedByCurrentUser: shopUserId == widget.userId,
              latitude: shop['latitude'] != null ? double.tryParse(shop['latitude'].toString()) : null,
              longitude: shop['longitude'] != null ? double.tryParse(shop['longitude'].toString()) : null,
              street: shop['street'] ?? '',
              barangay: shop['barangay'] ?? '',
              building: shop['building'] ?? '',
            );
          }).toList();
          _isLoading = false;
        });
      } else {
        throw Exception('Failed to load shops: ${response.statusCode}');
      }
    } catch (e) {
      print('Error fetching shops: $e');
      setState(() {
        _errorMessage = 'Error loading shops: $e';
        _isLoading = false;
      });
    }
  }

Future<void> _initializeData() async {
  try {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    await Future.wait([
      _fetchUserData(),
      _fetchShopData(),
    ]);

    setState(() {
      _isLoading = false;
    });
  } catch (e) {
    setState(() {
      _errorMessage = 'Error initializing data: $e';
      _isLoading = false;
    });
  }
}

  Future<void> _fetchUserData() async {
    if (widget.isGuest) {
      setState(() {
        userData = {
          'zone': 'Guest Mode',
          'street': '',
          'barangay': 'Browse as Guest',
        };
      });
      return;
    }

    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/user/${widget.userId}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['user'] != null) {
          setState(() {
            userData = data['user'];
          });
        } else {
          throw Exception('User data is empty');
        }
      } else if (response.statusCode == 401) {
        throw Exception('Unauthorized access. Please login again.');
      } else if (response.statusCode == 404) {
        throw Exception('User not found');
      } else {
        throw Exception('Failed to load user data');
      }
    } catch (e) {
      throw Exception('Error loading user data: $e');
    }
  }

Future<void> _fetchShopData() async {
  try {
    final response = await http.get(
      Uri.parse('http://localhost:5000/shops/recent'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      },
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      print('Fetched shop data: $data');

      setState(() {
        recentShops = data.map((shop) {
          final shopId = shop['id'];
          if (shopId == null) {
            print('Warning: Shop with name ${shop['shop_name']} has no ID');
            return null;
          }
          
          return LaundryShop(
            id: shopId.toString(),
            name: shop['shop_name'] ?? '',
            image: shop['image'] ?? 'assets/default_shop.png',
            rating: shop['rating']?.toDouble() ?? 0.0,
            distance: shop['distance'] ?? 'N/A',
            isOpen: shop['is_open'] ?? false,
            location: buildShopAddress(shop), // Using helper function
            status: shop['status'] ?? 'Unknown',
            totalPrice: shop['total_price'] ?? 'N/A',
            userId: widget.userId,
            isOwnedByCurrentUser: true,
            latitude: shop['latitude'] != null ? double.tryParse(shop['latitude'].toString()) : null,
            longitude: shop['longitude'] != null ? double.tryParse(shop['longitude'].toString()) : null,
            street: shop['street'] ?? '',
            barangay: shop['barangay'] ?? '',
            building: shop['building'] ?? '',
          );
        })
        .whereType<LaundryShop>() // Filter out null values
        .toList();
      });
    }
  } catch (e) {
    print('Error in _fetchShopData: $e');
    throw e;
  }
}

  
// In laundry_dashboard_screen.dart
void _navigateToShop(LaundryShop shop) {
  if (widget.isGuest) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const UnifiedLoginScreen(),
      ),
    );
    return;
  }

  // Since shop.id is non-nullable, just check for empty
  if (shop.id.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Invalid shop ID')),
    );
    return;
  }

  print('Navigating to shop: ${shop.id}');

  _fetchCompleteShopData(shop.id).then((fullShopData) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => OrderShopSystem(
          userId: widget.userId,
          token: widget.token,
          shopData: fullShopData,
          initialService: null,
          initialItems: null,
        ),
      ),
    ).then((result) {
      // Refresh shop data if changes were made
      if (result != null && result['refresh'] == true) {
        _fetchCompleteShopData(shop.id); // Reload shop data
      }
    });
  }).catchError((error) {
    print('Navigation error: $error');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error loading shop details: $error')),
    );
  });
}

Future<Map<String, dynamic>> _fetchCompleteShopData(String shopId) async {
  try {
    // Check shopId is not null/empty
    if (shopId.isEmpty) {
      throw Exception('Shop ID is empty');
    }

    print('Fetching shop data for ID: $shopId'); // Debug log

    // Fetch basic shop data
    final shopResponse = await http.get(
      Uri.parse('http://localhost:5000/shop/$shopId'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
    );

    print('Shop response status: ${shopResponse.statusCode}'); // Debug log
    print('Shop response body: ${shopResponse.body}'); // Debug log

    if (shopResponse.statusCode != 200) {
      throw Exception('Failed to load shop data: ${shopResponse.statusCode}');
    }

    final shopData = jsonDecode(shopResponse.body);

    // Fetch services for this shop
    final servicesResponse = await http.get(
      Uri.parse('http://localhost:5000/shop/$shopId/services'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
    );

    print('Services response status: ${servicesResponse.statusCode}'); // Debug log

    // Fetch clothing types
    final clothingResponse = await http.get(
      Uri.parse('http://localhost:5000/shop/$shopId/clothing'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
    );

    // Fetch household items
    final householdResponse = await http.get(
      Uri.parse('http://localhost:5000/shop/$shopId/household'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
    );

    // Combine all data and ensure required fields exist
    final completeShopData = {
      'id': shopId,
      'shop_name': shopData['shop_name'] ?? '',
      'image': shopData['image'] ?? 'assets/default_shop.png',
      'rating': shopData['rating'] ?? 0.0,
      'distance': shopData['distance'] ?? 'N/A',
      'is_open': shopData['is_open'] ?? false,
      'location': shopData['location'] ?? 'Unknown Location',
      'status': shopData['status'] ?? 'Unknown',
      'total_price': shopData['total_price'] ?? 'N/A',
      'contact_number': shopData['contact_number'] ?? '',
      'zone': shopData['zone'] ?? '',
      'street': shopData['street'] ?? '',
      'barangay': shopData['barangay'] ?? '',
      'building': shopData['building'] ?? '',
      'opening_time': shopData['opening_time'] ?? '',
      'closing_time': shopData['closing_time'] ?? '',
      'services': servicesResponse.statusCode == 200 
          ? (jsonDecode(servicesResponse.body)['services'] as List).map((service) => {
              'service_name': service['service_name'],
              'description': service['description'] ?? '',
              'price': service['price']?.toString() ?? '0',
              'color': service['color']?.toString() ?? '0xFF1A0066',
            }).toList()
          : [],
      'clothing_types': clothingResponse.statusCode == 200 
          ? jsonDecode(clothingResponse.body)['types'] ?? []
          : [],
      'household_items': householdResponse.statusCode == 200 
          ? jsonDecode(householdResponse.body)['items'] ?? []
          : [],
    };

    print('Complete shop data ready'); // Debug log
    return completeShopData;
  } catch (e) {
    print('Error fetching complete shop data: $e'); // More detailed error log
    throw e; // Re-throw to be caught by caller
  }
}

  void _navigateToMap() {
  if (widget.isGuest) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const UnifiedLoginScreen(),
      ),
    );
    return;
  }
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => MapScreen(
        userId: widget.userId,
        token: widget.token,
        shops: recentShops.map((shop) => { // Changed from allShops to recentShops
          'id': shop.id,
          'shop_name': shop.name,
          'latitude': shop.latitude,
          'longitude': shop.longitude,
          'street': shop.street,
          'barangay': shop.barangay,
          'building': shop.building,
        }).toList(),
      ),
    ),
  );
}

  Widget _buildTransactionMessage() {
    if (transactionMessage == null || widget.transactionId == null || widget.isGuest) {
      return const SizedBox.shrink();
    }
    
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => OrderDetailsScreen(
              userId: widget.userId,
              token: widget.token,
              transactionId: widget.transactionId!,
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.local_laundry_service, color: Color(0xFF1A0066)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                transactionMessage!,
                style: const TextStyle(
                  color: Color(0xFF1A0066),
                  fontSize: 14,
                ),
              ),
            ),
            const Icon(Icons.arrow_forward_ios, 
              color: Color(0xFF1A0066),
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                const Icon(Icons.location_on, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${userData['zone'] ?? ''}, ${userData['street'] ?? ''}, ${userData['barangay'] ?? ''}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontFamily: 'Inter',
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          if (!widget.isGuest)
            IconButton(
              icon: const Icon(Icons.notifications, color: Colors.white),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const NotificationsScreen(),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: TextField(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => SearchScreen(
                userId: widget.userId,
                token: widget.token,
                isGuest: widget.isGuest,
              ),
            ),
          );
        },
        readOnly: true,
        decoration: InputDecoration(
          hintText: 'Search for laundry shop',
          hintStyle: const TextStyle(color: Colors.grey),
          filled: true,
          fillColor: Colors.white,
          prefixIcon: const Icon(Icons.search, color: Colors.grey),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Text(
        title,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontFamily: 'Inter',
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildImageContainer(String imagePath, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: GestureDetector(
        onTap: _navigateToMap,
        child: Container(
          height: 150,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Stack(
              children: [
                Positioned.fill(
                  child: Image.asset(
                    imagePath,
                    fit: BoxFit.cover,
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Colors.black.withOpacity(0.6),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
                const Positioned(
                  bottom: 16,
                  left: 16,
                  child: Text(
                    'View Map',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

Widget _buildShopListView(List<LaundryShop> shops) {
  return SizedBox(
    height: 110, // Slightly reduced height since we removed hours
    child: ListView.builder(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.zero,
      itemCount: shops.length,
      itemBuilder: (context, index) {
        final shop = shops[index];
        return GestureDetector(
          onTap: () => _navigateToShop(shop),
          child: Container(
            width: 220,
            margin: EdgeInsets.only(
              left: index == 0 ? 16 : 8,
              right: index == shops.length - 1 ? 16 : 8,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    shop.name,
                    style: const TextStyle(
                      fontSize: 18, // Increased font size
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A0066),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8), // Increased spacing
                  Text(
                    shop.location,
                    style: TextStyle(
                      fontSize: 13, // Slightly increased for better readability
                      color: Colors.grey[600],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    ),
  );
}

    Widget _buildBottomNavigationBar(BuildContext context) {
    return Container(
      height: 80,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(24),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 8,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(Icons.home, 'Home', true),
          _buildNavItem(Icons.search, 'Search', false, () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => SearchScreen(
                  userId: widget.userId,
                  token: widget.token,
                  isGuest: widget.isGuest,
                ),
              ),
            );
          }),
          _buildNavItem(Icons.history, 'Activities', false, () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ActivitiesScreen(
                  userId: widget.userId,
                  token: widget.token,
                  isGuest: widget.isGuest,
                ),
              ),
            );
          }),
          _buildNavItem(Icons.person, 'Profile', false, () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProfileScreen(
                userId: widget.userId,
                token: widget.token,
                isGuest: widget.isGuest, 
              ),
            ),
          );
        }),
      ],
    ),
  );
}


  Widget _buildNavItem(IconData icon, String label, bool isActive, [VoidCallback? onTap]) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            color: isActive ? const Color(0xFF375DFB) : Colors.grey,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: isActive ? const Color(0xFF375DFB) : Colors.grey,
              fontFamily: 'Inter',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionWithViewAll(String title, List<LaundryShop> shops) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontFamily: 'Inter',
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (title != 'Nearby Laundry Shops') // Only show View All for non-nearby shops
                TextButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => AllShopsScreen(
                          userId: widget.userId,
                          token: widget.token,
                          isGuest: widget.isGuest,
                        ),
                      ),
                    );
                  },
                  child: const Text(
                    'View All',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontFamily: 'Inter',
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        _buildShopListView(shops),
      ],
    );
  }

  @override
Widget build(BuildContext context) {
  if (_isLoading) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF1A0066)),
        ),
      ),
    );
  }

    if (_errorMessage.isNotEmpty) {
  return Scaffold(
    appBar: AppBar(
      backgroundColor: const Color(0xFF1A0066),
      title: const Text(
        'All Laundry Shops',
        style: TextStyle(color: Colors.white),
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: Colors.white),
        onPressed: () => Navigator.pop(context),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.map, color: Colors.white),
          onPressed: _navigateToMap,
        ),
      ],
    ),
    body: Container(
      color: const Color.fromARGB(255, 30, 84, 171),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, 
                  size: 48, 
                  color: Colors.white,
                ),
                const SizedBox(height: 16),
                Text(
                  _errorMessage,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _initializeData,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF1A0066),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                  ),
                  child: const Text(
                    'Retry',
                    style: TextStyle(fontWeight: FontWeight.bold),
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

    return Scaffold(
      body: Container(
        color: const Color.fromARGB(255, 30, 84, 171),
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _initializeData,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: 
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildHeader(context),
                          if (!widget.isGuest) _buildTransactionMessage(),
                          const SizedBox(height: 16),
                          _buildSearchBar(context),
                          const SizedBox(height: 16),
                          _buildSectionTitle('Explore Laundry Shop'),
                          const SizedBox(height: 8),
                          _buildImageContainer('assets/maps.png', context),
                          const SizedBox(height: 16),
                          _buildSectionWithViewAll('Laundry Shops', recentShops), // Updated title
                          const SizedBox(height: 16),
                          _buildSectionWithViewAll('Nearby Laundry Shops', nearbyShops),
                          const SizedBox(height: 16),
                        ],
                      ),
                  ),
                ),
              ),
              _buildBottomNavigationBar(context),
            ],
          ),
        ),
      ),
    );
  }
}
String buildShopAddress(dynamic shop) {
  final street = shop['street'] ?? '';
  final barangay = shop['barangay'] ?? '';
  final building = shop['building'] ?? '';
  List<String> parts = [];
  if (street.isNotEmpty) parts.add(street);
  if (barangay.isNotEmpty) parts.add(barangay);
  if (building.isNotEmpty && building.toLowerCase() != 'none') parts.add(building);
  return parts.isNotEmpty ? parts.join(', ') : 'Unknown Location';
}