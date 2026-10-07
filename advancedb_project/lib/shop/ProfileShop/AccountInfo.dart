import 'package:flutter/material.dart';
import 'DeleteAcc.dart';

class AdminAccountInfo extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> userData;

  const AdminAccountInfo({
    super.key,
    required this.userId,
    required this.token,
    required this.userData, 
  });

  @override
  State<AdminAccountInfo> createState() => _AccountInfoState();
}

class _AccountInfoState extends State<AdminAccountInfo> {
  late final Map<String, TextEditingController> _controllers;
  late final Map<String, bool> _isEditing;

 @override
  void initState() {
    super.initState();
    print('DEBUG: Received user data: ${widget.userData}');
    
    _controllers = {
      'ID': TextEditingController(text: widget.userData['id']?.toString() ?? ''),
      'Name': TextEditingController(text: widget.userData['name'] ?? ''),
      'Contact Number': TextEditingController(text: widget.userData['contact_number'] ?? widget.userData['phone'] ?? ''),
      'Email Address': TextEditingController(text: widget.userData['email'] ?? ''),
    };

    // Initialize editing state
    _isEditing = Map.fromIterables(
      _controllers.keys,
      List.generate(_controllers.length, (index) => false),
    );
  }

  Future<void> _saveField(String field) async {
    try {
      // TODO: Implement API call to update user data
      setState(() {
        _isEditing[field] = false;
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Changes saved successfully')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save changes')),
      );
    }
  }

  Widget _buildTextField(String label, {bool isEditable = true}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.black87,
            fontFamily: 'Inter',
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controllers[label],
                  enabled: isEditable && _isEditing[label]!,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.black87,
                    fontFamily: 'Inter',
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.all(16),
                    hintStyle: TextStyle(color: Colors.grey[400]),
                  ),
                  onSubmitted: isEditable ? (_) => _saveField(label) : null,
                ),
              ),
              if (isEditable)
                GestureDetector(
                  onTap: () {
                    setState(() {
                      if (_isEditing[label]!) {
                        _saveField(label);
                      } else {
                        _isEditing[label] = true;
                      }
                    });
                  },
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ColorFiltered(
                      colorFilter: ColorFilter.mode(
                        _isEditing[label]! ? const Color(0xFF1A0066) : Colors.grey,
                        BlendMode.srcIn,
                      ),
                      child: Image.asset(
                        _isEditing[label]! 
                            ? 'assets/AccountInfo/Save.png'
                            : 'assets/AccountInfo/Edit.png',
                        width: 24,
                        height: 24,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDocumentItem(String title) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black87,
                fontFamily: 'Inter',
              ),
            ),
          ),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey[300]!),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Account Information',
          style: TextStyle(
            color: Color(0xFF1A0066),
            fontSize: 20,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Account Details',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A0066),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildTextField('ID', isEditable: false),
                  const SizedBox(height: 16),
                  _buildTextField('Name'),
                  const SizedBox(height: 16),
                  _buildTextField('Contact Number'),
                  const SizedBox(height: 16),
                  _buildTextField('Email Address'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Account Credibility',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A0066),
                        ),
                      ),
                      Image.asset(
                        'assets/AccountInfo/Change.png',
                        width: 24,
                        height: 24,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildDocumentItem('Philippine Department of Trade and Industry (DTI)'),
                  _buildDocumentItem('Securities and Exchange Commission (SEC)'),
                  _buildDocumentItem('TIN ID'),
                  _buildDocumentItem("Mayor's Permit"),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Center(
              child: TextButton(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (context) => const ConfirmDeleteDialog(),
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
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _controllers.forEach((_, controller) => controller.dispose());
    super.dispose();
  }
}