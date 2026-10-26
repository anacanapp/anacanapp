const fs = require('fs');
const crypto = require('crypto');

function parseCSV(text) {
    const rows = [];
    let row = [];
    let inQuotes = false;
    let field = '';
    
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        
        if (inQuotes) {
            if (char === '"' && text[i+1] === '"') {
                field += '"';
                i++; // skip next quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(field);
                field = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && text[i+1] === '\n') i++; // CRLF
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else {
                field += char;
            }
        }
    }
    if (field || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

const csv = fs.readFileSync('c:/Users/camil.sultanli/Desktop/Ana-can/anacanapp/Doktors - Sayfa1.csv', 'utf8');
const data = parseCSV(csv);

let sql = `DELETE FROM healthcare_providers WHERE provider_type = 'doctor';\n\n`;

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.length < 2) continue; // skip empty
    
    const id = crypto.randomUUID();
    const name = (row[0] || '').replace(/'/g, "''");
    const specialty = (row[3] || '').replace(/'/g, "''");
    const phone = (row[4] || '').replace(/'/g, "''");
    const city = (row[5] || '').replace(/'/g, "''");
    const clinic = (row[8] || '').replace(/'/g, "''");
    const address = (row[9] || '').replace(/'/g, "''");
    const exp = row[10] || '';
    const langs = row[11] || '';
    const edu = row[12] || '';
    const edu_m = row[13] || '';
    const interests = row[14] || '';
    const services = row[15] || '';
    const social = (row[16] || '').replace(/'/g, "''");
    const img_webp = row[18] || '';
    const img_png = row[17] || '';
    const img = (img_webp || img_png).replace(/'/g, "''");
    const about = row[20] || '';
    
    let full_address = address;
    if (clinic && address) full_address = `${clinic}, ${address}`;
    else if (clinic) full_address = clinic;

    // construct full description
    let full_desc = about;
    let extra = [];
    if (exp) extra.push(`Təcrübə: ${exp} il`);
    if (langs) extra.push(`Dillər: ${langs.replace(/\|/g, ', ')}`);
    if (edu) extra.push(`Təhsil: ${edu}`);
    if (edu_m) extra.push(`Magistr: ${edu_m}`);
    if (interests) extra.push(`Maraq sahələri: ${interests.replace(/\|/g, ', ')}`);
    if (services) extra.push(`Xidmətlər: ${services.replace(/\|/g, ', ')}`);
    
    if (extra.length > 0) {
        full_desc = extra.join('\\n') + '\\n\\n' + about;
    }
    
    full_desc = full_desc.replace(/'/g, "''");

    sql += `INSERT INTO healthcare_providers (
    id, name, name_az, name_en, specialty, specialty_az, specialty_en, city, provider_type, is_active, website, image_url, description, description_az, description_en, address, address_az, address_en, phone, rating, review_count
) VALUES (
    '${id}', 
    '${name}', 
    '${name}', 
    '${name}', 
    '${specialty}', 
    '${specialty}', 
    '${specialty}', 
    '${city}', 
    'doctor', 
    true, 
    '${social || '#'}', 
    '${img}',
    E'${full_desc.replace(/\n/g, '\\n')}',
    E'${full_desc.replace(/\n/g, '\\n')}',
    E'${full_desc.replace(/\n/g, '\\n')}',
    '${full_address}',
    '${full_address}',
    '${full_address}',
    '${phone}',
    5,
    0
);\n`;
}

const ts = new Date().toISOString().replace(/[-:T.]/g, '').slice(0,14);
const filename = `c:/Users/camil.sultanli/Desktop/Ana-can/anacanapp/supabase/migrations/${ts}_import_new_doctors.sql`;

fs.writeFileSync(filename, sql, 'utf8');
console.log(filename);
