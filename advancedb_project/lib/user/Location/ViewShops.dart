// import 'package:flutter/material.dart';
// import 'package:google_maps_flutter/google_maps_flutter.dart';
// import '../ProfileUser/ProfileScreen.dart';
// import '../OrderingSystem/ordershopsystem.dart';

// class ViewShops extends StatefulWidget {
//   final int userId;
//   final String token;

//   const ViewShops({super.key, required this.userId, required this.token});

//   @override
//   _ViewShopsState createState() => _ViewShopsState();
// }

// class _ViewShopsState extends State<ViewShops> {
//   GoogleMapController? mapController;
//   final TextEditingController _searchController = TextEditingController();

//   static const CameraPosition _initialPosition = CameraPosition(
//     target: LatLng(13.6217, 123.1948),
//     zoom: 15,
//   );

//   final List<Map<String, dynamic>> _shops = [
//     {
//       'id': 'shop1',
//       'name': 'Lavandera Ko',
//       'position': const LatLng(13.6230, 123.1947),
//       'rating': 4.6,
//       'address': 'Ellis Angeles St. Naga City',
//       'isOpen': true,
//       'distance': '0.3km',
//       'shopId': '#123456ABCD',
//       'businessHours': '8:00am - 5:00pm',
//     },
//     {
//       'id': 'shop2',
//       'name': 'Metropolitan Laundry',
//       'position': const LatLng(13.6215, 123.1960),
//       'rating': 4.8,
//       'address': 'Peñafrancia Ave, Naga City',
//       'isOpen': true,
//       'distance': '0.5km',
//       'shopId': '#789012EFGH',
//       'businessHours': '7:00am - 6:00pm',
//     },
//   ];

//   late Set<Marker> _markers;

//   @override
//   void initState() {
//     super.initState();
//     _markers = _shops.map((shop) => _createMarker(shop)).toSet();
//   }

//   Marker _createMarker(Map<String, dynamic> shop) {
//     return Marker(
//       markerId: MarkerId(shop['id']),
//       position: shop['position'],
//       infoWindow: InfoWindow(
//         title: shop['name'],
//         snippet: '${shop['rating']} ★ · ${shop['distance']}',
//       ),
//       icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueViolet),
//       onTap: () => _showShopDetails(shop),
//     );
//   }

//   void _showShopDetails(Map<String, dynamic> shop) {
//     showModalBottomSheet(
//       context: context,
//       backgroundColor: Colors.transparent,
//       builder:
//           (context) => Container(
//             height: MediaQuery.of(context).size.height * 0.4,
//             decoration: const BoxDecoration(
//               color: Colors.white,
//               borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
//             ),
//             child: Padding(
//               padding: const EdgeInsets.all(16.0),
//               child: Column(
//                 crossAxisAlignment: CrossAxisAlignment.start,
//                 children: [
//                   Row(
//                     children: [
//                       Container(
//                         width: 60,
//                         height: 60,
//                         decoration: BoxDecoration(
//                           borderRadius: BorderRadius.circular(8),
//                           image: const DecorationImage(
//                             image: AssetImage('assets/lavanderaakoprfile.png'),
//                             fit: BoxFit.cover,
//                           ),
//                         ),
//                       ),
//                       const SizedBox(width: 12),
//                       Expanded(
//                         child: Column(
//                           crossAxisAlignment: CrossAxisAlignment.start,
//                           children: [
//                             Text(
//                               shop['name'],
//                               style: const TextStyle(
//                                 fontSize: 18,
//                                 fontWeight: FontWeight.bold,
//                               ),
//                             ),
//                             Text(
//                               shop['shopId'],
//                               style: TextStyle(
//                                 fontSize: 14,
//                                 color: Colors.grey[600],
//                               ),
//                             ),
//                             Row(
//                               children: [
//                                 Text(
//                                   '${shop['rating']}',
//                                   style: const TextStyle(
//                                     fontSize: 14,
//                                     fontWeight: FontWeight.w500,
//                                   ),
//                                 ),
//                                 const Icon(
//                                   Icons.star,
//                                   size: 16,
//                                   color: Colors.amber,
//                                 ),
//                                 Text(
//                                   ' · ${shop['distance']}',
//                                   style: const TextStyle(
//                                     fontSize: 14,
//                                     color: Colors.grey,
//                                   ),
//                                 ),
//                               ],
//                             ),
//                           ],
//                         ),
//                       ),
//                     ],
//                   ),
//                   const SizedBox(height: 16),
//                   Text(
//                     shop['address'],
//                     style: const TextStyle(fontSize: 14, color: Colors.grey),
//                   ),
//                   const SizedBox(height: 8),
//                   Row(
//                     children: [
//                       const Icon(
//                         Icons.access_time,
//                         size: 16,
//                         color: Colors.grey,
//                       ),
//                       const SizedBox(width: 4),
//                       Text(
//                         'Business Hours: ${shop['businessHours']}',
//                         style: const TextStyle(
//                           fontSize: 14,
//                           color: Colors.grey,
//                         ),
//                       ),
//                     ],
//                   ),
//                   const Spacer(),
//                   SizedBox(
//                     width: double.infinity,
//                     child: ElevatedButton(
//                       onPressed: () {
//                         Navigator.push(
//                           context,
//                           MaterialPageRoute(
//                             builder:
//                                 (context) => OrderShopSystem(
//                                   userId: widget.userId,
//                                   token: widget.token,
//                                   shopName: shop['name'],
//                                   shopAddress: shop['address'],
//                                   shopRating: shop['rating'],
//                                   businessHours: shop['businessHours'],
//                                   services: [
//                                     {'service_name': 'Wash Only', 'price': 50},
//                                     {'service_name': 'Dry Clean', 'price': 100},
//                                     {
//                                       'service_name': 'Steam Press',
//                                       'price': 75,
//                                     },
//                                     {
//                                       'service_name': 'Full Service',
//                                       'price': 150,
//                                     },
//                                   ], // Replace with actual services if available
//                                 ),
//                           ),
//                         );
//                       },
//                       style: ElevatedButton.styleFrom(
//                         backgroundColor: const Color(0xFF1A0066),
//                         padding: const EdgeInsets.symmetric(vertical: 16),
//                         shape: RoundedRectangleBorder(
//                           borderRadius: BorderRadius.circular(12),
//                         ),
//                       ),
//                       child: const Text(
//                         'View Shop',
//                         style: TextStyle(
//                           fontSize: 16,
//                           fontWeight: FontWeight.w600,
//                           color: Colors.white,
//                         ),
//                       ),
//                     ),
//                   ),
//                 ],
//               ),
//             ),
//           ),
//     );
//   }

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       body: Stack(
//         children: [
//           GoogleMap(
//             initialCameraPosition: _initialPosition,
//             onMapCreated: (GoogleMapController controller) {
//               mapController = controller;
//             },
//             markers: _markers,
//             myLocationEnabled: true,
//             myLocationButtonEnabled: false,
//             zoomControlsEnabled: false,
//           ),
//           SafeArea(
//             child: Column(
//               children: [
//                 Padding(
//                   padding: const EdgeInsets.all(16.0),
//                   child: Row(
//                     children: [
//                       Container(
//                         decoration: BoxDecoration(
//                           color: Colors.white,
//                           borderRadius: BorderRadius.circular(8),
//                           boxShadow: [
//                             BoxShadow(
//                               color: Colors.black.withOpacity(0.1),
//                               blurRadius: 8,
//                               offset: const Offset(0, 2),
//                             ),
//                           ],
//                         ),
//                         child: IconButton(
//                           icon: const Icon(
//                             Icons.arrow_back,
//                             color: Color(0xFF1A0066),
//                           ),
//                           onPressed:
//                               () => Navigator.pushReplacement(
//                                 context,
//                                 MaterialPageRoute(
//                                   builder:
//                                       (context) => ProfileScreen(
//                                         userId: widget.userId,
//                                         token: widget.token,
//                                       ),
//                                 ),
//                               ),
//                         ),
//                       ),
//                       const SizedBox(width: 8),
//                       Expanded(
//                         child: Container(
//                           decoration: BoxDecoration(
//                             color: Colors.white,
//                             borderRadius: BorderRadius.circular(8),
//                             boxShadow: [
//                               BoxShadow(
//                                 color: Colors.black.withOpacity(0.1),
//                                 blurRadius: 8,
//                                 offset: const Offset(0, 2),
//                               ),
//                             ],
//                           ),
//                           child: TextField(
//                             controller: _searchController,
//                             decoration: const InputDecoration(
//                               hintText: 'Search for laundry shops',
//                               prefixIcon: Icon(
//                                 Icons.search,
//                                 color: Color(0xFF1A0066),
//                               ),
//                               border: InputBorder.none,
//                               contentPadding: EdgeInsets.symmetric(
//                                 horizontal: 16,
//                                 vertical: 12,
//                               ),
//                             ),
//                           ),
//                         ),
//                       ),
//                     ],
//                   ),
//                 ),
//               ],
//             ),
//           ),
//           Positioned(
//             right: 16,
//             bottom: 16,
//             child: FloatingActionButton(
//               onPressed: () {
//                 mapController?.animateCamera(
//                   CameraUpdate.newCameraPosition(_initialPosition),
//                 );
//               },
//               backgroundColor: Colors.white,
//               child: const Icon(Icons.my_location, color: Color(0xFF1A0066)),
//             ),
//           ),
//         ],
//       ),
//     );
//   }

//   @override
//   void dispose() {
//     _searchController.dispose();
//     mapController?.dispose();
//     super.dispose();
//   }
// }
