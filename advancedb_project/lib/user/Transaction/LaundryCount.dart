import 'package:flutter/material.dart';

class EditLaundriesScreen extends StatefulWidget {
  const EditLaundriesScreen({super.key});

  @override
  _EditLaundriesScreenState createState() => _EditLaundriesScreenState();
}

class _EditLaundriesScreenState extends State<EditLaundriesScreen> {
  Map<String, int> clothingCounts = {
    "Shirts": 0,
    "Pants": 0,
    "Dresses": 0,
    "Jackets": 0,
    "Uniforms": 0,
    "Undergarments": 0,
    "Socks": 0,
  };

  // Map to store the count of each household item
  Map<String, int> householdCounts = {
    "Blankets": 0,
    "Bed sheets": 0,
    "Pillowcases": 0,
    "Curtains": 0,
    "Tablecloths": 0,
  };

  @override
  Widget build(BuildContext context) {
    final Color navyBlue = const Color(0xFF1A0066);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A0066)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Laundries',
          style: TextStyle(
            color: navyBlue,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Types of Clothing Section
            Text(
              'Types of Clothing',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ListView(
                children: [
                  // Clothing Items
                  ...clothingCounts.keys.map((clothingType) {
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16.0,
                          vertical: 12.0,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              clothingType,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: navyBlue,
                              ),
                            ),
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove),
                                  color: navyBlue,
                                  onPressed: () {
                                    setState(() {
                                      if (clothingCounts[clothingType]! > 0) {
                                        clothingCounts[clothingType] =
                                            clothingCounts[clothingType]! - 1;
                                      }
                                    });
                                  },
                                ),
                                Text(
                                  clothingCounts[clothingType].toString(),
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                    color: navyBlue,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add),
                                  color: navyBlue,
                                  onPressed: () {
                                    setState(() {
                                      clothingCounts[clothingType] =
                                          clothingCounts[clothingType]! + 1;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),

                  // Household Items Section
                  const SizedBox(height: 16),
                  Text(
                    'Household Items',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ...householdCounts.keys.map((householdItem) {
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16.0,
                          vertical: 12.0,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              householdItem,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: navyBlue,
                              ),
                            ),
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove),
                                  color: navyBlue,
                                  onPressed: () {
                                    setState(() {
                                      if (householdCounts[householdItem]! > 0) {
                                        householdCounts[householdItem] =
                                            householdCounts[householdItem]! - 1;
                                      }
                                    });
                                  },
                                ),
                                Text(
                                  householdCounts[householdItem].toString(),
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                    color: navyBlue,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add),
                                  color: navyBlue,
                                  onPressed: () {
                                    setState(() {
                                      householdCounts[householdItem] =
                                          householdCounts[householdItem]! + 1;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16.0),
        color: Colors.white,
        child: ElevatedButton(
          onPressed: () {
            // Combine clothing and household counts into one map
            final Map<String, int> selectedItems = {
              ...clothingCounts,
              ...householdCounts,
            };
            Navigator.pop(context, selectedItems); // Pass data back
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: navyBlue,
            padding: const EdgeInsets.symmetric(vertical: 16.0),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8.0),
            ),
          ),
          child: const Text(
            'Confirm',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}