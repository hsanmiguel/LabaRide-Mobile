import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geocoding/geocoding.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ShopDetails extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const ShopDetails({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  State<ShopDetails> createState() => _ShopDetailsState();
}

class _ShopDetailsState extends State<ShopDetails> {
  late final TextEditingController _shopNameController;
  late final TextEditingController _businessHoursController;
  late final TextEditingController _contactController;
  late final TextEditingController _shopIdController;
  
  bool _isShopNameEditing = false;
  bool _isBusinessHoursEditing = false;
  bool _isContactEditing = false;
  
  // Added for map functionality
  LatLng? shopLatLng;
  bool isUpdatingLocation = false;
  String? shopAddress;

  @override
  void initState() {
    super.initState();
    _shopIdController = TextEditingController(
      text: widget.shopData['id']?.toString() ?? ''
    );
    _shopNameController = TextEditingController(
      text: widget.shopData['shop_name'] ?? ''
    );
    _businessHoursController = TextEditingController(
      text: '${widget.shopData['opening_time'] ?? ''} - ${widget.shopData['closing_time'] ?? ''}'
    );
    _contactController = TextEditingController(
      text: widget.shopData['contact_number'] ?? widget.shopData['user']?['contact_number'] ?? ''
    );
    // Initialize map location
    shopLatLng = (widget.shopData['latitude'] != null && widget.shopData['longitude'] != null)
        ? LatLng(
            double.parse(widget.shopData['latitude'].toString()),
            double.parse(widget.shopData['longitude'].toString())
          )
        : null;
    shopAddress = widget.shopData['address'];
  }

  Future<void> _updateShopLocation(LatLng latlng) async {
    try {
      setState(() { isUpdatingLocation = true; });
      List<Placemark> placemarks = await placemarkFromCoordinates(latlng.latitude, latlng.longitude);
      String address = 'Unknown location';
      if (placemarks.isNotEmpty) {
        final placemark = placemarks.first;
        address = [
          placemark.name,
          placemark.street,
          placemark.subLocality,
          placemark.locality,
          placemark.subAdministrativeArea,
          placemark.administrativeArea,
          placemark.country
        ].where((e) => e != null && e.isNotEmpty).join(', ');
      }
      await _saveShopLocationToBackend(latlng, address);
      setState(() {
        shopLatLng = latlng;
        shopAddress = address;
        isUpdatingLocation = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Shop location updated!')),
      );
    } catch (e) {
      setState(() { isUpdatingLocation = false; });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update location: $e')),
      );
    }
  }

  Future<void> _saveShopLocationToBackend(LatLng latlng, String address) async {
    final response = await http.put(
      Uri.parse('http://localhost:5000/update_shop_location/${widget.shopData['id']}'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'latitude': latlng.latitude,
        'longitude': latlng.longitude,
        'address': address,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to update shop location');
    }
  }

  Future<void> _saveField(String field, String value) async {
    try {
      final updateData = <String, dynamic>{};
      
      if (field == 'Shop Name') {
        updateData['shop_name'] = value;
      } else if (field == 'Contact') {
        updateData['contact_number'] = value;
      } else if (field == 'Business Hours') {
        final times = value.split(' - ');
        if (times.length == 2) {
          updateData['opening_time'] = times[0].trim();
          updateData['closing_time'] = times[1].trim();
        }
      }
      
      if (updateData.isEmpty) return;

      final response = await http.put(
        Uri.parse('http://localhost:5000/update_shop/${widget.shopData['id']}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(updateData),
      );

      if (response.statusCode == 200) {
        setState(() {
          widget.shopData.addAll(updateData);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Changes saved successfully')),
        );
      } else {
        throw Exception('Failed to save changes');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save changes: $e')),
      );
    }
  }

  Widget _buildEditableField(String label, TextEditingController controller, bool isEditing, Function() onEditPress, {bool isEditable = true}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1A0066),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey[300]!),
          ),
          child: Row(
            children: [
              Expanded(
                child: isEditing
                    ? TextField(
                        controller: controller,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.black87,
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                        onSubmitted: (value) {
                          _saveField(label, value);
                          onEditPress();
                        },
                      )
                    : Text(
                        controller.text,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.black87,
                        ),
                      ),
              ),
              if (isEditable)
                GestureDetector(
                  onTap: onEditPress,
                  child: ColorFiltered(
                    colorFilter: ColorFilter.mode(
                      isEditing ? const Color(0xFF1A0066) : Colors.grey[400]!,
                      BlendMode.srcIn,
                    ),
                    child: Image.asset(
                      isEditing ? 'assets/Admin/Save.png' : 'assets/Admin/Edit.png',
                      width: 20,
                      height: 20,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE6E0FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
          onPressed: () => Navigator.pop(context, widget.shopData),
        ),
        title: const Text(
          'Shop Details',
          style: TextStyle(
            color: Color(0xFF1A0066),
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Shop Location',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A0066),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              height: 250,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: FlutterMap(
                  options: MapOptions(
                    center: shopLatLng ?? const LatLng(13.6248, 123.1875),
                    zoom: 16,
                    onTap: (tapPosition, latlng) => _updateShopLocation(latlng),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.example.labaride',
                    ),
                    if (shopLatLng != null)
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: shopLatLng!,
                            child: const Icon(Icons.location_on, color: Colors.red, size: 40),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
            if (isUpdatingLocation)
              const Padding(
                padding: EdgeInsets.all(8.0),
                child: LinearProgressIndicator(color: Color(0xFF1A0066)),
              ),
            if (shopAddress != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  'Current Address: $shopAddress',
                  style: const TextStyle(fontSize: 14, color: Colors.black54),
                ),
              ),
            const SizedBox(height: 24),
            _buildEditableField(
              'Shop ID',
              _shopIdController,
              false,
              () {},
              isEditable: false,
            ),
            const SizedBox(height: 16),
            _buildEditableField(
              'Shop Name',
              _shopNameController,
              _isShopNameEditing,
              () => setState(() => _isShopNameEditing = !_isShopNameEditing),
            ),
            const SizedBox(height: 16),
            _buildEditableField(
              'Business Hours',
              _businessHoursController,
              _isBusinessHoursEditing,
              () => setState(() => _isBusinessHoursEditing = !_isBusinessHoursEditing),
            ),
            const SizedBox(height: 16),
            _buildEditableField(
              'Contact',
              _contactController,
              _isContactEditing,
              () => setState(() => _isContactEditing = !_isContactEditing),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _shopIdController.dispose();
    _shopNameController.dispose();
    _businessHoursController.dispose();
    _contactController.dispose();
    super.dispose();
  }
}