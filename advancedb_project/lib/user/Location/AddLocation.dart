import 'package:flutter/material.dart';
import 'CurrentLocation.dart';
import '../OrderingSystem/ordershopsystem.dart';

class AddLocation extends StatefulWidget {
  final int userId;
  final String token;
  final Service? service;  

  const AddLocation({
    super.key,
    required this.userId,
    required this.token,
    this.service,  
  });

  @override
  State<AddLocation> createState() => _AddLocationState();
}

class _AddLocationState extends State<AddLocation> {
  String selectedLocation = 'Zone 3, San Jose California, USA';
  final List<Map<String, String>> otherLocations = [
    {'name': 'Ateneo De Naga', 'address': 'Ateneo Ave, Naga City'},
    {'name': 'Universidad De Sta. Isabel', 'address': 'Elias Angeles St, Naga City'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          _buildMapSection(),
          const SizedBox(height: 16),
          _buildLocationsList(),
          const Spacer(),
          _buildCurrentLocationButton(),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: const Color(0xFF1A0066),
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: Colors.white),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        children: [
          const Icon(Icons.location_on, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              selectedLocation,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.notifications, color: Colors.white),
            onPressed: () {
              // TODO: Implement notifications
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMapSection() {
    return Container(
      margin: const EdgeInsets.all(16),
      height: 200,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            Image.asset(
              'assets/maps.png',
              width: double.infinity,
              fit: BoxFit.cover,
            ),
            Center(
              child: Icon(
                Icons.location_on,
                color: const Color(0xFF1A0066),
                size: 48,
                shadows: [
                  Shadow(
                    color: Colors.black.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationsList() {
    return Expanded(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle('Current Location'),
              const SizedBox(height: 8),
              _buildLocationTile(selectedLocation),
              const SizedBox(height: 16),
              _buildSectionTitle('Other Locations'),
              const SizedBox(height: 8),
              ...otherLocations.map((location) => _buildLocationTile(location['name']!)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.bold,
        color: Color(0xFF1A0066),
      ),
    );
  }

  Widget _buildLocationTile(String location) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        selectedLocation == location
            ? Icons.radio_button_checked
            : Icons.radio_button_off,
        color: const Color(0xFF1A0066),
      ),
      title: Text(
        location,
        style: const TextStyle(
          fontSize: 16,
          color: Colors.black,
        ),
      ),
      trailing: IconButton(
        icon: const Icon(Icons.more_vert, color: Colors.black),
        onPressed: () {
          // TODO: Implement location options menu
        },
      ),
      onTap: () {
        setState(() {
          selectedLocation = location;
        });
      },
    );
  }

Widget _buildCurrentLocationButton() {
  return Padding(
    padding: const EdgeInsets.all(16.0),
    child: ElevatedButton.icon(
      onPressed: () {
        if (widget.service != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => CurrentLocation(
                address: selectedLocation,
                userId: widget.userId,
                token: widget.token,
                service: widget.service!,  //can be null since service is only needed for transaction
              ),
            ),
          );
        } else {
          Navigator.pop(context, selectedLocation);
        }
      },
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          'Use Current Location',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF1A0066),
          padding: const EdgeInsets.symmetric(vertical: 16),
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
        ),
      ),
    );
  }
}