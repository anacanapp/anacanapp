// Ported from: src/lib/device-tier.ts
import 'package:anacan/design/device_tier.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('unknown hardware is not low-end', () => expect(isLowEndDevice(const DeviceHardware()), isFalse));
  test('4 cores is low-end', () => expect(isLowEndDevice(const DeviceHardware(cores: 4, memoryGb: 8)), isTrue));
  test('8 cores and 8 GB is not low-end', () => expect(isLowEndDevice(const DeviceHardware(cores: 8, memoryGb: 8)), isFalse));
  test('4 GB RAM is low-end even with many cores', () => expect(isLowEndDevice(const DeviceHardware(cores: 8, memoryGb: 4)), isTrue));
  test('fractional RAM buckets count', () => expect(isLowEndDevice(const DeviceHardware(memoryGb: 0.5)), isTrue));
  test('zero values are ignored like the web check', () => expect(isLowEndDevice(const DeviceHardware(cores: 0, memoryGb: 0)), isFalse));
  test('5 cores and 6 GB is not low-end', () => expect(isLowEndDevice(const DeviceHardware(cores: 5, memoryGb: 6)), isFalse));
}
