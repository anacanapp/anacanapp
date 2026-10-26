const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components/mommy/hero');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Add tr import if missing
  if (!content.includes("import { tr } from '@/lib/tr'")) {
    content = content.replace(/(import.*?;[\r\n]+)/, `$1import { tr } from '@/lib/tr';\n`);
  }

  // Replace exactMonths > 0 ? 'ay' : tr(...) with tr('time_month', 'ay')
  content = content.replace(/'ay' : tr\("mommyherominimalcard_gun_54e78d", "gün"\)/g, "tr('time_month', 'ay') : tr('time_day', 'gün')");

  // Replace `${exactMonths} ay${remainingDays > 0 ? ` ${remainingDays} gün` : ''}`
  content = content.replace(/`\$\{exactMonths\} ay\$\{remainingDays > 0 \? ` \$\{remainingDays\} gün` : ''\}`/g, 
    "`${exactMonths} ${tr('time_month', 'ay')}${remainingDays > 0 ? ` ${remainingDays} ${tr('time_day', 'gün')}` : ''}`");

  // Replace `${babyData.ageInDays} günlük`
  content = content.replace(/`\$\{babyData.ageInDays\} günlük`/g, 
    "`${babyData.ageInDays} ${tr('time_days_old', 'günlük')}`");

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Fixed mommy hero templates!');
