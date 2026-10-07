import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../OrderScreen/OrderScreen.dart';
import '../ProfileShop/ShopProfile.dart';
import '../CustomerOrder/CustomerOrder.dart';
import '../ShopDashboard/homescreen.dart';

class KiloPrice {
    double minKilo;
    double maxKilo;
    double pricePerKilo;

    KiloPrice({
      required this.minKilo,
      required this.maxKilo,
      required this.pricePerKilo,
    });
  }
  
class ServiceScreen1 extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;

  const ServiceScreen1({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
  });

  @override
  State<ServiceScreen1> createState() => _ServiceScreen1State();
}

class _ServiceScreen1State extends State<ServiceScreen1> {
  List<Map<String, dynamic>> _services = [];
  bool _isLoading = false;
  bool _isEditing = false;
  
  Map<String, KiloPrice> kiloPrices = {};
  final TextEditingController minKiloController = TextEditingController();
  final TextEditingController maxKiloController = TextEditingController();
  final TextEditingController pricePerKiloController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadServices();
    _loadKiloPrices();
  }

  @override
  void dispose() {
    minKiloController.dispose();
    maxKiloController.dispose();
    pricePerKiloController.dispose();
    super.dispose();
  }

  Future<void> _loadServices() async {
    setState(() => _isLoading = true);
    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/shop/${widget.shopData['id']}/services'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _services = List<Map<String, dynamic>>.from(data['services'] ?? []);
        });
      }
    } catch (e) {
      print('Error loading services: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading services: $e')),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

 Future<void> _loadKiloPrices() async {
  try {
    final response = await http.get(
      Uri.parse('http://localhost:5000/shop/${widget.shopData['id']}/kilo-prices'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      }
    );

    print('Loading kilo prices... Status: ${response.statusCode}'); // Debug print
    print('Response body: ${response.body}'); // Debug print

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (mounted) {
        setState(() {
          kiloPrices.clear();
          if (data['prices'] != null) {
            for (var price in data['prices']) {
              print('Processing price: $price'); // Debug print
              String key = "${price['min_kilo']}-${price['max_kilo']}";
              kiloPrices[key] = KiloPrice(
                minKilo: double.parse(price['min_kilo'].toString()),
                maxKilo: double.parse(price['max_kilo'].toString()),
                pricePerKilo: double.parse(price['price_per_kilo'].toString())
              );
            }
          }
        });
      }
    }
  } catch (e) {
    print('Error loading kilo prices: $e');
  }
}

  Future<void> _addService(String name, Color color, double price) async {
  setState(() => _isLoading = true);
  try {
    final response = await http.post(
      Uri.parse('http://localhost:5000/shop/${widget.shopData['id']}/service'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'service_name': name.toUpperCase(),
        'color': color.value.toString(),
        'price': price,
      }),
    );

    if (response.statusCode == 201) {
      await _loadServices();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Service added successfully')),
      );
    }
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error adding service: $e')),
    );
  } finally {
    setState(() => _isLoading = false);
  }
}

  Future<void> _updateService(int serviceId, String name, double price) async {
  try {
    final response = await http.put(
      Uri.parse('http://localhost:5000/shop/service/$serviceId'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'name': name,
        'price': price,
      }),
    );

    if (response.statusCode == 200) {
      await _loadServices(); // Reload services to update UI
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Service updated successfully')),
        );
      }
    } else {
      throw Exception('Failed to update service');
    }
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error updating service: $e')),
    );
  }
}

  Future<void> _deleteService(int serviceId) async {
    try {
      final response = await http.delete(
        Uri.parse('http://localhost:5000/shop/service/$serviceId'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (response.statusCode == 200) {
        await _loadServices();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Service deleted successfully')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error deleting service: $e')),
      );
    }
  }

 Future<void> _saveKiloPrice() async {
  try {
    // Validate empty fields
    if (minKiloController.text.isEmpty || 
        maxKiloController.text.isEmpty || 
        pricePerKiloController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all fields')),
      );
      return;
    }

    final minKilo = double.tryParse(minKiloController.text);
    final maxKilo = double.tryParse(maxKiloController.text);
    final pricePerKilo = double.tryParse(pricePerKiloController.text);

    // Validate numeric values
    if (minKilo == null || maxKilo == null || pricePerKilo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter valid numbers')),
      );
      return;
    }

    // Validate kilo range
    if (minKilo >= maxKilo) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum kilo must be greater than minimum kilo')),
      );
      return;
    }

    final response = await http.post(
      Uri.parse('http://localhost:5000/shop/${widget.shopData['id']}/kilo-price'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'min_kilo': minKilo,
        'max_kilo': maxKilo,
        'price_per_kilo': pricePerKilo,
      })
    );

    if (response.statusCode == 201) {
      // Clear input controllers
      minKiloController.clear();
      maxKiloController.clear();
      pricePerKiloController.clear();
      
      // Close the dialog
      if (mounted) Navigator.pop(context);
      
      // Reload prices and force UI refresh
      await _loadKiloPrices();
      
      // Force rebuild of the widget
      if (mounted) {
        setState(() {
          // Add the new price directly to the map
          String key = "$minKilo-$maxKilo";
          kiloPrices[key] = KiloPrice(
            minKilo: minKilo,
            maxKilo: maxKilo,
            pricePerKilo: pricePerKilo
          );
        });
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Price range added successfully')),
      );
    }
  } catch (e) {
    print('Error saving kilo price: $e');
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving price range: $e')),
      );
    }
  }
}

  Future<void> _deleteKiloPrice(double minKilo, double maxKilo) async {
    try {
      final response = await http.delete(
        Uri.parse('http://localhost:5000/shop/${widget.shopData['id']}/kilo-price'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'min_kilo': minKilo,
          'max_kilo': maxKilo,
        })
      );

      if (response.statusCode == 200) {
        await _loadKiloPrices();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Price range deleted successfully')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error deleting price range: $e')),
      );
    }
  }

  void _showAddServiceDialog(BuildContext context) {
  final nameController = TextEditingController();
  final priceController = TextEditingController();
  Color selectedColor = const Color(0xFF1A0066);

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Add Service'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Service Name',
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.characters,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: priceController,
            decoration: const InputDecoration(
              labelText: 'Service Price',
              prefixText: '₱',
              border: OutlineInputBorder(),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Select Color:'),
              DropdownButton<Color>(
                value: selectedColor,
                items: const [
                  DropdownMenuItem(
                    value: Color(0xFF1A0066),
                    child: CircleAvatar(backgroundColor: Color(0xFF1A0066)),
                  ),
                  DropdownMenuItem(
                    value: Color(0xFF5AB090),
                    child: CircleAvatar(backgroundColor: Color(0xFF5AB090)),
                  ),
                  DropdownMenuItem(
                    value: Color(0xFF64B5F6),
                    child: CircleAvatar(backgroundColor: Color(0xFF64B5F6)),
                  ),
                ],
                onChanged: (color) {
                  if (color != null) {
                    selectedColor = color;
                  }
                },
              ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () async {
            if (nameController.text.isNotEmpty && priceController.text.isNotEmpty) {
              await _addService(
                nameController.text, 
                selectedColor,
                double.tryParse(priceController.text) ?? 0
              );
              nameController.clear();
              priceController.clear();
            }
          },
          child: const Text('Add'),
        ),
      ],
    ),
  );
}

  void _showKiloPricesPopup(BuildContext context) {
  // Load kilo prices first
  _loadKiloPrices().then((_) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) {
          return Container(
            padding: const EdgeInsets.all(16),
            height: MediaQuery.of(context).size.height * 0.8,
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'PRICE PER KILO',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A0066),
                      ),
                    ),
                    IconButton(
                      icon: Icon(_isEditing ? Icons.done : Icons.edit),
                      onPressed: () => setState(() => _isEditing = !_isEditing),
                    ),
                  ],
                ),
                Expanded(
                  child: kiloPrices.isEmpty 
                    ? const Center(
                        child: Text(
                          'No price ranges set',
                          style: TextStyle(
                            color: Colors.grey,
                            fontSize: 16,
                          ),
                        ),
                      )
                    : ListView.builder(
                        itemCount: kiloPrices.length,
                        itemBuilder: (context, index) {
                          final entry = kiloPrices.entries.elementAt(index);
                          final price = entry.value;
                          return Card(
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            child: ListTile(
                              title: Text(
                                '${price.minKilo}kg - ${price.maxKilo}kg',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              subtitle: Text(
                                '₱${price.pricePerKilo.toStringAsFixed(2)}/kg',
                                style: const TextStyle(color: Color(0xFF1A0066)),
                              ),
                              trailing: _isEditing ? Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.edit),
                                    onPressed: () => _showEditKiloPriceDialog(context, price),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete),
                                    onPressed: () => _showKiloPriceDeleteConfirmation(
                                      context, price.minKilo, price.maxKilo
                                    ),
                                  ),
                                ],
                              ) : null,
                            ),
                          );
                        },
                      ),
                ),
                if (_isEditing) ...[
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      // Don't close the bottom sheet here
                      _showAddKiloPriceDialog(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1A0066),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 48),
                    ),
                    child: const Text('Add Price Range'),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  });
}

void _showKiloPriceDeleteConfirmation(BuildContext context, double minKilo, double maxKilo) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Delete Price Range'),
      content: Text('Are you sure you want to delete the ${minKilo}kg - ${maxKilo}kg range?'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () async {
            Navigator.pop(context);
            await _deleteKiloPrice(minKilo, maxKilo);
          },
          child: const Text('Delete', style: TextStyle(color: Colors.red)),
        ),
      ],
    ),
  );
}

void _showEditKiloPriceDialog(BuildContext context, KiloPrice price) {
  minKiloController.text = price.minKilo.toString();
  maxKiloController.text = price.maxKilo.toString();
  pricePerKiloController.text = price.pricePerKilo.toString();

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Edit Price Range'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: minKiloController,
            decoration: const InputDecoration(
              labelText: 'Minimum Kilo',
              border: OutlineInputBorder(),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: maxKiloController,
            decoration: const InputDecoration(
              labelText: 'Maximum Kilo',
              border: OutlineInputBorder(),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: pricePerKiloController,
            decoration: const InputDecoration(
              labelText: 'Price per Kilo',
              prefixText: '₱',
              border: OutlineInputBorder(),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () async {
            await _deleteKiloPrice(price.minKilo, price.maxKilo);
            await _saveKiloPrice();
            if (mounted) Navigator.pop(context);
          },
          child: const Text('Save'),
        ),
      ],
    ),
  );
}

  void _showAddKiloPriceDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Price Range'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: minKiloController,
              decoration: const InputDecoration(
                labelText: 'Minimum Kilo',
                border: OutlineInputBorder(),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: maxKiloController,
              decoration: const InputDecoration(
                labelText: 'Maximum Kilo',
                border: OutlineInputBorder(),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: pricePerKiloController,
              decoration: const InputDecoration(
                labelText: 'Price per Kilo',
                prefixText: '₱',
                border: OutlineInputBorder(),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              await _saveKiloPrice();
              if (mounted) Navigator.pop(context);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
        appBar: AppBar(
          automaticallyImplyLeading: false, 
          backgroundColor: Colors.white,
          elevation: 0,
          title: const Text(
            'SERVICES',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A0066),
            ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.add, color: Color(0xFF1A0066)),
              onPressed: () => _showAddServiceDialog(context),
            ),
          ],
        ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: _isLoading 
            ? const Center(
                child: CircularProgressIndicator(
                  color: Color(0xFF1A0066),
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'YOUR SERVICES',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A0066),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _services.isEmpty
                    ? Center(
                        child: Text(
                          'No services added yet',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 16,
                          ),
                        ),
                      )
                    : Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _services.map((service) {
                          return _buildServiceButton(
                            context,
                            service['service_name'],
                            Color(int.parse(service['color'])),
                            service['id'],
                          );
                        }).toList(),
                      ),
                  const SizedBox(height: 32),
                  const Text(
                    'KILO PRICING',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A0066),
                    ),
                  ),
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: () => _showKiloPricesPopup(context),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: const Color(0xFF1A0066), width: 2),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 6,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Price per Kilo Settings',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1A0066),
                                ),
                              ),
                              Text(
                                '${kiloPrices.length} price ranges set',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                          const Icon(
                            Icons.arrow_forward_ios,
                            color: Color(0xFF1A0066),
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                if (kiloPrices.isNotEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    margin: const EdgeInsets.only(bottom: 16), // Add margin
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF1A0066)),
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
                          'Current Price Ranges',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1A0066),
                          ),
                        ),
                        const SizedBox(height: 8),
                        ...kiloPrices.values.map((price) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${price.minKilo}kg - ${price.maxKilo}kg',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1A0066),
                                ),
                              ),
                              Text(
                                '₱${price.pricePerKilo.toStringAsFixed(2)}/kg',
                                style: const TextStyle(
                                  color: Color(0xFF1A0066),
                                ),
                              ),
                            ],
                          ),
                        )).toList(),
                      ],
                    ),
                  ),
                ],
              ),
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: const Color(0xFF1A0066),
        unselectedItemColor: Colors.grey,
        currentIndex: 2,
        onTap: (index) {
          switch (index) {
            case 0:
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (context) => DashboardScreen(
                    userId: widget.userId,
                    token: widget.token,
                    shopData: widget.shopData,
                  ),
                ),
              );
              break;
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

 Widget _buildServiceButton(BuildContext context, String label, Color color, int serviceId) {
  final service = _services.firstWhere((s) => s['id'] == serviceId);
  
  return GestureDetector(
    onTap: () => _showEditServiceDialog(context, serviceId, label),
    child: Container(
      width: MediaQuery.of(context).size.width * 0.45,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Stack(
        children: [
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                '₱${service['price']?.toStringAsFixed(2) ?? '0.00'}',
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          Positioned(
            top: 0,
            right: 0,
            child: IconButton(
              icon: const Icon(Icons.delete, color: Colors.white),
              onPressed: () => _showDeleteConfirmation(context, serviceId),
            ),
          ),
        ],
      ),
    ),
  );
}

  void _showDeleteConfirmation(BuildContext context, int serviceId) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Delete Service'),
      content: const Text('Are you sure you want to delete this service?'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () async {
            Navigator.pop(context);
            await _deleteService(serviceId);
          },
          child: const Text('Delete', style: TextStyle(color: Colors.red)),
        ),
      ],
    ),
  );
}

  void _showEditServiceDialog(BuildContext context, int serviceId, String currentName) {
  final service = _services.firstWhere((s) => s['id'] == serviceId);
  final nameController = TextEditingController(text: currentName);
  final priceController = TextEditingController(
    text: service['price']?.toString() ?? '0'
  );

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Edit Service'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Service Name',
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.characters,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: priceController,
            decoration: const InputDecoration(
              labelText: 'Service Price',
              prefixText: '₱',
              border: OutlineInputBorder(),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () async {
            if (nameController.text.isNotEmpty && priceController.text.isNotEmpty) {
              await _updateService(
                serviceId, 
                nameController.text,
                double.tryParse(priceController.text) ?? 0
              );
              if (mounted) Navigator.pop(context);
            }
          },
          child: const Text('Save'),
        ),
      ],
    ),
  );
}

  BottomNavigationBarItem _buildNavItem(String label, String iconPath) {
    return BottomNavigationBarItem(
      icon: Image.asset(iconPath, height: 24, color: Colors.grey),
      activeIcon: Image.asset(iconPath, height: 24, color: const Color(0xFF1A0066)),
      label: label,
    );
  }
}