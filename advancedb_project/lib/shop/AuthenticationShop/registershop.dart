import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cancellable_tile_provider/flutter_map_cancellable_tile_provider.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../../user/authenticationuser/signupcomplete.dart';

class RegisterShop extends StatefulWidget {
  final int userId;
  final String token;

  const RegisterShop({
    super.key,
    required this.userId,
    required this.token,
  });

  @override
  State<RegisterShop> createState() => _RegisterShopState();
}

class _RegisterShopState extends State<RegisterShop> {
  final _formKey = GlobalKey<FormState>();
  final _shopNameController = TextEditingController();
  final _contactNumberController = TextEditingController();
  final _zoneController = TextEditingController();
  final _streetController = TextEditingController();
  final _barangayController = TextEditingController();
  final _buildingController = TextEditingController();
  final _openingTimeController = TextEditingController();
  final _closingTimeController = TextEditingController();

  // Map related variables
  LatLng? selectedLatLng;
  MapController mapController = MapController();
  String? selectedAddress;
  bool isSelectingLocation = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    selectedLatLng = const LatLng(13.6217, 123.1948);
    _setDefaultAddress();
  }

  void _setDefaultAddress() {
    final defaultAddress = {
      'zone': '1',
      'street': 'Magsaysay Avenue',
      'barangay': 'Peñafrancia',
      'building': '',
    };
    
    setState(() {
      selectedAddress = _formatAddress(defaultAddress);
      _zoneController.text = defaultAddress['zone']!;
      _streetController.text = defaultAddress['street']!;
      _barangayController.text = defaultAddress['barangay']!;
      _buildingController.text = defaultAddress['building']!;
    });
  }

  String _formatAddress(Map<String, dynamic> address) {
    List<String> parts = [];
    
    String zone = (address['zone']?.toString() ?? '1').trim();
    parts.add('Zone $zone');
    
    String street = (address['street']?.toString() ?? 'Magsaysay Avenue').trim();
    if (street.isNotEmpty) {
      parts.add(street);
    }
    
    String barangay = (address['barangay']?.toString() ?? 'Peñafrancia').trim();
    if (barangay.isNotEmpty) {
      parts.add(barangay);
    }
    
    String? building = address['building']?.toString();
    if (building != null && building.trim().isNotEmpty) {
      parts.add(building.trim());
    }
    
    return parts.join(', ');
  }

  Future<void> _getAddressFromCoordinates(LatLng coordinates) async {
    try {
      print('Getting address for coordinates: ${coordinates.latitude}, ${coordinates.longitude}');
      
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

        String building = address['building'] ?? 
                         address['house_name'] ?? 
                         '';

        Map<String, dynamic> addressComponents = {
          'zone': '1',
          'street': street.trim(),
          'barangay': barangay.trim(),
          'building': building.trim(),
        };

        setState(() {
          selectedAddress = _formatAddress(addressComponents);
          _zoneController.text = addressComponents['zone']!;
          _streetController.text = addressComponents['street']!;
          _barangayController.text = addressComponents['barangay']!;
          _buildingController.text = addressComponents['building']!;
        });
      } else {
        print('Failed to get address from Nominatim: ${response.statusCode}');
        _setDefaultAddress();
      }
    } catch (e) {
      print('Error in _getAddressFromCoordinates: $e');
      _setDefaultAddress();
      _showError('Could not get address details.');
    }
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
    _setDefaultAddress();
  }

  void _handleMapTap(TapPosition tapPosition, LatLng point) async {
    if (!isSelectingLocation) return;
    setState(() => selectedLatLng = point);
    await _getAddressFromCoordinates(point);
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
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
              'Pinpoint Shop Location',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1F1F39),
                fontFamily: 'Inter',
              ),
            ),
            ElevatedButton.icon(
              onPressed: _useCurrentLocation,
              icon: Icon(
                isSelectingLocation ? Icons.location_on : Icons.edit_location,
                color: Colors.white,
              ),
              label: Text(
                isSelectingLocation ? 'Cancel Pinpoint' : 'Use Current Location',
                style: const TextStyle(color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF375DFB),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          height: 200,
          margin: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[300]!),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Stack(
              children: [
                FlutterMap(
                  mapController: mapController,
                  options: MapOptions(
                    initialCenter: const LatLng(13.6217, 123.1948),
                    initialZoom: 15.0,
                    minZoom: 5.0,
                    maxZoom: 18.0,
                    onTap: isSelectingLocation ? _handleMapTap : null,
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
                if (isSelectingLocation)
                  Positioned(
                    top: 16,
                    left: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: const Text(
                        'Tap on the map to select your shop location',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (selectedAddress != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8.0),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.location_on, color: Color(0xFF1A0066)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      selectedAddress!,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  @override
  void dispose() {
    _shopNameController.dispose();
    _contactNumberController.dispose();
    _zoneController.dispose();
    _streetController.dispose();
    _barangayController.dispose();
    _buildingController.dispose();
    _openingTimeController.dispose();
    _closingTimeController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all required fields')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      print('Debug - Token being sent: ${widget.token}');
      print('Debug - User ID: ${widget.userId}');

      final response = await http.post(
        Uri.parse('http://localhost:5000/register_shop/${widget.userId}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'shop_name': _shopNameController.text.trim(),
          'contact_number': _contactNumberController.text.trim(),
          'zone': _zoneController.text.trim(),
          'street': _streetController.text.trim(),
          'barangay': _barangayController.text.trim(),
          'building': _buildingController.text.trim(),
          'opening_time': _openingTimeController.text.trim(),
          'closing_time': _closingTimeController.text.trim(),
          'latitude': selectedLatLng?.latitude,
          'longitude': selectedLatLng?.longitude,
        }),
      );

      print('Debug - Response Status: ${response.statusCode}');
      print('Debug - Response Body: ${response.body}');

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        if (!mounted) return;
        
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const SignUpCompleteScreen(),
          ),
        );
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Registration failed')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Text(
        title,
        style: const TextStyle(
          color: Color(0xFF1A0066),
          fontSize: 18,
          fontWeight: FontWeight.bold,
          fontFamily: 'Inter',
        ),
      ),
    );
  }

  Widget _buildTextField(String label, String hint, TextEditingController controller, {bool required = true}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: label,
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.black87,
                  fontFamily: 'Inter',
                ),
              ),
              if (required)
                const TextSpan(
                  text: ' *',
                  style: TextStyle(color: Colors.red),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          validator: (value) {
            if (required && (value == null || value.isEmpty)) {
              return 'This field is required';
            }
            return null;
          },
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.grey[400]),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            filled: true,
            fillColor: Colors.grey[50],
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
        ),
      ],
    );
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
        title: Row(
          children: [
            Image.asset('assets/blacklogo.png', height: 35),
            const SizedBox(width: 10),
            const Text(
              'Register your shop',
              style: TextStyle(
                color: Color(0xFF1A0066),
                fontSize: 20,
                fontWeight: FontWeight.w600,
                fontFamily: 'Inter',
              ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionTitle('Shop Information'),
                _buildTextField('Shop Name', 'Enter shop name', _shopNameController),
                _buildTextField('Contact Number', 'Enter contact number', _contactNumberController),
                const SizedBox(height: 24),

                _buildSectionTitle('Address'),
                _buildMapSection(),
                const SizedBox(height: 16),
                _buildTextField('Zone Name', 'Enter zone', _zoneController),
                _buildTextField('Street Name', 'Enter street name', _streetController),
                _buildTextField('Barangay Name', 'Enter barangay name', _barangayController),
                _buildTextField('Building Name', 'Enter building name', _buildingController, required: false),
                const SizedBox(height: 24),

                _buildSectionTitle('Business Hours'),
                _buildTextField('Opening Time', 'Enter opening time (eg. 5:00am)', _openingTimeController),
                _buildTextField('Closing Time', 'Enter closing time (eg. 11:00pm)', _closingTimeController),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF375DFB),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'Register Shop',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              fontFamily: 'Inter',
                            ),
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
}