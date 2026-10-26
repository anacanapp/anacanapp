// Zəif cihaz təxmini: ≤4 nüvə və ya ≤4 GB RAM. Dəyər açılış müddətində dəyişmir, bir dəfə hesablanır.
let lowEnd: boolean | undefined;

export function isLowEndDevice(): boolean {
  if (lowEnd !== undefined) return lowEnd;
  if (typeof navigator === 'undefined') return (lowEnd = false);
  const cores = navigator.hardwareConcurrency;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (lowEnd = (typeof cores === 'number' && cores > 0 && cores <= 4) || (typeof memory === 'number' && memory > 0 && memory <= 4));
}
