import 'package:flutter/material.dart';
import './laundryfulldetails.dart';
import '../Transaction/1OrderConfirm.dart';
import '../../loginscreen.dart';

class Service {
  final String title;
  final String description;
  final double price;
  final Color color;
  final Map<String, dynamic> shopData;
  bool isSelected;
  int quantity;
  bool isChecked;
  double kiloAmount;
  double _totalPrice;

  Service({
    required this.title,
    this.description = '',
    required this.price,
    required this.color,
    required this.shopData,
    this.isSelected = false,
    this.quantity = 0,
    this.isChecked = false,
    this.kiloAmount = 0.0,
  }) : _totalPrice = price;

  double get totalPrice => _totalPrice * (kiloAmount > 0 ? kiloAmount : 1);

  void updateTotalPrice() {
    _totalPrice = price;
  }

  void resetAddOns() {
    _totalPrice = price;
    quantity = 0;
    isSelected = false;
    isChecked = false;
    kiloAmount = 0.0;
  }
}

class OrderShopSystem extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;
  final Service? initialService;
  final Map<String, int>? initialItems;

  const OrderShopSystem({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
    this.initialService,
    this.initialItems,
  });

  @override
  State<OrderShopSystem> createState() => _OrderShopSystemState();
}

class _OrderShopSystemState extends State<OrderShopSystem> {
  late Map<String, int> selectedServices;
  double totalPrice = 0.0;
  String deliveryOption = "Deliver";
  bool _isLoading = false;
  List<Service> services = [];

  @override
  void initState() {
    super.initState();
    selectedServices = widget.initialItems?.map(
      (key, value) => MapEntry(key, value),
    ) ?? {};
    _loadServices();
  }

  void _handleCheckboxChanged(Service service, bool value) {
  // Check if user is guest
  if (widget.userId == -1) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const UnifiedLoginScreen(),
      ),
    );
    return;
  }

  setState(() {
    service.isChecked = value;
    service.isSelected = value;
    if (value) {
      selectedServices[service.title] = 1;
      service.quantity = 1;
      if (service.kiloAmount <= 0) {
        service.kiloAmount = 1.0;
      }
    } else {
      selectedServices.remove(service.title);
      service.resetAddOns();
    }
    _updateTotalPrice();
  });
}

  Future<void> _loadServices() async {
  setState(() => _isLoading = true);
  try {
    print("Shop Data received: ${widget.shopData}"); // Debug print

    // Extract services from shop data with null check and type casting
    final List<dynamic> services = widget.shopData['services'] as List<dynamic>? ?? [];
    final List<dynamic> clothingTypes = widget.shopData['clothing_types'] as List<dynamic>? ?? [];
    final List<dynamic> householdItems = widget.shopData['household_items'] as List<dynamic>? ?? [];

    print("Services found: ${services.length}"); // Debug print
    print("Clothing types found: ${clothingTypes.length}"); // Debug print
    print("Household items found: ${householdItems.length}"); // Debug print

    setState(() {
      this.services = services.map((service) => Service(
            title: service['service_name']?.toString() ?? '',
            description: service['description']?.toString() ?? 'No description available',
            price: double.tryParse(service['price']?.toString() ?? '0') ?? 0.0,
            color: Color(int.tryParse(service['color'] ?? '0xFF1A0066') ?? 0xFF1A0066),
            shopData: {
              'id': widget.shopData['id'],
              'clothing_types': clothingTypes,
              'household_items': householdItems,
            },
          )).toList();

      // Restore previous selections if any
      if (widget.initialService != null) {
        for (var service in this.services) {
          if (service.title == widget.initialService!.title) {
            service.isChecked = true;
            service.isSelected = true;
            service.quantity = widget.initialItems?[service.title] ?? 0;
            selectedServices[service.title] = service.quantity;
          }
        }
      }
      _updateTotalPrice();
    });
  } catch (e) {
    print('Error loading services: $e'); //Error Handling
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading services: $e')),
      );
    }
  } finally {
    setState(() => _isLoading = false);
  }
}
  
void _updateTotalPrice() {
  setState(() {
    totalPrice = 0.0;
    for (var service in services.where((s) => s.isChecked)) {
      totalPrice += service.totalPrice; 
    }
  });
}
  
void _onBasketTap() {
  if (widget.userId == -1) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const UnifiedLoginScreen(),
      ),
    );
    return;
  }

  // Existing basket logic for logged in users
  if (selectedServices.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please select at least one service'))
    );
    return;
  }

  final selectedServicesList = services.where((s) => s.isChecked).toList();
  if (selectedServicesList.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please select a service'))
    );
    return;
  }

  Service selectedService = selectedServicesList.first;
  if (widget.initialService != null) {
    Navigator.pop(context, {
      'selectedItems': Map<String, int>.from(selectedServices),
      'service': selectedService,
      'subtotal': totalPrice,
      'deliveryOption': deliveryOption,
      'deliveryFee': deliveryOption == "Deliver" ? 30.0 : 0.0
    });
  } else {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => OrderConfirmScreen(
          userId: widget.userId,
          token: widget.token,
          service: selectedService,
          selectedItems: Map<String, int>.from(selectedServices),
          deliveryOption: deliveryOption,
          notes: '',
          subtotal: totalPrice,
          deliveryFee: deliveryOption == "Deliver" ? 30.0 : 0.0,
          voucherDiscount: 0.0,
          shopData: widget.shopData,
        ),
      ),
    );
  }
}

  void _showDeliveryOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withOpacity(0.5),
      builder: (BuildContext context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: const Icon(
                  Icons.delivery_dining,
                  color: Color(0xFF1A0066),
                ),
                title: const Text(
                  'Deliver',
                  style: TextStyle(
                    color: Color(0xFF1A0066),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                onTap: () {
                  setState(() => deliveryOption = "Deliver");
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(
                  Icons.store,
                  color: Color(0xFF1A0066),
                ),
                title: const Text(
                  'Pickup',
                  style: TextStyle(
                    color: Color(0xFF1A0066),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                onTap: () {
                  setState(() => deliveryOption = "Pickup");
                  Navigator.pop(context);
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }


@override
Widget build(BuildContext context) {
  return Scaffold(
    backgroundColor: Colors.grey[100],
    appBar: PreferredSize(
      preferredSize: const Size.fromHeight(70),
      child: Container(
        padding: const EdgeInsets.only(top: 20),
        decoration: const BoxDecoration(
          color: Color(0xFFE6E6FA), // Lavender background
        ),
        child: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: Padding(
            padding: const EdgeInsets.only(left: 16.0),
            child: Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF1A0066),
              ),
              child: IconButton(
                icon: const Icon(
                  Icons.arrow_back,
                  color: Colors.white,
                  size: 24,
                ),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 16.0, top: 8.0),
              child: Center(
                child: GestureDetector(
                  onTap: () => _showDeliveryOptions(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF1A0066),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(
                          deliveryOption,
                          style: const TextStyle(
                            color: Color(0xFF1A0066),
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Image.asset(
                          'assets/downarrow.png',
                          height: 16,
                          color: const Color(0xFF1A0066),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    body: Column(
      children: [
        Container(
          color: const Color(0xFFE6E6FA),
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => LaundryFullDetails(
                    userId: widget.userId,
                    token: widget.token,
                    shopData: widget.shopData,
                  ),
                ),
              );
            },
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    spreadRadius: 1,
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        image: DecorationImage(
                          image: widget.shopData['image'] != null 
                            ? NetworkImage(widget.shopData['image'])
                            : const AssetImage('assets/lavanderaakoprfile.png') as ImageProvider,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.shopData['shop_name'] ?? 'Shop Name',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A0066),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "ID: ${widget.shopData['id'] ?? 'N/A'}",
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Image.asset('assets/bluecircle.png', height: 16),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  "${widget.shopData['zone'] ?? ''} ${widget.shopData['street'] ?? ''}, ${widget.shopData['barangay'] ?? ''}, ${widget.shopData['building'] ?? ''}",
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.grey[600],
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "Business Hours: ${widget.shopData['opening_time'] ?? '8:00am'} - ${widget.shopData['closing_time'] ?? '5:00pm'}",
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey[600],
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
        ),
        Expanded(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF1A0066),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: services.map((service) => ServiceCard(
                    service: service,
                    onCheckboxChanged: (value) => _handleCheckboxChanged(service, value),
                    onTap: () => _handleCheckboxChanged(service, !service.isChecked),
                  )).toList(),
                ),
        ),
      ],
    ),
    bottomNavigationBar: GestureDetector(
      onTap: _onBasketTap,
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1A0066),
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(20),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Image.asset('assets/basket.png', height: 24),
                    const SizedBox(width: 12),
                    const Text(
                      "Basket",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Image.asset('assets/peso.png', height: 20),
                    Text(
                      " ${totalPrice.toStringAsFixed(2)}",
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
 }
}

// Replace the existing ServiceCard class with this updated version
class ServiceCard extends StatelessWidget {
  final Service service;
  final Function(bool) onCheckboxChanged;
  final VoidCallback onTap;

  const ServiceCard({
    super.key,
    required this.service,
    required this.onCheckboxChanged,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final clothingTypes = service.shopData['clothing_types'] as List? ?? [];
    final householdItems = service.shopData['household_items'] as List? ?? [];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: service.color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      service.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "₱${service.price.toStringAsFixed(2)} per kilo",
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.white70,
                      ),
                    ),
                    if (service.description.isNotEmpty)
                      Text(
                        service.description,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white70,
                        ),
                      ),
                    if (clothingTypes.isNotEmpty || householdItems.isNotEmpty)
                      const SizedBox(height: 8),
                    if (clothingTypes.isNotEmpty)
                      Text(
                        "Available Clothing Types: ${clothingTypes.length}",
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white70,
                        ),
                      ),
                    if (householdItems.isNotEmpty)
                      Text(
                        "Available Household Items: ${householdItems.length}",
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white70,
                        ),
                      ),
                  ],
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: Checkbox(
                  value: service.isChecked,
                  onChanged: (value) => onCheckboxChanged(value ?? false),
                  activeColor: Colors.white,
                  checkColor: service.color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}