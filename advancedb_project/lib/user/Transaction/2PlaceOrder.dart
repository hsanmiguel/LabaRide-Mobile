import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '3ProceedOrder.dart';
import 'Voucher.dart';
import '../OrderingSystem/ordershopsystem.dart';
import '../Location/CurrentLocation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'transaction_service.dart';


class CheckoutScreen extends StatefulWidget {
  final int userId;
  final String token;
  final Service service;
  final Map<String, int> selectedItems;
  final String deliveryOption;
  final String notes;
  final double subtotal;
  final double deliveryFee;
  final double voucherDiscount;
  final Map<String, dynamic> shopData;

  const CheckoutScreen({
    super.key,
    required this.userId,
    required this.token,
    required this.service,
    required this.selectedItems,
    required this.deliveryOption,
    required this.notes,
    required this.subtotal,
    required this.deliveryFee,
    required this.shopData,
    this.voucherDiscount = 0.0,
  });

  @override
  _CheckoutScreenState createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final Color navyBlue = const Color(0xFF1A0066);
  String? preferredDeliveryTime;
  String? preferredDeliveryDate;
  bool isLoading = false;
  String? deliveryAddress;
  String? addressError;
  String? selectedVoucherTitle;
  late double _currentVoucherDiscount;
  late double _currentSubtotal;
  late Service _currentService;
  late Map<String, int> _currentSelectedItems;

  double get total => _currentSubtotal + widget.deliveryFee - _currentVoucherDiscount;

@override
  void initState() {
    super.initState();
    _currentVoucherDiscount = widget.voucherDiscount;
    _currentSubtotal = widget.subtotal;
    _currentService = widget.service;
    _currentSelectedItems = Map<String, int>.from(widget.selectedItems);
    deliveryAddress = 'Home\nZone 4, San Jose, Barangay California USA\nBuilding Name: Orange Dormitel';
  }

Future<void> _placeOrder() async {
  if (!_validateOrder()) return;

  setState(() => isLoading = true);

  try {
    // Create transaction data matching backend schema
    final transactionData = {
      'user_id': widget.userId,
      'shop_id': widget.shopData['id'],
      'service_name': _currentService.title,
      'kilo_amount': _currentService.kiloAmount,
      'subtotal': _currentSubtotal,
      'delivery_fee': widget.deliveryFee,
      'voucher_discount': _currentVoucherDiscount,
      'total_amount': total,
      'delivery_type': widget.deliveryOption,
      'zone': widget.shopData['zone'],
      'street': widget.shopData['street'],
      'barangay': widget.shopData['barangay'],
      'building': widget.shopData['building'],
      'scheduled_date': preferredDeliveryDate,
      'scheduled_time': preferredDeliveryTime,
      'payment_method': 'Cash on Delivery',
      'notes': widget.notes
    };

    final result = await TransactionService.createTransaction(
      userId: widget.userId,
      data: transactionData, 
      token: widget.token,
    );

    if (!mounted) return;

    Navigator.pushReplacement(
      context, 
      MaterialPageRoute(
        builder: (context) => OrderCompleteScreen(
          userId: widget.userId,
          token: widget.token,
          transactionId: result['transaction_id'].toString(),
          transactionData: transactionData,
        ),
      ),
    );
  } catch (e) {
    if (!mounted) return;
    print('Error creating transaction: $e');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error: $e')),
    );
  } finally {
    if (mounted) setState(() => isLoading = false);
  }
}

    Future<void> _updateDeliveryAddress() async {
    try {
      final result = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => CurrentLocation(
            address: deliveryAddress ?? 'Select location',
            userId: widget.userId,
            token: widget.token,
            service: widget.service,
          ),
        ),
      );

      if (result != null) {
        setState(() {
          deliveryAddress = result;
          addressError = null;
        });
      }
    } catch (e) {
      setState(() {
        addressError = 'Failed to update address';
      });
    }
  }

 Future<double> _getPricePerKilo(double kiloAmount) async {
  try {
    final response = await http.get(
      Uri.parse('http://localhost:5000/shop/${widget.shopData['id']}/kilo-prices'),
      headers: {
        'Authorization': 'Bearer ${widget.token}',
        'Content-Type': 'application/json',
      }
    );

    if (response.statusCode == 200) {
      final Map<String, dynamic> responseData = jsonDecode(response.body);
      final List<dynamic> prices = responseData['prices'] as List<dynamic>? ?? [];
      
      // Sort prices by min_kilo to ensure proper range checking
      prices.sort((a, b) => 
        double.parse(a['min_kilo'].toString())
        .compareTo(double.parse(b['min_kilo'].toString()))
      );
      
      // Find the matching price range
      for (var price in prices) {
        try {
          double minKilo = double.parse((price['min_kilo'] ?? 0).toString());
          double maxKilo = double.parse((price['max_kilo'] ?? 0).toString());
          double pricePerKilo = double.parse((price['price_per_kilo'] ?? 0).toString());
          
          if (kiloAmount >= minKilo && kiloAmount <= maxKilo) {
            print('Found price range: ₱$pricePerKilo/kg for ${kiloAmount}kg');
            return pricePerKilo;
          }
        } catch (e) {
          print('Error parsing price range: $e');
          continue;
        }
      }
    }
    
    // If no matching range found or on error, show alert and return default price
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No matching price range found. Using default price.'),
          backgroundColor: Colors.orange,
        ),
      );
    }
    return _currentService.price;
  } catch (e) {
    print('Error getting price per kilo: $e');
    return _currentService.price;
  }
}

  Widget _buildLocationCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.location_on, color: navyBlue),
                    const SizedBox(width: 12),
                    Text(
                      'Delivery Address',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: navyBlue,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.edit, color: Colors.black),
                  onPressed: _updateDeliveryAddress,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (deliveryAddress != null)
              Text(
                deliveryAddress!,
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
              ),
            if (addressError != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  addressError!,
                  style: const TextStyle(color: Colors.red, fontSize: 12),
                ),
              ),
          ],
        ),
      ),
    );
  }

Widget _buildKiloAmountInput() {
  return Card(
    margin: const EdgeInsets.only(top: 16),
    child: Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.scale, color: navyBlue),
              const SizedBox(width: 12),
              Text(
                'Laundry Weight',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: navyBlue,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: _currentService.kiloAmount.toString(),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              hintText: 'Enter weight in kilos',
              suffixText: 'kg',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: navyBlue),
              ),
              helperText: 'Price will be calculated based on weight range',
            ),
            onChanged: (value) async {
              final kiloAmount = double.tryParse(value) ?? 0.0;
              setState(() {
                _currentService.kiloAmount = kiloAmount;
              });
              await _updateSubtotal(); // Update subtotal when weight changes
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter weight';
              }
              final weight = double.tryParse(value);
              if (weight == null || weight <= 0) {
                return 'Please enter valid weight';
              }
              return null;
            },
          ),
        ],
      ),
    ),
  );
}

Future<void> _updateSubtotal() async {
  try {
    final kiloAmount = _currentService.kiloAmount;
    if (kiloAmount <= 0) {
      setState(() {
        _currentSubtotal = 0;
      });
      return;
    }

    final pricePerKilo = await _getPricePerKilo(kiloAmount);
    
    // Calculate subtotal by getting the price range + services
    // Instead of multiplying kg with price, just get the range price
    double serviceTotal = 0.0;
    _currentSelectedItems.forEach((serviceName, quantity) {
      serviceTotal += _currentService.price * quantity;
    });
    
    setState(() {
      // New formula: range price + service total
      _currentSubtotal = pricePerKilo + serviceTotal;
      print('Updated subtotal: ₱${_currentSubtotal.toStringAsFixed(2)} (Range price: ₱$pricePerKilo + Services: ₱$serviceTotal)');
    });
  } catch (e) {
    print('Error updating subtotal: $e');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error calculating price: $e')),
    );
  }
}

    Widget _buildOrderSummaryCard() {
  return Card(
    margin: const EdgeInsets.only(top: 16),
    child: Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.receipt, color: navyBlue),
                  const SizedBox(width: 12),
                  Text(
                    'Order Summary',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: navyBlue,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: Icon(Icons.edit, color: navyBlue),
                onPressed: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => OrderShopSystem(
                        userId: widget.userId,
                        token: widget.token,
                        shopData: widget.shopData,
                        initialService: _currentService,
                        initialItems: _currentSelectedItems,
                      ),
                    ),
                  );
                  
                  if (result != null && mounted) {
                    setState(() {
                      _currentSelectedItems.clear();
                      _currentSelectedItems.addAll(Map<String, int>.from(result['selectedItems']));
                      _currentService = result['service'] as Service;
                      _currentSubtotal = result['subtotal'] as double;
                    });
                  }
                },
              )
            ],
          ),
          const SizedBox(height: 8),
          // Display service name
          Text(
            _currentService.title,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: navyBlue,
            ),
          ),
          const SizedBox(height: 12),
          // Display selected items with quantities
          ..._currentSelectedItems.entries.map((item) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${item.key} x${item.value}',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 14,
                  ),
                ),
                Text(
                  '₱${(_currentService.price * item.value).toStringAsFixed(2)}',
                  style: TextStyle(
                    color: navyBlue,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          )).toList(),
          const Divider(height: 24),
          _buildPriceRow('Subtotal', _currentSubtotal),
          _buildPriceRow('Delivery Fee', widget.deliveryFee),
          _buildPriceRow('Voucher', _currentVoucherDiscount, isDiscount: true),
          const Divider(height: 24),
          _buildPriceRow('Total (incl. vat)', total, isTotal: true),
        ],
      ),
    ),
  );
}

  Widget _buildPriceRow(String label, double amount, {bool isTotal = false, bool isDiscount = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isTotal ? navyBlue : Colors.grey[600],
              fontWeight: isTotal ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          Text(
            isDiscount ? '-₱${amount.toStringAsFixed(2)}' : '₱${amount.toStringAsFixed(2)}',
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: isDiscount ? Colors.green : (isTotal ? navyBlue : navyBlue),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodCard() {
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(Icons.payment, color: navyBlue),
                const SizedBox(width: 12),
                Text(
                  'Payment Method',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: navyBlue,
                  ),
                ),
              ],
            ),
            Text(
              'See all',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: navyBlue,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildDeliveryScheduleCard() {
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.local_shipping, color: navyBlue),
                    const SizedBox(width: 8),
                    Text(
                      'Delivery Schedule',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: navyBlue,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      'Timestamp:',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: navyBlue,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      preferredDeliveryTime ?? '--:--',
                      style: TextStyle(
                        fontSize: 14,
                        color: preferredDeliveryTime == null ? Colors.grey : Colors.black,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      preferredDeliveryDate ?? '--/--/--',
                      style: TextStyle(
                        fontSize: 14,
                        color: preferredDeliveryDate == null ? Colors.grey : Colors.black,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            IconButton(
              icon: Icon(Icons.edit, size: 20, color: navyBlue),
              onPressed: () => _showDeliveryScheduleModal(context),
            ),
          ],
        ),
      ),
    );
  }

Widget _buildVoucherCard() {
  return Card(
    margin: const EdgeInsets.only(top: 16),
    child: Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(Icons.local_offer, color: navyBlue),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Voucher',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: navyBlue,
                    ),
                  ),
                  if (selectedVoucherTitle != null)
                    Text(
                      selectedVoucherTitle!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.green,
                      ),
                    ),
                ],
              ),
            ],
          ),
          TextButton(
            onPressed: () async {
              final result = await Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const VoucherScreen()),
              );
              if (result != null) {
                setState(() {
                  if (result['type'] == 'fixed') {
                    _currentVoucherDiscount = result['amount'];
                  } else if (result['type'] == 'percentage') {
                    _currentVoucherDiscount = widget.subtotal * (result['amount'] / 100);
                  }
                  selectedVoucherTitle = result['title'];
                });
              }
            },
            child: Text(
              selectedVoucherTitle == null ? 'Select' : 'Change',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: navyBlue,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

 bool _validateOrder() {
  bool isValid = true;

  // Validate kilo amount first
  if (_currentService.kiloAmount <= 0) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Please enter valid weight'),
        backgroundColor: Colors.red,
      ),
    );
    isValid = false;
    return isValid; // Return early if weight is invalid
  }

  if (deliveryAddress == null || deliveryAddress!.isEmpty) {
    setState(() => addressError = 'Please add delivery address');
    isValid = false;
  }

  if (preferredDeliveryTime == null || preferredDeliveryDate == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Please select delivery schedule'),
        backgroundColor: Colors.red,
      ),
    );
    isValid = false;
  }
  return isValid;
}

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Total',
                style: TextStyle(fontSize: 14, color: Colors.grey[600]),
              ),
              const SizedBox(height: 4),
              Text(
                '₱${total.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: navyBlue,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '(incl. vat)',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
            ],
          ),
          ElevatedButton(
            onPressed: isLoading ? null : _placeOrder,
            style: ElevatedButton.styleFrom(
              backgroundColor: navyBlue,
              padding: const EdgeInsets.symmetric(
                horizontal: 32.0,
                vertical: 16.0,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8.0),
              ),
            ),
            child: isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text(
                    'Place Order',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

@override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Checkout',
          style: TextStyle(
            color: navyBlue,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
        body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              _buildLocationCard(),
              _buildKiloAmountInput(), // Add this line
              _buildOrderSummaryCard(),
              _buildPaymentMethodCard(),
              _buildDeliveryScheduleCard(),
              _buildVoucherCard(),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

void _showDeliveryScheduleModal(BuildContext context) {
  // Initialize variables with default values
  TimeOfDay now = TimeOfDay.now();
  int selectedHour = now.hour > 12 ? now.hour - 12 : (now.hour == 0 ? 12 : now.hour);
  int selectedMinute = now.minute;
  String selectedPeriod = now.hour >= 12 ? 'PM' : 'AM';
  DateTime selectedDate = DateTime.now();

  if (preferredDeliveryTime != null) {
    try {
      final timeParts = preferredDeliveryTime!.split(' ');
      if (timeParts.length == 2) {
        final hourMinute = timeParts[0].split(':');
        if (hourMinute.length == 2) {
          selectedHour = int.tryParse(hourMinute[0]) ?? selectedHour;
          selectedMinute = int.tryParse(hourMinute[1]) ?? selectedMinute;
          selectedPeriod = timeParts[1].toUpperCase();
        }
      }
    } catch (e) {
      debugPrint('Error parsing delivery time: $e');
    }
  }

  // Parse existing delivery date
  if (preferredDeliveryDate != null) {
    try {
      final parsed = DateTime.parse(preferredDeliveryDate!);
      selectedDate = parsed.isAfter(DateTime.now()) ? parsed : DateTime.now();
    } catch (e) {
      debugPrint('Error parsing delivery date: $e');
    }
  }

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (BuildContext context) {
      return StatefulBuilder(
        builder: (BuildContext context, StateSetter setModalState) {
          // Calculate total hours based on period
          int getTotalHours() {
            if (selectedPeriod == 'PM' && selectedHour != 12) {
              return selectedHour + 12;
            }
            if (selectedPeriod == 'AM' && selectedHour == 12) {
              return 0;
            }
            return selectedHour;
          }

          // valid time check
          bool isValidTime() {
            final selectedDateTime = DateTime(
              selectedDate.year,
              selectedDate.month,
              selectedDate.day,
              getTotalHours(),
              selectedMinute,
            );

            // Check if time is between 4 AM and 11 PM
            final hour = getTotalHours();
            final isValidHour = hour >= 4 && hour <= 23;

            if (!isValidHour) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Please select a time between 4 AM and 11 PM'),
                  backgroundColor: Colors.red,
                ),
              );
              return false;
            }

            // For same day delivery, ensure time is in the future
            if (selectedDate.year == DateTime.now().year &&
                selectedDate.month == DateTime.now().month &&
                selectedDate.day == DateTime.now().day) {
              return selectedDateTime.isAfter(DateTime.now());
            }
            return true;
          }

          
          void handleConfirm() {
          if (!isValidTime()) {
            return;
          }

         
          int hour = selectedHour;
          if (selectedPeriod == 'PM' && selectedHour != 12) {
            hour += 12;
          } else if (selectedPeriod == 'AM' && selectedHour == 12) {
            hour = 0;
          }

          setState(() {
            preferredDeliveryTime = 
              "${hour.toString().padLeft(2, '0')}:${selectedMinute.toString().padLeft(2, '0')}";
            preferredDeliveryDate = DateFormat('yyyy-MM-dd').format(selectedDate);
          });
          Navigator.pop(context);
        }

          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Select Delivery Schedule',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: navyBlue,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  // Time Selection
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      DropdownButton<int>(
                        value: selectedHour,
                        items: List.generate(12, (index) => index + 1).map((hour) {
                          return DropdownMenuItem(
                            value: hour,
                            child: Text(hour.toString().padLeft(2, '0')),
                          );
                        }).toList(),
                        onChanged: (value) {
                          if (value != null) {
                            setModalState(() => selectedHour = value);
                          }
                        },
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text(':'),
                      ),
                      DropdownButton<int>(
                        value: selectedMinute,
                        items: List.generate(60, (index) {
                          return DropdownMenuItem(
                            value: index,
                            child: Text(index.toString().padLeft(2, '0')),
                          );
                        }),
                        onChanged: (value) {
                          if (value != null) {
                            setModalState(() => selectedMinute = value);
                          }
                        },
                      ),
                      const SizedBox(width: 16),
                      DropdownButton<String>(
                        value: selectedPeriod,
                        items: const [
                          DropdownMenuItem(value: 'AM', child: Text('AM')),
                          DropdownMenuItem(value: 'PM', child: Text('PM')),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setModalState(() => selectedPeriod = value);
                          }
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  // Date Selection
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Delivery Date:',
                        style: TextStyle(fontSize: 16),
                      ),
                      TextButton(
                        onPressed: () async {
                          final DateTime? picked = await showDatePicker(
                            context: context,
                            initialDate: selectedDate,
                            firstDate: DateTime.now(),
                            lastDate: DateTime.now().add(const Duration(days: 30)),
                          );
                          if (picked != null && picked != selectedDate) {
                            setModalState(() => selectedDate = picked);
                          }
                        },
                        child: Text(
                          DateFormat('MMM dd, yyyy').format(selectedDate),
                          style: TextStyle(
                            color: navyBlue,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  // Confirm Button
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: navyBlue,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: handleConfirm,
                    child: const Text(
                      'Confirm Schedule',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
  }
}
