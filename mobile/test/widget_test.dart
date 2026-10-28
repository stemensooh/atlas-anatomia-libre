import 'package:flutter_test/flutter_test.dart';

import 'package:atlas_anatomia_mobile/main.dart';

void main() {
  testWidgets('muestra el visor anatómico', (tester) async {
    await tester.pumpWidget(const AtlasMobileApp());

    expect(find.text('Atlas anatómico · Prueba Flutter'), findsOneWidget);
  });
}
