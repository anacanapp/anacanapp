const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/tools/SmartPlayBox.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace `${days} günlük`
content = content.replace(/`\$\{days\} günlük`/g, "`${days} ${tr('time_days_old', 'günlük')}`");

// Replace `${months} aylıq`
content = content.replace(/`\$\{months\} aylıq`/g, "`${months} ${tr('time_months_old', 'aylıq')}`");

// Replace `${years} yaş${remainingMonths > 0 ? ` ${remainingMonths} ay` : ''}`
content = content.replace(/`\$\{years\} yaş\$\{remainingMonths > 0 \? ` \$\{remainingMonths\} ay` : ''\}`/g, 
  "`${years} ${tr('time_years_old', 'yaş')}${remainingMonths > 0 ? ` ${remainingMonths} ${tr('time_month', 'ay')}` : ''}`");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed SmartPlayBox templates!');
