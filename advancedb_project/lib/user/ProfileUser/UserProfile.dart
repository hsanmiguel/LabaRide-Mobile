import 'package:flutter/material.dart';
import 'EditProfile.dart';
import 'package:intl/intl.dart';
import '../Location/Addresses.dart';
import '../../loginscreen.dart';
import '../History/ActiveTransact.dart';
import '../Dashboard/laundry_dashboard_screen.dart';
import '../Dashboard/search_screen.dart';
import '../Dashboard/activities_screen.dart';
import '../../shop/ProfileShop/ShopProfile.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../shop/AuthenticationShop/RegisterShop.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cancellable_tile_provider/flutter_map_cancellable_tile_provider.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';


class ProfileScreen extends StatefulWidget {
  final int userId;
  final String token;
  final bool isGuest;
  final Color navyBlue = const Color(0xFF000080);

  const ProfileScreen({
    super.key,
    required this.userId,
    required this.token,
    this.isGuest = false,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final Color navyBlue = const Color(0xFF000080);
  bool _isLoading = true;
  bool _hasShop = false;
  Map<String, dynamic> userData = {};
  LatLng? selectedLatLng;
  MapController mapController = MapController();
  String? selectedAddress;
  bool isSelectingLocation = false;
  
@override
void initState() {
  super.initState();
  selectedLatLng = const LatLng(13.6217, 123.1948);
  _setDefaultAddress(); // Add this
  _loadUserData();
}

  void _setDefaultAddress() {
    final defaultAddress = {
      'zone': userData['zone'] ?? '1',
      'street': userData['street'] ?? 'Magsaysay Avenue',
      'barangay': userData['barangay'] ?? 'Peñafrancia',
      'building': userData['building'] ?? '',
    };
    
    setState(() {
      selectedAddress = _formatAddress(defaultAddress);
    });
  }
  String _formatAddress(Map<String, dynamic> address) {
    List<String> parts = [];
    
    String zone = (address['zone']?.toString() ?? '1').trim();
    parts.add('Zone $zone');
    
    String street = (address['street']?.toString() ?? '').trim();
    if (street.isNotEmpty) parts.add(street);
    
    String barangay = (address['barangay']?.toString() ?? '').trim();
    if (barangay.isNotEmpty) parts.add(barangay);
    
    String? building = address['building']?.toString();
    if (building != null && building.trim().isNotEmpty) {
      parts.add(building.trim());
    }
    
    return parts.join(', ');
  }

  Future<void> _getAddressFromCoordinates(LatLng coordinates) async {
    try {
      final response = await http.get(
        Uri.parse(
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.latitude}&lon=${coordinates.longitude}&addressdetails=1&accept-language=en'
        ),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LabaRide App'
        }
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final address = data['address'];

        String street = address['road'] ?? 
                       address['street'] ?? 
                       address['footway'] ?? 
                       address['pedestrian'] ??
                       'Unknown Street';
        
        String barangay = address['suburb'] ?? 
                         address['village'] ?? 
                         address['subdistrict'] ?? 
                         address['neighbourhood'] ??
                         'Unknown Barangay';

        Map<String, dynamic> addressComponents = {
          'zone': userData['zone'] ?? '1',
          'street': street.trim(),
          'barangay': barangay.trim(),
          'building': userData['building'] ?? '',
        };

        setState(() {
          selectedAddress = _formatAddress(addressComponents);
          userData['street'] = addressComponents['street'];
          userData['barangay'] = addressComponents['barangay'];
        });

        // Update address on server
        await _updateUserAddress(addressComponents);
      }
    } catch (e) {
      print('Error in _getAddressFromCoordinates: $e');
      _showError('Could not get address details.');
    }
  }

   Future<void> _updateUserAddress(Map<String, dynamic> address) async {
    try {
      final response = await http.put(
        Uri.parse('http://localhost:5000/update_user_details/${widget.userId}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'zone': address['zone'],
          'street': address['street'],
          'barangay': address['barangay'],
          'building': address['building'],
        }),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to update address');
      }
    } catch (e) {
      print('Error updating address: $e');
      _showError('Failed to update address');
    }
  }

 Future<void> _loadUserData() async {
  if (widget.isGuest) {
    setState(() => _isLoading = false);
    return;
  }

  try {
    print('DEBUG: Fetching user data for ID: ${widget.userId}');
    
    // First, get user data
    final userResponse = await http.get(
      Uri.parse('http://localhost:5000/user/${widget.userId}'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      },
    );

    print('DEBUG: User Response status: ${userResponse.statusCode}');
    print('DEBUG: User Response body: ${userResponse.body}');

    if (userResponse.statusCode == 200) {
      final Map<String, dynamic> userData = jsonDecode(userResponse.body);
      
      // Now, check if user has a shop
      final shopResponse = await http.get(
        Uri.parse('http://localhost:5000/shop/user/${widget.userId}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      print('DEBUG: Shop Response status: ${shopResponse.statusCode}');
      print('DEBUG: Shop Response body: ${shopResponse.body}');

      setState(() {
        this.userData = userData['user'] ?? userData;
        
        // Set _hasShop based on shop response
        if (shopResponse.statusCode == 200) {
          final dynamic shopData = jsonDecode(shopResponse.body);
          // More detailed shop data validation
          _hasShop = shopData != null && 
                     (shopData is Map<String, dynamic> && shopData.isNotEmpty) ||
                     (shopData is List && shopData.isNotEmpty);
                     
          print('DEBUG: Shop data type: ${shopData.runtimeType}');
          print('DEBUG: Has shop set to: $_hasShop');
          
          if (_hasShop) {
            this.userData['shop'] = shopData is List ? shopData.first : shopData;
            print('DEBUG: Stored shop data: ${this.userData['shop']}');
          }
        } else {
          _hasShop = false;
          print('DEBUG: No shop found, status: ${shopResponse.statusCode}');
        }
        
        _isLoading = false;
      });

      print('DEBUG: Final user data: ${this.userData}');
      print('DEBUG: Final has shop flag: $_hasShop');
    } else {
      throw Exception('Failed to load user data: ${userResponse.statusCode}');
    }
  } catch (e) {
    print('DEBUG: Error in _loadUserData: $e');
    if (mounted) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading profile: $e')),
      );
    }
  }
}

Widget _buildShopModeButton() {
  return Container(
    width: double.infinity,
    margin: const EdgeInsets.symmetric(vertical: 8),
    child: GestureDetector(
      onTap: () {
        if (!_hasShop) {
          // Navigate to RegisterShop screen for users without shops
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => RegisterShop(
                userId: widget.userId,
                token: widget.token,
              ),
            ),
          ).then((value) {
            // After registration, navigate to login screen
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(
                builder: (context) => const UnifiedLoginScreen(),
              ),
              (route) => false,
            );
          });
          return;
        }

        // Existing shop mode switch logic
        Map<String, dynamic> shopData = {};
        if (userData['shop'] != null) {
          shopData = Map<String, dynamic>.from(userData['shop']);
          shopData['user'] = {
            'id': widget.userId,
            'name': userData['name'],
            'email': userData['email'],
            'phone': userData['phone'],
            'contact_number': userData['contact_number'],
            'emergency_contact': userData['emergency_contact'],
            'username': userData['username'],
          };
        }

        if (shopData.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Shop data not available')),
          );
          return;
        }

        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(
            builder: (context) => ProfileScreenAdmin(
              userId: widget.userId,
              token: widget.token,
              shopData: shopData,
              onSwitchToUser: () {}, 
            ),
          ),
          (route) => false,
        );
      },
      child: Container(
        width: double.infinity,
        height: 48,
        decoration: BoxDecoration(
          color: navyBlue,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _hasShop ? Icons.store_outlined : Icons.add_business,
              color: Colors.white
            ),
            const SizedBox(width: 8),
            Text(
              _hasShop ? 'Switch to Shop Mode' : 'Create Shop',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

String _formatBirthdate(String? birthdate) {
  if (birthdate == null || birthdate.isEmpty) {
    return 'No birthdate';
  }
  try {
    String cleanDate = birthdate.split('T')[0];
    final date = DateTime.parse(cleanDate);
    return DateFormat('MM/dd/yyyy').format(date);
  } catch (e) {
    print('Error formatting birthdate: $e');
    return 'No birthdate';
  }
}

  @override
  Widget build(BuildContext context) {
    print('DEBUG: Has shop: $_hasShop'); 
    // Guest Mode
    if (widget.isGuest) {
      return Scaffold(
        appBar: AppBar(
          backgroundColor: const Color.fromARGB(255, 30, 84, 171),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text(
            'Profile',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontFamily: 'Inter',
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.account_circle_outlined,
                size: 64,
                color: Color(0xFF375DFB),
              ),
              const SizedBox(height: 16),
              const Text(
                'Login Required',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF375DFB),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please login to view your profile',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const UnifiedLoginScreen(),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF375DFB),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 48,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                ),
                child: const Text(
                  'Login',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF375DFB)),
          ),
        ),
      );
    }
    return Scaffold(
      body: Column(
        children: [
          // Profile Header
          Container(
            color: navyBlue,
            padding: const EdgeInsets.fromLTRB(16, 48, 16, 16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 25,
                  backgroundColor: Colors.white,
                  child: Image.asset('assets/profile.png', width: 35),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        userData['name'] ?? 'No Name',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '#${userData['id'] ?? ''}',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => EditProfileScreen(
                          userId: widget.userId,
                          token: widget.token,
                          userData: userData,
                        ),
                      ),
                    ).then((updated) {
                      if (updated == true) {
                        _loadUserData(); 
                      }
                    });
                  },
                  child: Image.asset(
                    'assets/edit.png',
                    width: 20,
                    height: 20,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),

          // Personal Details Section
          Expanded(
            child: Container(
              color: const Color(0xFFF5F7F9),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                      child: Text(
                        'Personal Details',
                        style: TextStyle(
                          color: navyBlue,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    _buildDetailItem('assets/locationblue.png', 
                        '${userData['zone'] ?? ''}, ${userData['street'] ?? ''}, ${userData['barangay'] ?? ''}'),
                    _buildDetailItem('assets/contact.png', userData['phone'] ?? 'No phone'),
                    _buildDetailItem('assets/mail.png', userData['email'] ?? 'No email'),
                    _buildDetailItem('assets/birthdate.png', _formatBirthdate(userData['birthdate'])),
                    _buildDetailItem('assets/gender.png', userData['gender'] ?? 'No gender'),
                    
                    // Action Buttons
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        children: [
                          _buildActionButton(
                            context, 
                            'Addresses', 
                            'assets/locationwhite.png',
                            () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => Addresses(
                                  userId: widget.userId,
                                  token: widget.token,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          _buildActionButton(
                            context, 
                            'Transactions', 
                            'assets/transaction.png',
                            () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => ActiveTransact(
                                  userId: widget.userId,
                                  token: widget.token,
                                ),
                              ),
                            ),
                          ),
                         const SizedBox(height: 12),
                         _buildShopModeButton(),
                          
                          // Logout Button
                          TextButton(
                            onPressed: () {
                              showDialog(
                                context: context,
                                builder: (BuildContext context) => AlertDialog(
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  title: const Text(
                                    'Logout',
                                    style: TextStyle(
                                      color: Color.fromARGB(255, 255, 17, 0),
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  content: Text(
                                    'Do you want to logout?',
                                    style: TextStyle(
                                      fontSize: 16,
                                      color: Colors.grey[800],
                                    ),
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.pop(context),
                                      child: Text(
                                        'Cancel',
                                        style: TextStyle(
                                          color: Colors.grey[600],
                                          fontSize: 16,
                                        ),
                                      ),
                                    ),
                                    TextButton(
                                    onPressed: () {
                                      Navigator.pushAndRemoveUntil(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => const UnifiedLoginScreen(),
                                        ),
                                        (route) => false,
                                      );
                                    },
                                    child: const Text(
                                      'Confirm',
                                      style: TextStyle(
                                        color: Colors.red,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  ],
                                ),
                              );
                            },
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              backgroundColor: Colors.red[50],
                              minimumSize: const Size(double.infinity, 48),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: const Text(
                              'Logout',
                              style: TextStyle(
                                color: Color.fromARGB(255, 255, 17, 0),
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
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
        ],
      ),
      bottomNavigationBar: Container(
        height: 80,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(24),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black12,
              blurRadius: 4,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavItem(Icons.home, 'Home', Colors.grey, () {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (context) => LaundryDashboardScreen(
                    userId: widget.userId,
                    token: widget.token,
                  ),
                ),
              );
            }),
            _buildNavItem(Icons.search, 'Search', Colors.grey, () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => SearchScreen(
                    userId: widget.userId,
                    token: widget.token,
                  ),
                ),
              );
            }),
            _buildNavItem(Icons.history, 'Activities', Colors.grey, () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ActivitiesScreen(
                    userId: widget.userId,
                    token: widget.token,
                  ),
                ),
              );
            }),
            _buildNavItem(Icons.person, 'Profile', const Color(0xFF375DFB), null),
          ],
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, Color color, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: color,
              fontFamily: 'Inter',
              fontWeight: color == const Color(0xFF375DFB) ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

   Widget _buildDetailItem(String iconPath, String text) {
    return GestureDetector(
      onTap: iconPath == 'assets/locationblue.png' ? _showLocationPicker : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Image.asset(
              iconPath,
              width: 16,
              height: 16,
              color: Colors.grey[600],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  color: Colors.grey[800],
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

   void _showLocationPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.8,
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _buildMapSection(),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                if (selectedLatLng != null) {
                  _getAddressFromCoordinates(selectedLatLng!);
                }
              },
              child: const Text('Confirm Location'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Select Location',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1F1F39),
              ),
            ),
            ElevatedButton.icon(
              onPressed: _useCurrentLocation,
              icon: const Icon(Icons.my_location, color: Colors.white),
              label: const Text('Use Current Location'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF375DFB),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          height: 300,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[300]!),
          ),
          child: FlutterMap(
            mapController: mapController,
            options: MapOptions(
              initialCenter: const LatLng(13.6217, 123.1948),
              initialZoom: 15.0,
              minZoom: 5.0,
              maxZoom: 18.0,
              onTap: isSelectingLocation ? _handleMapTap : null, // Add this
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.app',
                tileProvider: CancellableNetworkTileProvider(),
              ),
              if (selectedLatLng != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: selectedLatLng!,
                      child: const Icon(
                        Icons.location_on,
                        color: Colors.red,
                        size: 40,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }

 Future<void> _useCurrentLocation() async {
  try {
    // Check location permission
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _handleGeolocationError();
        return;
      }
    }

    // Get current position
    Position position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high
    );

    setState(() {
      selectedLatLng = LatLng(position.latitude, position.longitude);
      isSelectingLocation = true;
    });
    
    mapController.move(selectedLatLng!, 15.0);
    await _getAddressFromCoordinates(selectedLatLng!);
    
  } catch (e) {
    print('Error getting location: $e');
    _handleGeolocationError();
  }
}

void _handleGeolocationError() {
  _showError('Could not get current location. Showing Naga City center.');
  setState(() {
    selectedLatLng = const LatLng(13.6217, 123.1948);
    isSelectingLocation = true;
  });
  mapController.move(selectedLatLng!, 15.0);
  _setDefaultAddress(); // Add this
}

void _showError(String message) {
  if (!mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message)),
  );
}

void _handleMapTap(TapPosition tapPosition, LatLng point) async {
  if (!isSelectingLocation) return;
  setState(() => selectedLatLng = point);
  await _getAddressFromCoordinates(point);
}

  Widget _buildActionButton(BuildContext context, String text, String iconPath, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 48,
        decoration: BoxDecoration(
          color: navyBlue,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              iconPath,
              width: 20,
              height: 20,
              color: Colors.white,
            ),
            const SizedBox(width: 8),
            Text(
              text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}