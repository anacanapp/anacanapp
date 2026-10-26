const fs = require('fs');
const path = require('path');

const replacements = [
  { text: 'Yadda saxla', key: 'untranslated_yadda_saxla_bpdu9v' },
  { text: 'Davam et', key: 'untranslated_davam_et_rchhd5' },
  { text: 'Anacan Endirimi', key: 'untranslated_anacan_endirimi_eg7euj' },
  { text: 'Anacan Partnyor Endirim Sistemi', key: 'untranslated_anacan_partnyor_endirim_sistem_qfwnst' },
  { text: 'Anacan Partnyor Sistemi', key: 'untranslated_anacan_partnyor_sistemi_xadwvm' },
  { text: 'Analiz edilir...', key: 'untranslated_analiz_edilir_hf0m1t' },
  { text: 'Anonim', key: 'untranslated_anonim_89j5l6' },
  { text: 'Axtar...', key: 'untranslated_axtar_92w4nn' },
  { text: 'Bax', key: 'untranslated_bax_1yplss' },
  { text: 'Bilinmir', key: 'untranslated_bilinmir_iqd3o8' },
  { text: 'Cins', key: 'untranslated_cins_f3ymi9' },
  { text: 'Cinsi', key: 'untranslated_cinsi_az7fty' },
  { text: 'Diapazon', key: 'untranslated_diapazon_dgfplg' },
  { text: 'Dil / Language', key: 'untranslated_dil_language_7oaxzb' },
  { text: 'Dil', key: 'untranslated_dil_g90qr5' },
  { text: 'Dil:', key: 'untranslated_dil_rfnolb' },
  { text: 'Elan', key: 'untranslated_elan_voiz8p' },
  { text: 'Emal edilir...', key: 'untranslated_emal_edilir_hf0m1t' },
  { text: 'Endirimi al — QR yarat', key: 'untranslated_endirimi_al_qr_yarat_6yd90i' },
  { text: 'Enerji', key: 'untranslated_enerji_q6zcss' },
  { text: 'Fiziki Albom', key: 'untranslated_fiziki_albom_3i3l4j' },
  { text: 'Fokus Qida', key: 'untranslated_fokus_qida_lyi3h2' },
  { text: 'Geyim', key: 'untranslated_geyim_hftttf' },
  { text: 'Hesablanacaq ↗', key: 'untranslated_hesablanacaq_w6pf63' },
  { text: 'Kalori', key: 'untranslated_kalori_y6oaf2' },
  { text: 'Kamera', key: 'untranslated_kamera_qucuxi' },
  { text: 'Kart sahibi', key: 'untranslated_kart_sahibi_hixmbt' },
  { text: 'Kart sahibi:', key: 'untranslated_kart_sahibi_lpyfn9' },
  { text: 'Kateqoriya', key: 'untranslated_kateqoriya_d7bf4y' },
  { text: 'Kupon endirimi', key: 'untranslated_kupon_endirimi_itwejz' },
  { text: 'Kupon endirimi:', key: 'untranslated_kupon_endirimi_hqg79o' },
  { text: 'Kupon kodu', key: 'untranslated_kupon_kodu_xiawxh' },
  { text: 'Maks', key: 'untranslated_maks_6z8ju8' },
  { text: 'Maksimum 5MB', key: 'untranslated_maksimum_5mb_86tog9' },
  { text: 'Menstruasiya', key: 'untranslated_menstruasiya_6pect0' },
  { text: 'Mesaj', key: 'untranslated_mesaj_3c09op' },
  { text: 'Mesaj:', key: 'untranslated_mesaj_x98xat' },
  { text: 'Mesajlar', key: 'untranslated_mesajlar_ak8wzw' },
  { text: 'Minimum 6 simvol', key: 'untranslated_minimum_6_simvol_nifi5y' },
  { text: 'Onlayn', key: 'untranslated_onlayn_xfaffi' },
  { text: 'Orta Enerji', key: 'untranslated_orta_enerji_ojxdi0' },
  { text: 'Orta Period', key: 'untranslated_orta_period_tvx5me' },
  { text: 'Orta Tsikl', key: 'untranslated_orta_tsikl_vxzcvs' },
  { text: 'Ortalama', key: 'untranslated_ortalama_qxgps6' },
  { text: 'Orta', key: 'untranslated_orta_yslkg0' },
  { text: 'Ovulyasiya', key: 'untranslated_ovulyasiya_h9aw8t' },
  { text: 'Oxunub', key: 'untranslated_oxunub_u7g1tz' },
  { text: 'Partner Profili', key: 'untranslated_partner_profili_lip00f' },
  { text: 'Profil', key: 'untranslated_profil_v8b0sk' },
  { text: 'Proqnoz', key: 'untranslated_proqnoz_rt0tdx' },
  { text: 'Pulsuz', key: 'untranslated_pulsuz_27d02z' },
  { text: 'Qalereyadan', key: 'untranslated_qalereyadan_w37f0m' },
  { text: 'Qeyd', key: 'untranslated_qeyd_z0999u' },
  { text: 'Randevu', key: 'untranslated_randevu_xc37do' },
  { text: 'Resept axtar...', key: 'untranslated_resept_axtar_8odzsd' },
  { text: 'Sakit saatlar', key: 'untranslated_sakit_saatlar_myw4sq' },
  { text: 'Sil', key: 'untranslated_sil_zwa7lz' },
  { text: 'Simptomlar', key: 'untranslated_simptomlar_xhm7bx' },
  { text: 'Son menstruasiya tarixi', key: 'untranslated_son_menstruasiya_tarixi_fgz9t7' },
  { text: 'Son sessiyalar', key: 'untranslated_son_sessiyalar_dkgjsl' },
  { text: 'Story silinsin?', key: 'untranslated_story_silinsin_yil9td' },
  { text: 'Su', key: 'untranslated_su_yvcozn' },
  { text: 'Tarix', key: 'untranslated_tarix_6hhkyx' },
  { text: 'Tarix:', key: 'untranslated_tarix_15qhck' },
  { text: 'Taymer', key: 'untranslated_taymer_uen6sv' },
  { text: 'Telefon', key: 'untranslated_telefon_vwjgg5' },
  { text: 'Telefon:', key: 'untranslated_telefon_ffwqh3' },
  { text: 'Tip:', key: 'untranslated_tip_5d1vhb' },
  { text: 'Toplam Xal', key: 'untranslated_toplam_xal_dy1dwr' },
  { text: 'Toplam', key: 'untranslated_toplam_lheej5' },
  { text: 'Tortlar 🎂', key: 'untranslated_tortlar_go6yj8' },
  { text: 'Variasiya', key: 'untranslated_variasiya_nbjh0m' },
  { text: 'Vaxt', key: 'untranslated_vaxt_8etncj' },
  { text: 'Veb sayt', key: 'untranslated_veb_sayt_16w317' },
  { text: 'Vebsayt', key: 'untranslated_vebsayt_7bupzh' },
  { text: 'AD SOYAD', key: 'untranslated_ad_soyad_by9a9b' },
  { text: 'Ad, Soyad *', key: 'untranslated_ad_soyad_lm5srh' },
  { text: 'Ad:', key: 'untranslated_ad_w3td2c' },
  { text: 'Ad', key: 'untranslated_ad_i34vkg' },
  { text: 'Ana', key: 'untranslated_ana_tubxbv' },
  { text: 'Ay', key: 'untranslated_ay_m6wwbp' },
  { text: 'Bank:', key: 'untranslated_bank_cclvmv' }
];

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('admin') && !file.includes('locales')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let originalContent = content;
  
  // Sort replacements by length descending to match longest first
  const sortedReplacements = [...replacements].sort((a,b) => b.text.length - a.text.length);

  sortedReplacements.forEach(({text, key}) => {
    // Escape string for regex
    const escapedText = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Pattern 1: >text<
    let regex1 = new RegExp(`>\\s*${escapedText}\\s*<`, 'g');
    content = content.replace(regex1, `>{tr("${key}", "${text}")}<`);

    // Pattern 2: placeholder="text"
    let regex2 = new RegExp(`placeholder="${escapedText}"`, 'g');
    content = content.replace(regex2, `placeholder={tr("${key}", "${text}")}`);

    // Pattern 3: label="text"
    let regex3 = new RegExp(`label="${escapedText}"`, 'g');
    content = content.replace(regex3, `label={tr("${key}", "${text}")}`);
    
    // Pattern 4: text as pure string node: e.g. <Label>text</Label> without extra spaces -> handled by Pattern 1 mostly
    // We already handle >text<
  });

  if (content !== originalContent) {
    // If 'tr' isn't imported, add it
    if (!content.includes("import { tr }")) {
      content = "import { tr } from '@/lib/tr';\n" + content;
    }
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated ' + f);
  }
});
