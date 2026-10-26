/**
 * Ölkəyə görə təcili tibbi yardım nömrələri (dil yox, ÖLKƏ bazlı).
 * Mənbə: rəsmi milli təcili yardım xidmətləri; tapılmayan ölkə üçün 112
 * (beynəlxalq GSM standartı — əksər şəbəkələrdə işləyir).
 */

const EU_112 = [
'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 'CH', 'LI',
'GR', 'CY', 'MT', 'PL', 'CZ', 'SK', 'HU', 'SI', 'HR', 'RO', 'BG',
'EE', 'LV', 'LT', 'FI', 'SE', 'DK', 'NO', 'IS', 'IE', 'MC', 'AD', 'SM'];


const AMBULANCE: Record<string, string> = {
  // Region
  AZ: '103', TR: '112', RU: '103', BY: '103', UA: '103',
  KZ: '103', KG: '103', UZ: '103', TJ: '103', GE: '112', AM: '103', MD: '112',
  // İngilisdilli
  GB: '999', US: '911', CA: '911', AU: '000', NZ: '111',
  // Amerika
  MX: '911', BR: '192', AR: '107', CL: '131', CO: '123', PE: '106',
  // Asiya
  CN: '120', JP: '119', KR: '119', TW: '119', HK: '999', SG: '995',
  MY: '999', TH: '1669', VN: '115', PH: '911', ID: '118', IN: '112',
  PK: '1122', BD: '999', LK: '1990', NP: '102',
  // Yaxın Şərq / Afrika
  IR: '115', IQ: '122', SA: '997', AE: '998', QA: '999', KW: '112',
  BH: '999', OM: '9999', JO: '911', LB: '140', IL: '101',
  EG: '123', MA: '150', TN: '190', ZA: '10177', NG: '112', KE: '999'
};

for (const c of EU_112) AMBULANCE[c] = AMBULANCE[c] || '112';

/** Ölkə koduna görə təcili tibbi yardım nömrəsi (default 112, AZ default 103). */
export function getEmergencyNumber(countryCode?: string | null): string {
  if (!countryCode) return '103'; // köhnə hesablar (ölkə seçilməyib) — AZ bazarı
  return AMBULANCE[countryCode.toUpperCase()] || '112';
}
