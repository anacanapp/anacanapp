import os
import json

workspace_dir = r"c:\Users\camil.sultanli\Desktop\Ana-can\anacanapp"
az_path = os.path.join(workspace_dir, "src", "locales", "az.json")
en_path = os.path.join(workspace_dir, "src", "locales", "en.json")

new_az_keys = {
  "babygrowthtracker_yadda_saxla_3c7a2d": "Yadda saxla",
  "babynames_ad_count_3c7a2d": "ad",
  "babyphotoshoot_pulsuz_ilk_foto_3c7a2d": "Pulsuz: ilk",
  "babyphotoshoot_foto_suffix_3c7a2d": "foto",
  "bloodsugartracker_qeyd_et_3c7a2d": "Qeyd et",
  "crytranslator_yeni_analiz_3c7a2d": "Yeni analiz",
  "doctorshospitals_klinika_3c7a2d": "Klinika",
  "fairytalegenerator_yatmaq_3c7a2d": "Yatmaq",
  "fairytalegenerator_dostluq_3c7a2d": "Dostluq",
  "fairytalegenerator_bala_it_3c7a2d": "Bala it",
  "fairytalegenerator_ulduz_3c7a2d": "Ulduz",
  "fairytalegenerator_qartal_3c7a2d": "Qartal",
  "fairytalegenerator_sincab_3c7a2d": "Sincab",
  "fairytalegenerator_delfin_3c7a2d": "Delfin",
  "fairytalegenerator_orta_3c7a2d": "Orta",
  "fairytalegenerator_klassik_3c7a2d": "Klassik",
  "fairytalegenerator_laylay_3c7a2d": "Laylay",
  "fairytalegenerator_sevimli_3c7a2d": "Sevimli",
  "maternitycalculator_title_3c7a2d": "Dekret Kalkulyatoru",
  "maternitycalculator_calculate_3c7a2d": "Hesabla",
  "mentalhealthtracker_epds_testi_3c7a2d": "EPDS Testi",
  "mentalhealthtracker_sayt_3c7a2d": "Sayt",
  "mentalhealthtracker_saxla_3c7a2d": "Saxla",
  "mentalhealthtracker_burax_3c7a2d": "Burax",
  "mooddiary_pis_3c7a2d": "Pis",
  "mooddiary_yadda_saxla_3c7a2d": "Yadda saxla",
  "poopscanner_qara_3c7a2d": "Qara",
  "pregnancyalbum_ay_suffix_3c7a2d": "ay",
  "secondhandmarket_yeni_elan_yarat_3c7a2d": "Yeni elan yarat",
  "secondhandmarket_pullu_3c7a2d": "Pullu",
  "weatherclothing_ay_suffix_3c7a2d": "ay",
  "affiliateproductdetail_saxla_3c7a2d": "Saxla"
}

new_en_keys = {
  "babygrowthtracker_yadda_saxla_3c7a2d": "Save",
  "babynames_ad_count_3c7a2d": "names",
  "babyphotoshoot_pulsuz_ilk_foto_3c7a2d": "Free: first",
  "babyphotoshoot_foto_suffix_3c7a2d": "photos",
  "bloodsugartracker_qeyd_et_3c7a2d": "Record",
  "crytranslator_yeni_analiz_3c7a2d": "New analysis",
  "doctorshospitals_klinika_3c7a2d": "Clinic",
  "fairytalegenerator_yatmaq_3c7a2d": "Sleeping",
  "fairytalegenerator_dostluq_3c7a2d": "Friendship",
  "fairytalegenerator_bala_it_3c7a2d": "Puppy",
  "fairytalegenerator_ulduz_3c7a2d": "Star",
  "fairytalegenerator_qartal_3c7a2d": "Eagle",
  "fairytalegenerator_sincab_3c7a2d": "Squirrel",
  "fairytalegenerator_delfin_3c7a2d": "Dolphin",
  "fairytalegenerator_orta_3c7a2d": "Medium",
  "fairytalegenerator_klassik_3c7a2d": "Classic",
  "fairytalegenerator_laylay_3c7a2d": "Lullaby",
  "fairytalegenerator_sevimli_3c7a2d": "Favorite",
  "maternitycalculator_title_3c7a2d": "Maternity Calculator",
  "maternitycalculator_calculate_3c7a2d": "Calculate",
  "mentalhealthtracker_epds_testi_3c7a2d": "EPDS Test",
  "mentalhealthtracker_sayt_3c7a2d": "Website",
  "mentalhealthtracker_saxla_3c7a2d": "Hold",
  "mentalhealthtracker_burax_3c7a2d": "Exhale",
  "mooddiary_pis_3c7a2d": "Bad",
  "mooddiary_yadda_saxla_3c7a2d": "Save",
  "poopscanner_qara_3c7a2d": "Black",
  "pregnancyalbum_ay_suffix_3c7a2d": "months",
  "secondhandmarket_yeni_elan_yarat_3c7a2d": "Create New Listing",
  "secondhandmarket_pullu_3c7a2d": "Paid",
  "weatherclothing_ay_suffix_3c7a2d": "months",
  "affiliateproductdetail_saxla_3c7a2d": "Save"
}

def update_locale_file(filepath, new_keys):
    if not os.path.exists(filepath):
        print(f"ERROR: File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # Update keys
    data.update(new_keys)
    
    # Sort keys alphabetically
    sorted_data = {k: data[k] for k in sorted(data.keys())}
    
    with open(filepath, 'w', encoding='utf-8') as f:
        # Use ensure_ascii=False so that characters like 'ə' are written directly as characters
        # instead of '\u0259' escapes
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully updated and sorted {os.path.basename(filepath)}")

update_locale_file(az_path, new_az_keys)
update_locale_file(en_path, new_en_keys)
print("All locale files updated.")
