import 'package:flutter/material.dart';
import '../OrderScreen/OrderScreen.dart';
import '../../loginscreen.dart';
import 'Logout.dart';
import 'AccountInfo.dart';
import 'ShopDetails.dart';
import 'Security.dart';
import '../CustomerOrder/CustomerOrder.dart';
import '../ShopDashboard/homescreen.dart';
import '../Services/ServiceScreen1.dart';
import '../../user/ProfileUser/UserProfile.dart';

class ProfileScreenAdmin extends StatefulWidget {
  final int userId;
  final String token;
  final Map<String, dynamic> shopData;
  final VoidCallback onSwitchToUser;

  const ProfileScreenAdmin({
    super.key,
    required this.userId,
    required this.token,
    required this.shopData,
    required this.onSwitchToUser,
  });

  @override
  State<ProfileScreenAdmin> createState() => _ProfileScreenAdminState();
}

class _ProfileScreenAdminState extends State<ProfileScreenAdmin> {
  final Color navyBlue = const Color(0xFF1A0066);

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        widget.onSwitchToUser();
        return false;
      },
      child: Scaffold(
        body: Column(
          children: [
            // Header Section with Shop Info
            Container(
              width: double.infinity,
              color: const Color.fromARGB(255, 90, 18, 103),
              child: Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).padding.top + 20),
                  Text(
                    widget.shopData['shop_name'] ?? 'Your Shop',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.shopData['contact_number'] ?? 'Contact Number',
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Profile Section with curved top
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(top: 20),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(25),
                      ),
                    ),
                    child: _buildProfileInfo(context),
                  ),
                ],
              ),
            ),

            // Menu Items Section
            Expanded(
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _buildMenuItem(
                        'Account Information',
                        'assets/ProfileScreen/Profile.png',
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => AdminAccountInfo(
                              userId: widget.userId,
                              token: widget.token,
                              userData: {
                                'id': widget.shopData['user']?['id'],
                                'name': widget.shopData['user']?['name'],
                                'username': widget.shopData['user']?['username'],
                                'contact_number': widget.shopData['user']?['contact_number'] ?? widget.shopData['user']?['phone'],
                                'email': widget.shopData['user']?['email'],
                              },
                            ),
                          ),
                        ),
                      ),
                      _buildMenuItem(
                      'Shop Details',
                      'assets/ProfileScreen/Shop.png',
                      onTap: () async {
                        final updatedShopData = await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => ShopDetails(
                              userId: widget.userId,
                              token: widget.token,
                              shopData: widget.shopData,
                            ),
                          ),
                        );
                        if (updatedShopData != null) {
                          setState(() {
                            widget.shopData.addAll(updatedShopData);
                          });
                        }
                      },
),
                      _buildMenuItem(
                        'Security',
                        'assets/ProfileScreen/Security.png',
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => Security(
                              userId: widget.userId,
                              token: widget.token,
                              shopData: widget.shopData,
                            ),
                          ),
                        ),
                      ),
                      _buildUserModeButton(),
                      const SizedBox(height: 8),
                      _buildMenuItem(
                        'Logout',
                        'assets/ProfileScreen/Logout.png',
                        isLogout: true,
                        onTap: () => _handleLogout(context),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: _buildBottomNavigationBar(context),
      ),
    );
  }

  Widget _buildProfileInfo(BuildContext context) {
  return Padding(
    padding: const EdgeInsets.all(20),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Left column with shop and user info
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.shopData['shop_name'] ?? 'Your Shop',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: navyBlue,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '#${widget.shopData['id'] ?? ''}',
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.shopData['user']?['name'] ?? 'Shop Owner',
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                ),
              ),
              Text(
                widget.shopData['user']?['email'] ?? 'Email',
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Contact: ${widget.shopData['contact_number'] ?? 'N/A'}',
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
        // Right column with rating and time
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            _buildRating(widget.shopData['rating']?.toString() ?? '0.0'),
            const SizedBox(height: 4),
            _buildShopDetail(
              Icons.access_time,
              '${widget.shopData['opening_time'] ?? '9:00 AM'} - ${widget.shopData['closing_time'] ?? '6:00 PM'}',
              context,
            ),
          ],
        ),
      ],
    ),
  );
}

 Widget _buildUserModeButton() {
  return Container(
    width: double.infinity,
    margin: const EdgeInsets.symmetric(vertical: 8),
    child: GestureDetector(
      onTap: () {
        // Remove the callback and directly navigate
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(
            builder: (context) => ProfileScreen(
              userId: widget.userId,
              token: widget.token,
              isGuest: false,
            ),
          ),
          (route) => false, // This clears the navigation stack
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF375DFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(
              Icons.person_outline,
              color: Colors.white,
              size: 24,
            ),
            SizedBox(width: 12),
            Text(
              'Switch to User Mode',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

  Widget _buildMenuItem(
    String title,
    String iconPath, {
    bool isLogout = false,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        margin: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Image.asset(
              iconPath,
              height: 24,
              color: isLogout ? Colors.red : navyBlue,
            ),
            const SizedBox(width: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: isLogout ? Colors.red : Colors.black87,
              ),
            ),
            const Spacer(),
            if (!isLogout)
              Icon(
                Icons.arrow_forward_ios,
                size: 16,
                color: Colors.grey[400],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildShopDetail(IconData icon, String text, BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Text(
          text,
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildRating(String rating) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.star,
          size: 16,
          color: Colors.amber,
        ),
        const SizedBox(width: 4),
        Text(
          rating,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
      ],
    );
  }

  Future<void> _handleLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) => const LogoutDialog(),
    );

    if (confirmed == true && context.mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (context) => const UnifiedLoginScreen(),
        ),
        (route) => false,
      );
    }
  }

  Widget _buildBottomNavigationBar(BuildContext context) {
    return BottomNavigationBar(
      currentIndex: 4,
      type: BottomNavigationBarType.fixed,
      selectedItemColor: navyBlue,
      unselectedItemColor: Colors.grey,
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
            Navigator.push(
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
          case 2:
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ServiceScreen1(
                  userId: widget.userId,
                  token: widget.token,
                  shopData: widget.shopData,
                ),
              ),
            );
            break;
          case 3:
            Navigator.push(
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
            // Already on profile screen
            break;
        }
      },
      items: _buildNavigationItems(),
    );
  }

  List<BottomNavigationBarItem> _buildNavigationItems() {
  return [
    BottomNavigationBarItem(
      icon: Image.asset(
        'assets/OrderScreenIcon/Home.png',
        height: 24,
        color: Colors.grey,
      ),
      activeIcon: Image.asset(
        'assets/OrderScreenIcon/Home.png',
        height: 24,
        color: navyBlue,
      ),
      label: 'Home',
    ),
    BottomNavigationBarItem(
      icon: Image.asset(
        'assets/OrderScreenIcon/Orders.png',
        height: 24,
        color: Colors.grey,
      ),
      activeIcon: Image.asset(
        'assets/OrderScreenIcon/Orders.png',
        height: 24,
        color: navyBlue,
      ),
      label: 'Orders',
    ),
    BottomNavigationBarItem(
      icon: Image.asset(
        'assets/OrderScreenIcon/Services.png',
        height: 24,
        color: Colors.grey,
      ),
      activeIcon: Image.asset(
        'assets/OrderScreenIcon/Services.png',
        height: 24,
        color: navyBlue,
      ),
      label: 'Services',
    ),
    BottomNavigationBarItem(
      icon: Image.asset(
        'assets/OrderScreenIcon/Customers.png',
        height: 24,
        color: Colors.grey,
      ),
      activeIcon: Image.asset(
        'assets/OrderScreenIcon/Customers.png',
        height: 24,
        color: navyBlue,
      ),
      label: 'Customers',
    ),
    BottomNavigationBarItem(
      icon: Image.asset(
        'assets/OrderScreenIcon/Profile.png',
        height: 24,
        color: Colors.grey,
      ),
      activeIcon: Image.asset(
        'assets/OrderScreenIcon/Profile.png',
        height: 24,
        color: navyBlue,
      ),
      label: 'Profile',
    ),
  ];
 }
}