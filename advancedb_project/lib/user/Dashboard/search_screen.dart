import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../OrderingSystem/ordershopsystem.dart';
import 'laundry_dashboard_screen.dart';
import '../../loginscreen.dart';

class SearchScreen extends StatefulWidget {
  final int userId;
  final String token;
  final bool isGuest;

  const SearchScreen({
    super.key,
    required this.userId,
    required this.token,
    this.isGuest = false,
  });

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final List<String> _searchHistory = [];
  List<LaundryShop> _searchResults = [];
  bool _isLoading = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadSearchHistory();
  }

  void _loadSearchHistory() {
    setState(() {
      _searchHistory.clear();
    });
  }

 Future<void> _searchShops(String query) async {
    if (query.isEmpty) {
      setState(() {
        _searchResults = [];
        _errorMessage = '';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/shops'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final allShops = data is List ? data : data['shops'] as List;

        // Enhanced search filtering
        final filteredShops = allShops.where((shop) {
          final shopName = shop['shop_name']?.toString().toLowerCase() ?? '';
          final location = shop['location']?.toString().toLowerCase() ?? '';
          final searchQuery = query.toLowerCase();
          
          return shopName.contains(searchQuery) || 
                 location.contains(searchQuery);
        }).toList();

        setState(() {
          _searchResults = filteredShops.map((shop) => LaundryShop(
            id: shop['id']?.toString() ?? '',
            name: shop['shop_name'] ?? '',
            image: shop['image'] ?? 'assets/default_shop.png',
            rating: shop['rating']?.toDouble() ?? 0.0,
            distance: shop['distance']?.toString() ?? 'N/A',
            isOpen: shop['is_open'] ?? false,
            location: shop['location'] ?? '',
            status: shop['status'] ?? 'Unknown',
            totalPrice: shop['total_price']?.toString() ?? 'N/A',
          )).toList();
          _isLoading = false;
        });

        // Only add to history if results were found
        if (_searchResults.isNotEmpty) {
          _addToSearchHistory(query);
        }
      } else {
        throw Exception('Failed to load shops: ${response.statusCode}');
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().contains('TimeoutException') 
            ? 'Connection timed out. Please check your internet connection.'
            : 'Error searching shops. Please try again.';
        _isLoading = false;
        _searchResults = [];
      });
    }
  }

  void _addToSearchHistory(String query) {
    if (query.isNotEmpty && !_searchHistory.contains(query)) {
      setState(() {
        _searchHistory.insert(0, query);
        if (_searchHistory.length > 10) {
          _searchHistory.removeLast();
        }
      });
    }
  }

Future<void> _handleShopTap(LaundryShop shop) async {
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
      if (shopId.isEmpty) {
        throw Exception('Shop ID is empty');
      }

      print('Fetching shop data for ID: $shopId');

      final shopResponse = await http.get(
        Uri.parse('http://localhost:5000/shop/$shopId'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      if (shopResponse.statusCode != 200) {
        throw Exception('Failed to load shop data: ${shopResponse.statusCode}');
      }

      final shopData = jsonDecode(shopResponse.body);
      final servicesResponse = await http.get(
        Uri.parse('http://localhost:5000/shop/$shopId/services'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      final clothingResponse = await http.get(
        Uri.parse('http://localhost:5000/shop/$shopId/clothing'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      final householdResponse = await http.get(
        Uri.parse('http://localhost:5000/shop/$shopId/household'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      return {
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
    } catch (e) {
      print('Error fetching complete shop data: $e');
      throw e;
    }
  }

  Widget _buildShopCard(LaundryShop shop) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        onTap: () => _handleShopTap(shop),
        contentPadding: const EdgeInsets.all(16),
        title: Text(
          shop.name,
          style: const TextStyle(
            fontSize: 18, // Increased font size
            fontWeight: FontWeight.bold,
            color: Color(0xFF1A0066),
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: Text(
            shop.location,
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: _searchShops,
                      onSubmitted: (value) {
                        _addToSearchHistory(value);
                        _searchShops(value);
                      },
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
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Colors.grey.shade200),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF1A0066)),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF1A0066),
                      ),
                    )
                  : _errorMessage.isNotEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Color(0xFF1A0066),
                                size: 48,
                              ),
                              const SizedBox(height: 16),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 32),
                                child: Text(
                                  _errorMessage,
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 16,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: () => _searchShops(_searchController.text),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1A0066),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child: const Text(
                                  'Retry',
                                  style: TextStyle(color: Colors.white),
                                ),
                              ),
                            ],
                          ),
                        )
                      : _searchResults.isEmpty
                          ? _searchController.text.isEmpty
                              ? _buildSearchHistory()
                              : Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.search_off,
                                        size: 48,
                                        color: Colors.grey[400],
                                      ),
                                      const SizedBox(height: 16),
                                      const Text(
                                        'No laundry shop matched',
                                        style: TextStyle(
                                          color: Colors.grey,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _searchResults.length,
                              itemBuilder: (context, index) {
                                return _buildShopCard(_searchResults[index]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchHistory() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Search History',
            style: TextStyle(
              color: Color(0xFF1A0066),
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _searchHistory.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.history,
                          size: 48,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'No search history yet',
                          style: TextStyle(
                            color: Colors.grey,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    itemCount: _searchHistory.length,
                    itemBuilder: (context, index) {
                      return _buildSearchHistoryItem(_searchHistory[index]);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchHistoryItem(String query) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: InkWell(
        onTap: () {
          _searchController.text = query;
          _searchShops(query);
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.history,
                color: Color(0xFF1A0066),
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  query,
                  style: const TextStyle(
                    color: Color(0xFF1A0066),
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(
                  Icons.close,
                  color: Colors.grey,
                  size: 20,
                ),
                onPressed: () {
                  setState(() {
                    _searchHistory.remove(query);
                  });
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}