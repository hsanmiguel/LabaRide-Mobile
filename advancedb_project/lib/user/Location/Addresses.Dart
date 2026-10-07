import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cancellable_tile_provider/flutter_map_cancellable_tile_provider.dart';
import 'package:latlong2/latlong.dart';
import 'package:geocoding/geocoding.dart';
import '../ProfileUser/UserProfile.dart';
import '../OrderingSystem/ordershopsystem.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:geolocator/geolocator.dart';

class Addresses extends StatefulWidget {
  final int userId;
  final String token;
  final Service? service;

  const Addresses({
    super.key,
    required this.userId,
    required this.token,
    this.service,
  });

  @override
  State<Addresses> createState() => _AddressesState();
}

class _AddressesState extends State<Addresses> {
  final Color navyBlue = const Color(0xFF1A0066);
  List<Map<String, dynamic>> addresses = [];
  LatLng? selectedLatLng;
  MapController mapController = MapController();
  String? selectedAddress;
  bool isSelectingLocation = false;
  bool isLoading = true;
  final TextEditingController addressController = TextEditingController();

  @override
  void initState() {
    super.initState();
    selectedLatLng = const LatLng(13.6217, 123.1948);
    _loadSavedAddresses();
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
    });
  }

  Future<void> _loadSavedAddresses() async {
    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/user/${widget.userId}'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );

      if (response.statusCode == 200) {
        final userData = jsonDecode(response.body);
        final userAddress = {
          'zone': userData['zone'],
          'street': userData['street'],
          'barangay': userData['barangay'],
          'building': userData['building'],
        };

        setState(() {
          addresses = [userAddress];
          isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading addresses: $e');
      setState(() => isLoading = false);
    }
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
        });
      } else {
        _setDefaultAddress();
      }
    } catch (e) {
      print('Error in _getAddressFromCoordinates: $e');
      _setDefaultAddress();
      _showError('Could not get address details.');
    }
  }

  Future<void> _useCurrentLocation() async {
  if (isSelectingLocation) {
    _saveSelectedLocation();
    return;
  }

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

  void _showAddAddressDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'Add New Address',
          style: TextStyle(color: navyBlue),
        ),
        content: TextField(
          controller: addressController,
          decoration: InputDecoration(
            hintText: 'Enter address',
            focusedBorder: UnderlineInputBorder(
              borderSide: BorderSide(color: navyBlue),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: Colors.grey),
            ),
          ),
          TextButton(
            onPressed: () {
              if (addressController.text.isNotEmpty) {
                // Add address handling logic here
                Navigator.pop(context);
              }
            },
            child: Text(
              'Add',
              style: TextStyle(color: navyBlue),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _saveSelectedLocation() async {
    if (selectedAddress == null) {
      _showError('Please select a location first');
      return;
    }

    try {
      final addressParts = selectedAddress!.split(', ');
      
      final Map<String, dynamic> addressData = {
        'zone': addressParts[0].replaceAll('Zone ', ''),
        'street': addressParts.length > 1 ? addressParts[1] : '',
        'barangay': addressParts.length > 2 ? addressParts[2] : '',
        'building': addressParts.length > 3 ? addressParts[3] : ''
      };

      final response = await http.put(
        Uri.parse('http://localhost:5000/update_user_details/${widget.userId}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(addressData),
      );

      if (response.statusCode == 200) {
        setState(() {
          addresses = [addressData];
          isSelectingLocation = false;
        });
        
        await _loadSavedAddresses();
        
        if (widget.service != null) {
          Navigator.pop(context, selectedAddress);
        }
        _showError('Location saved successfully');
      } else {
        throw Exception('Failed to save location: ${response.statusCode}');
      }
    } catch (e) {
      _showError('Failed to save location');
    }
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: navyBlue),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Address',
          style: TextStyle(
            color: navyBlue,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: isLoading 
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  height: 250,
                  margin: const EdgeInsets.all(16),
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
                                'Tap on the map to select your location',
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
                    padding: const EdgeInsets.all(16),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.location_on, color: navyBlue),
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
                Expanded(
                  child: ListView.builder(
                    itemCount: addresses.length,
                    itemBuilder: (context, index) {
                      final address = addresses[index];
                      return ListTile(
                        leading: Icon(Icons.home, color: navyBlue),
                        title: Text(_formatAddress(address)),
                        subtitle: const Text('Default Address'),
                      );
                    },
                  ),
                ),
              ],
            ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: _useCurrentLocation,
          style: ElevatedButton.styleFrom(
            backgroundColor: navyBlue,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: Text(
            isSelectingLocation ? 'Save Location' : 'Use Current Location',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    addressController.dispose();
    super.dispose();
  }
}