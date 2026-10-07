import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cancellable_tile_provider/flutter_map_cancellable_tile_provider.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'viewshopinfo.dart';

class MapScreen extends StatefulWidget {
  final int userId;
  final String token;
  final List<Map<String, dynamic>>? shops; // Accept shops as an optional parameter

  const MapScreen({
    super.key,
    required this.userId,
    required this.token,
    this.shops,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final TextEditingController _searchController = TextEditingController();
  final MapController mapController = MapController();
  final List<Marker> markers = [];
  Position? currentPosition;
  bool isLoading = true;

  static const LatLng nagaCityCenter = LatLng(13.6248, 123.1875);
  static const double nagaCityRadius = 11.0;

@override
void initState() {
  super.initState();
  _getCurrentLocation();
  if (widget.shops != null) {
    print('Shops passed to map:');
    for (var shop in widget.shops!) {
      print(shop);
    }
    _addShopMarkers(widget.shops!);
  } else {
    // Fetch all shops if none were passed
    _fetchAllShopsWithCoordinates();
  }
}

@override
void didChangeDependencies() {
  super.didChangeDependencies();
  if (widget.shops != null) {
    markers.clear();
    _addShopMarkers(widget.shops!);
  }
}

  void _addShopMarkers(List<Map<String, dynamic>> shops) {
    setState(() {
      for (var shop in shops) {
        if (shop['latitude'] != null && shop['longitude'] != null) {
          markers.add(_createShopMarker({
            ...shop,
            'name': shop['shop_name'] ?? shop['name'] ?? '',
          }));
        }
      }
    });
  }

  Future<void> _getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showError('Location services are disabled');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showError('Location permissions are denied');
          return;
        }
      }

      Position position = await Geolocator.getCurrentPosition();
      
      if (_isWithinNagaCity(position)) {
        setState(() {
          currentPosition = position;
          markers.add(_createCurrentLocationMarker(position));
        });
        await _fetchNearbyShops(position);
      } else {
        _showError('You are outside Naga City. Showing Naga City center.');
        await _fetchNearbyShops(Position(
          latitude: nagaCityCenter.latitude,
          longitude: nagaCityCenter.longitude,
          timestamp: DateTime.now(),
          accuracy: 0,
          altitude: 0,
          heading: 0,
          speed: 0,
          speedAccuracy: 0,
          altitudeAccuracy: 0,
          headingAccuracy: 0,
        ));
      }

      setState(() => isLoading = false);
    } catch (e) {
      print('Error getting location: $e');
      _showError('Failed to get current location');
      setState(() => isLoading = false);
    }
  }

  Future<void> _fetchAllShopsWithCoordinates() async {
    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/shops'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final shopsList = data is List ? data : data['shops'] as List;
        setState(() {
          for (var shop in shopsList) {
            if (shop['latitude'] != null && shop['longitude'] != null) {
              markers.add(_createShopMarker(shop));
            }
          }
        });
      } else {
        _showError('Failed to fetch all shops');
      }
    } catch (e) {
      print('Error fetching all shops: $e');
      _showError('Failed to fetch all shops');
    }
  }

  Marker _createCurrentLocationMarker(Position position) {
    return Marker(
      point: LatLng(position.latitude, position.longitude),
      child: const Icon(
        Icons.location_on,
        color: Colors.blue,
        size: 40,
      ),
    );
  }

  bool _isWithinNagaCity(Position position) {
    final Distance distance = Distance();
    final double distanceInKm = distance.as(
      LengthUnit.Kilometer,
      LatLng(position.latitude, position.longitude),
      nagaCityCenter,
    );
    return distanceInKm <= nagaCityRadius;
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
            markers.add(_createShopMarker(shop));
          }
        });
      } else {
        _showError('Failed to fetch nearby shops');
      }
    } catch (e) {
      print('Error fetching nearby shops: $e');
      _showError('Failed to fetch nearby shops');
    }
  }

 Marker _createShopMarker(Map<String, dynamic> shop) {
  return Marker(
    point: LatLng(shop['latitude'], shop['longitude']),
    width: 60,
    height: 80,
    child: GestureDetector(
      onTap: () => _showShopDetails(shop),
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.purple.withOpacity(0.8),
                  blurRadius: 24,
                  spreadRadius: 8,
                ),
              ],
            ),
            child: Image.asset(
              'assets/laundryiconmap.png',
              width: 25,
              height: 30,
            ),
          ),
          Container(
            margin: const EdgeInsets.only(top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.9),
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: Colors.purple.withOpacity(0.2),
                  blurRadius: 4,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Text(
              shop['name'] ?? shop['shop_name'] ?? '',
              style: const TextStyle(
                fontSize: 13,
                color: Colors.purple,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: _buildAppBar(),
      body: Stack(
        children: [
          if (isLoading)
            const Center(child: CircularProgressIndicator())
          else
            _buildMap(),
          _buildLocationButton(),
        ],
      ),
    );
  }

  Widget _buildMap() {
    return FlutterMap(
      mapController: mapController,
      options: MapOptions(
        initialCenter: nagaCityCenter,
        initialZoom: 14.0,
        minZoom: 13.0,
        maxZoom: 18.0,
        onTap: (_, __) => Navigator.of(context).popUntil((route) => route.isFirst),
        onMapReady: _addCityBoundaryMarker,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.example.labaride',
          tileProvider: CancellableNetworkTileProvider(),
        ),
        MarkerLayer(markers: markers),
      ],
    );
  }

  void _addCityBoundaryMarker() {
    markers.add(
      Marker(
        point: nagaCityCenter,
        child: Container(
          width: 22 * 1000,
          height: 22 * 1000,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xFF1A0066).withOpacity(0.3),
              width: 2,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLocationButton() {
    return Positioned(
      right: 16,
      bottom: 16,
      child: FloatingActionButton(
        onPressed: _handleLocationPress,
        backgroundColor: Colors.white,
        child: const Icon(
          Icons.my_location,
          color: Color(0xFF1A0066),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return PreferredSize(
      preferredSize: const Size.fromHeight(100),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        color: Colors.white,
        child: SafeArea(
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
                onPressed: () => Navigator.pop(context),
              ),
              Expanded(
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F3F3),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: _buildSearchField(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSearchField() {
    return Row(
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 8.0),
          child: Icon(
            Icons.location_on,
            color: Color(0xFF1A0066),
          ),
        ),
        Expanded(
          child: TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: 'Type laundry shop name',
              hintStyle: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 14,
              ),
              border: InputBorder.none,
            ),
            onSubmitted: _handleSearch,
          ),
        ),
      ],
    );
  }

  void _handleSearch(String value) {
  if (value.isEmpty) {
    setState(() {
      markers.clear();
      if (currentPosition != null) {
        markers.add(_createCurrentLocationMarker(currentPosition!));
      }
      // Restore all shop markers
      if (widget.shops != null) {
        for (var shop in widget.shops!) {
          if (shop['latitude'] != null && shop['longitude'] != null) {
            markers.add(_createShopMarker(shop));
          }
        }
      }
    });
    return;
  }

  setState(() {
    markers.clear();
    if (currentPosition != null) {
      markers.add(_createCurrentLocationMarker(currentPosition!));
    }
    // Only add matching shops with improved search
    if (widget.shops != null) {
      for (var shop in widget.shops!) {
        final shopName = shop['shop_name']?.toString().toLowerCase() ?? '';
        final street = shop['street']?.toString().toLowerCase() ?? '';
        final barangay = shop['barangay']?.toString().toLowerCase() ?? '';
        final building = shop['building']?.toString().toLowerCase() ?? '';
        
        final matches = shopName.contains(value.toLowerCase()) ||
                       street.contains(value.toLowerCase()) ||
                       barangay.contains(value.toLowerCase()) ||
                       building.contains(value.toLowerCase());
        
        if (matches && shop['latitude'] != null && shop['longitude'] != null) {
          markers.add(_createShopMarker(shop));
        }
      }
    }
  });

  if (markers.length <= 1) { // Only current location marker
    _showError('No shops found matching "$value"');
  }
}

  Future<void> _handleLocationPress() async {
  try {
    Position position = await Geolocator.getCurrentPosition();
    if (_isWithinNagaCity(position)) {
      mapController.move(
        LatLng(position.latitude, position.longitude),
        14.0,
      );
      setState(() {
        currentPosition = position;
      });
    } else {
      mapController.move(nagaCityCenter, 14.0);
      _showError('Showing Naga City center');
    }
  } catch (e) {
    print('Error getting location: $e');
    _showError('Failed to get current location');
  }
}

  void _showShopDetails(Map<String, dynamic> shop) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ShopDetailsOverlay(
        userId: widget.userId,
        token: widget.token,
        shopDetails: shop,
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}