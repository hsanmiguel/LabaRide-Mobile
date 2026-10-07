import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ShopMap extends StatefulWidget {
  final String token;
  final Map<String, dynamic> shopData;

  const ShopMap({
    super.key,
    required this.token,
    required this.shopData,
  });

  @override
  State<ShopMap> createState() => _ShopMapState();
}

class _ShopMapState extends State<ShopMap> {
  MapController mapController = MapController();
  List<Marker> markers = [];
  Position? currentPosition;

  @override
  void initState() {
    super.initState();
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

      // Add marker for current location
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

      // Fetch nearby shops and add markers
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
                  onTap: () {
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
                  },
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

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 300,
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
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: currentPosition == null
            ? const Center(child: CircularProgressIndicator())
            : FlutterMap(
                mapController: mapController,
                options: MapOptions(
                  initialCenter: LatLng(
                    currentPosition!.latitude,
                    currentPosition!.longitude,
                  ),
                  initialZoom: 14,
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.example.labaride',
                  ),
                  MarkerLayer(markers: markers),
                ],
              ),
      ),
    );
  }
} 