/**
 * Faza 2 codemod: user-facing fayllarda hardcoded 'az-AZ' (və dil ternary-ləri)
 * mərkəzi getLocaleTag() çağırışı ilə əvəz edir. Admin ekranları toxunulmur (AZ-only).
 * İşlətmə: node scripts/i18n/localetag-codemod.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Yalnız istifadəçi-üzlü fayllar (admin/* qəsdən yoxdur)
const FILES = [
  'src/components/AIChatScreen.tsx',
  'src/components/chat/ChatMessageBubble.tsx',
  'src/components/Dashboard.tsx',
  'src/components/DoctorReportScreen.tsx',
  'src/components/community/DirectMessageScreen.tsx',
  'src/lib/pdfReport.ts',
  'src/components/HealthSyncScreen.tsx',
  'src/components/LegalScreen.tsx',
  'src/components/MotherChatScreen.tsx',
  'src/components/NotificationsScreen.tsx',
  'src/components/mommy/GrowthTrackerWidget.tsx',
  'src/components/partner/PartnerChatScreen.tsx',
  'src/components/ProfileEditScreen.tsx',
  'src/components/partner/v2/AlertReceiver.tsx',
  'src/components/partner/v2/LiveContractionsScreen.tsx',
  'src/components/partner/v2/NextAppointmentCard.tsx',
  'src/components/partner/v2/PartnerAppointmentsScreen.tsx',
  'src/components/partner/v2/PartnerBabyDayScreen.tsx',
  'src/components/tools/BloodPressureTracker.tsx',
  'src/components/tools/CryTranslator.tsx',
  'src/components/tools/KickCounter.tsx',
  'src/components/tools/MaternityCalculator.tsx',
  'src/components/tools/MomFriendlyMap.tsx',
  'src/components/tools/MoodDiary.tsx',
  'src/components/tools/NoiseMeter.tsx',
  'src/components/tools/PoopScanner.tsx',
  'src/components/tools/VaccineCalendar.tsx',
];

// Sıra vacibdir: əvvəl mürəkkəb ternary-lər, sonra çılpaq literal.
const REPLACEMENTS = [
  [/localStorage\.getItem\('language'\)\s*===\s*'en'\s*\?\s*'en-US'\s*:\s*'az-AZ'/g, 'getLocaleTag()'],
  [/language\s*===\s*'en'\s*\?\s*'en-US'\s*:\s*language\s*===\s*'ru'\s*\?\s*'ru-RU'\s*:\s*language\s*===\s*'tr'\s*\?\s*'tr-TR'\s*:\s*'az-AZ'/g, 'getLocaleTag()'],
  [/language\s*===\s*'en'\s*\?\s*'en-US'\s*:\s*language\s*===\s*'ru'\s*\?\s*'ru-RU'\s*:\s*'az-AZ'/g, 'getLocaleTag()'],
  [/language\s*===\s*'en'\s*\?\s*'en-US'\s*:\s*'az-AZ'/g, 'getLocaleTag()'],
  [/lang\s*===\s*'en'\s*\?\s*'en-US'\s*:\s*'az-AZ'/g, 'getLocaleTag()'],
  [/isAZ\s*\?\s*'az-AZ'\s*:\s*'en-US'/g, 'getLocaleTag()'],
  [/'az-AZ'/g, 'getLocaleTag()'],
];

let totalRepl = 0;
const report = [];

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { report.push(`✗ YOXDUR: ${rel}`); continue; }
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let count = 0;

  for (const [re, to] of REPLACEMENTS) {
    src = src.replace(re, (m) => { count++; return to; });
  }

  if (count === 0) { report.push(`- dəyişiklik yoxdur: ${rel}`); continue; }

  // Import əlavə et (yoxdursa)
  if (!/\bgetLocaleTag\b.*from\s+'@\/lib\/i18n'/.test(src) && !/from\s+'@\/lib\/i18n'.*\bgetLocaleTag\b/.test(src)) {
    if (/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/i18n'/.test(src)) {
      // Mövcud i18n importuna qoş
      src = src.replace(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/i18n'/, (m, names) => {
        if (names.split(',').map(s => s.trim()).includes('getLocaleTag')) return m;
        return `import {${names.replace(/\s*$/, '')}, getLocaleTag } from '@/lib/i18n'`;
      });
    } else {
      // İlk import sətrindən sonra yeni import
      const lines = src.split('\n');
      let idx = lines.findIndex(l => /^import\b/.test(l));
      if (idx === -1) idx = 0; else idx = idx + 1;
      lines.splice(idx, 0, `import { getLocaleTag } from '@/lib/i18n';`);
      src = lines.join('\n');
    }
  }

  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8');
    totalRepl += count;
    report.push(`✓ ${rel} — ${count} əvəzləmə`);
  }
}

console.log(report.join('\n'));
console.log(`\nCƏMİ: ${totalRepl} əvəzləmə`);
