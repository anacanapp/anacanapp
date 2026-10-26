const fs = require('fs');
let c = fs.readFileSync('src/components/admin/AdminVaccines.tsx', 'utf8');

c = c.replace(/\{vaccineDlg &&\s*<div className="space-y-3">/g, '{vaccineDlg && (\\n            <div className="space-y-3">');
c = c.replace(/<ToggleRow label="Aktiv" value=\{\!\!vaccineDlg\.is_active\} onChange=\{\(v\) => setVaccineDlg\(\{ \.\.\.vaccineDlg, is_active: v \}\)\} \/>\r?\n\s*<\/div>\r?\n\s*\}/g, `<ToggleRow label="Aktiv" value={!!vaccineDlg.is_active} onChange={(v) => setVaccineDlg({ ...vaccineDlg, is_active: v })} />\n            </div>\n          )}`);

c = c.replace(/\{scheduleDlg &&\s*<div/g, '{scheduleDlg && (\n            <div');
c = c.replace(/<Field label="Qeyd"><Textarea rows=\{2\} value=\{scheduleDlg\.notes_az \|\| ''\} onChange=\{\(e\) => setScheduleDlg\(\{ \.\.\.scheduleDlg, notes_az: e\.target\.value \}\)\} \/><\/Field>\r?\n\s*<\/div>\r?\n\s*\}/g, `<Field label="Qeyd"><Textarea rows={2} value={scheduleDlg.notes_az || ''} onChange={(e) => setScheduleDlg({ ...scheduleDlg, notes_az: e.target.value })} /></Field>\n            </div>\n          )}`);

// Also for countryDlg if it's broken
c = c.replace(/\{countryDlg &&\s*<div className="space-y-3">/g, '{countryDlg && (\n            <div className="space-y-3">');
c = c.replace(/<ToggleRow label="Default" value=\{\!\!countryDlg\.is_default\} onChange=\{\(v\) => setCountryDlg\(\{ \.\.\.countryDlg, is_default: v \}\)\} \/>\r?\n\s*<\/div>\r?\n\s*\}/g, `<ToggleRow label="Default" value={!!countryDlg.is_default} onChange={(v) => setCountryDlg({ ...countryDlg, is_default: v })} />\n            </div>\n          )}`);


fs.writeFileSync('src/components/admin/AdminVaccines.tsx', c);
console.log('Fixed syntax errors');
