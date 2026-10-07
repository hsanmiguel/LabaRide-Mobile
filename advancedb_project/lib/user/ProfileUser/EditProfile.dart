import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'ConfirmDelete.dart';
import 'ChangePassword.dart';
import 'AccountDelete.dart';
import 'package:intl/intl.dart';

class EditProfileScreen extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> userData;

  const EditProfileScreen({
    super.key,
    required this.userId,
    required this.token,
    required this.userData,
  });

  @override
  _EditProfileScreenState createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _birthdateController;
  late String _selectedGender;
  bool _isLoading = false;
  
  late Map<String, String> userDetails;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.userData['name']);
    _emailController = TextEditingController(text: widget.userData['email']);
    _phoneController = TextEditingController(text: widget.userData['phone']);
    
    String birthdate = widget.userData['birthdate'] ?? '';
    if (birthdate.isNotEmpty) {
      try {
        String cleanDate = birthdate.split('T')[0];
        DateTime date = DateTime.parse(cleanDate);
        birthdate = DateFormat('MM/dd/yyyy').format(date);
      } catch (e) {
        print('Error formatting birthdate: $e');
        birthdate = '';
      }
    }
    
    _birthdateController = TextEditingController(text: birthdate);
    _selectedGender = widget.userData['gender'] ?? 'Male';

    userDetails = {
      'Name': widget.userData['name'] ?? '',
      'Email': widget.userData['email'] ?? '',
      'Phone': widget.userData['phone'] ?? '',
      'Birthdate': birthdate,
      'Gender': widget.userData['gender'] ?? 'Male',
      'Zone': widget.userData['zone'] ?? '',
      'Street': widget.userData['street'] ?? '',
      'Barangay': widget.userData['barangay'] ?? '',
      'Building': widget.userData['building'] ?? ''
    };
  }

  Future<void> _updateProfile() async {
  if (!_formKey.currentState!.validate()) return;

  setState(() => _isLoading = true);

  try {
    String? backendFormattedDate;
    if (_birthdateController.text.isNotEmpty) {
      try {
        final date = DateFormat('MM/dd/yyyy').parse(_birthdateController.text);
        backendFormattedDate = DateFormat('yyyy-MM-dd').format(date);
      } catch (e) {
        print('Error formatting date: $e');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invalid date format')),
          );
        }
        return;
      }
    }

    final response = await http.put(
      Uri.parse('http://localhost:5000/update_user_details/${widget.userId}'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      },
      body: jsonEncode({
        'name': _nameController.text,
        'email': _emailController.text,
        'phone': _phoneController.text,
        'birthdate': backendFormattedDate,
        'gender': _selectedGender,
        'zone': userDetails['Zone'],
        'street': userDetails['Street'],
        'barangay': userDetails['Barangay'],
        'building': userDetails['Building']
      }),
    );

    if (response.statusCode == 200) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile updated successfully'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, true);
    } else {
      final errorResponse = jsonDecode(response.body);
      throw Exception(errorResponse['message'] ?? 'Failed to update profile');
    }
  } catch (e) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Error updating profile: ${e.toString()}'),
        backgroundColor: Colors.red,
      ),
    );
  } finally {
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }
}

  Future<void> _deleteAccount() async {
    setState(() => _isLoading = true);

    try {
      final response = await http.delete(
        Uri.parse('http://localhost:5000/delete_account/${widget.userId}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(
            builder: (context) => const AccountDeleteScreen(),
          ),
          (route) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to delete account. Please try again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error deleting account: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

    Future<void> _selectDate(BuildContext context) async {
    DateTime initialDate;
    try {
      initialDate = _birthdateController.text.isNotEmpty 
        ? DateFormat('MM/dd/yyyy').parse(_birthdateController.text)
        : DateTime.now();
    } catch (e) {
      print('Error parsing current date: $e');
      initialDate = DateTime.now();
    }

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF000080),
              onPrimary: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null && mounted) {
      setState(() {
        String formattedDate = DateFormat('MM/dd/yyyy').format(picked);
        _birthdateController.text = formattedDate;
        userDetails['Birthdate'] = formattedDate;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Image.asset(
            'assets/backarrowblue.png',
            color: const Color(0xFF000080),
            width: 24,
            height: 24,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Profile',
          style: TextStyle(
            color: Color(0xFF000080),
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildEditButton(
                text: 'Change Photo',
                icon: Image.asset(
                  'assets/profile.png',
                  width: 24,
                  height: 24,
                  color: const Color(0xFF000080),
                ),
                onTap: () {
                  // Photo change functionality
                },
                showDivider: true,
              ),

              ...userDetails.entries.map((entry) => 
                entry.key == 'Birthdate' 
                ? _buildEditField(
                    entry.key, 
                    entry.value,
                    onTap: () => _selectDate(context)
                  )
                : _buildEditField(entry.key, entry.value)
              ),

              const SizedBox(height: 24),
              
              const Text(
                'Binded Accounts',
                style: TextStyle(
                  color: Color(0xFF000080),
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              
              _buildBindedAccount(
                'assets/google.png',
                'Google Chrome',
                'Binded',
              ),
              
              _buildBindedAccount(
                'assets/facebook.png',
                'Facebook',
                'Binded',
              ),
              
              const SizedBox(height: 32),
              
              Center(
                child: TextButton(
                  onPressed: () {
                    Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ChangePasswordScreen(
                        userId: widget.userId,
                        token: widget.token,
                      ),
                    ),
                  );
                },
                  child: const Text(
                    'Change Password',
                    style: TextStyle(
                      color: Color(0xFF000080),
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 16),
              
              Center(
                child: TextButton(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (context) => ConfirmDeleteDialog(
                        onConfirmDelete: () {
                          Navigator.pop(context);
                          _deleteAccount();
                        },
                      ),
                    );
                  },
                  child: const Text(
                    'Delete Account',
                    style: TextStyle(
                      color: Colors.red,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),
              Center(
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _updateProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF000080),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 32,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Save Changes',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEditField(String label, String value, {VoidCallback? onTap}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.grey[200]!),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.black87,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onTap ?? () => _showEditDialog(label, value),
            child: Image.asset(
              'assets/edit.png',
              width: 20,
              height: 20,
              color: const Color(0xFF000080),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditButton({
    required String text,
    required Widget icon,
    required VoidCallback onTap,
    bool showDivider = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: showDivider ? Colors.grey[200]! : Colors.transparent,
            ),
          ),
        ),
        child: Row(
          children: [
            icon,
            const SizedBox(width: 12),
            Text(
              text,
              style: const TextStyle(
                color: Color(0xFF000080),
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            Image.asset(
              'assets/edit.png',
              width: 20,
              height: 20,
              color: const Color(0xFF000080),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBindedAccount(String iconPath, String name, String status) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.grey[200]!),
        ),
      ),
      child: Row(
        children: [
          Image.asset(iconPath, width: 24, height: 24),
          const SizedBox(width: 12),
          Text(
            name,
            style: const TextStyle(
              color: Colors.black87,
              fontSize: 16,
            ),
          ),
          const Spacer(),
          Text(
            status,
            style: const TextStyle(
              color: Color(0xFF000080),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

void _showEditDialog(String field, String currentValue) {
  final TextEditingController controller = TextEditingController(text: currentValue);
  
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(
        'Edit $field',
        style: const TextStyle(color: Color(0xFF000080)),
      ),
      content: field == 'Gender' 
        ? DropdownButtonFormField<String>(
            value: _selectedGender,
            decoration: InputDecoration(
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: Colors.grey[300]!),
              ),
            ),
            items: ['Male', 'Female', 'Other'].map((String value) {
              return DropdownMenuItem<String>(
                value: value,
                child: Text(value),
              );
            }).toList(),
            onChanged: (String? newValue) {
              if (newValue != null) {
                setState(() {
                  _selectedGender = newValue;
                  userDetails['Gender'] = newValue;
                });
                Navigator.pop(context);
              }
            },
          )
        : TextField(
            controller: controller,
            decoration: InputDecoration(
              hintText: 'Enter new ${field.toLowerCase()}',
              focusedBorder: const UnderlineInputBorder(
                borderSide: BorderSide(color: Color(0xFF000080)),
              ),
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: Colors.grey[300]!),
              ),
            ),
          ),
      actions: field == 'Gender' 
        ? []
        : [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Cancel',
                style: TextStyle(color: Colors.grey),
              ),
            ),
            TextButton(
              onPressed: () {
                if (controller.text.isNotEmpty) {
                  setState(() {
                    userDetails[field] = controller.text;
                    switch (field) {
                      case 'Name':
                        _nameController.text = controller.text;
                        break;
                      case 'Email':
                        _emailController.text = controller.text;
                        break;
                      case 'Phone':
                        _phoneController.text = controller.text;
                        break;
                      case 'Birthdate':
                        _birthdateController.text = controller.text;
                        break;
                    }
                  });
                  _updateProfile(); // Call update after editing
                  Navigator.pop(context);
                }
              },
              child: const Text(
                'Save',
                style: TextStyle(color: Color(0xFF000080)),
              ),
            ),
          ],
    ),
  );
}

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _birthdateController.dispose();
    super.dispose();
  }
}