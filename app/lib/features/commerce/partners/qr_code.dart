// Ported from: src/components/partners/RedemptionQRSheet.tsx (`<QRCodeSVG value size={240} level="M"
//              includeMargin={false} />` of qrcode.react)
//
// QR rendering is a seam: no QR package is in pubspec.yaml yet. The default shows the verify link as text in the
// QR box (not scannable); the app root overrides [qrCodeBuilderProvider] once `qr_flutter` is added:
//   qrCodeBuilderProvider.overrideWithValue((context, value, size) =>
//       QrImageView(data: value, size: size, padding: EdgeInsets.zero, errorCorrectionLevel: QrErrorCorrectLevel.M))
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef QrCodeBuilder = Widget Function(BuildContext context, String value, double size);

final qrCodeBuilderProvider = Provider<QrCodeBuilder>(
  (ref) =>
      (context, value, size) => SizedBox(
        key: const ValueKey('qr-fallback'),
        width: size,
        height: size,
        child: Center(
          child: Text(
            value,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Color(0xFF000000)),
          ),
        ),
      ),
);
