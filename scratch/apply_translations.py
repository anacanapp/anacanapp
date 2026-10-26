import os
import json

workspace_dir = r"c:\Users\camil.sultanli\Desktop\Ana-can\anacanapp"
az_path = os.path.join(workspace_dir, "src", "locales", "az.json")
en_path = os.path.join(workspace_dir, "src", "locales", "en.json")

new_az_keys = {
  "maternitycalculator_normal_hamilelik_fa223b": "Normal hamiləlik",
  "maternitycalculator_agir_dogus_3e1a6b": "Ağır doğuş/Mürəkkəb",
  "maternitycalculator_coxdollu_hamilelik_e3c1aa": "Çoxdöllü hamiləlik",
  "maternitycalculator_title_3c7a2d": "Dekret Kalkulyatoru",
  "maternitycalculator_calculate_3c7a2d": "Hesabla",
  "maternitycalculator_beledci_013a52": "Bələdçi",
  "maternitycalculator_rolunuz": "Rolunuz",
  "maternitycalculator_ana": "Ana",
  "maternitycalculator_ata": "Ata",
  "maternitycalculator_edd_date": "Təxmini Doğuş Tarixi (EDD)",
  "maternitycalculator_ayliq_emek_haqqiniz": "Aylıq əmək haqqınız",
  "maternitycalculator_meselen_800_4effcf": "Məsələn: 800",
  "maternitycalculator_minimum_emek_haqqi_f94050": "Minimum əmək haqqı (",
  "maternitycalculator_azn_esas_goturulecek_5cb1de": "əsas götürüləcək)",
  "maternitycalculator_hamilelik_novu_ace2e8": "Hamiləlik növü",
  "maternitycalculator_cemi_mezuniyyet_93196a": "Cəmi məzuniyyət",
  "maternitycalculator_gun_54e78d": "gün",
  "maternitycalculator_zaman_xetti_visual": "Zaman Xətti",
  "maternitycalculator_paternity_start": "Atalıq məzuniyyətinin başlanğıcı",
  "maternitycalculator_leave_start_date": "Məzuniyyətin Başlanğıcı",
  "maternitycalculator_leave_end_date": "Məzuniyyətin Sonu",
  "maternitycalculator_return_to_work": "İşə Qayıdış Tarixi",
  "maternitycalculator_orta_gunluk_emek_haqqi_39d8be": "Orta günlük əmək haqqı",
  "maternitycalculator_dekret_odenisi_af1939": "Dekret ödənişi",
  "maternitycalculator_dogum_muavineti_22766f": "Doğum müavinəti",
  "maternitycalculator_approximate_note": "Qeyd: Hesablama qanunvericiliyin ümumi şərtlərinə əsaslanır və təxminidir. Real məbləğ stajdan və vergilərdən asılı olaraq dəyişə bilər.",
  "maternitycalculator_elave_melumat_ucun_9e3dfc": "Əlavə məlumat üçün",
  "maternitycalculator_dsmf_qaynar_xetti_d8e628": "DSMF qaynar xətti:",
  "feedinghistorypanel_elave_qida_ac1beb": "Əlavə qida",
  "nutrition_qelyanalti_elave_qida": "Əlavə qida",
  "vitamins_vacib": "Vacib",
  "vitamins_xeta": "Bir xəta oluşdu",
  "fairytale_child_name_placeholder": "Körpənin adı",
  "recipes_category_sorbalar": "Şorbalar",
  "recipes_category_pureler": "Pürelər",
  "recipes_category_esas": "Əsas yeməklər",
  "recipes_category_sirniyyat": "Şirniyyatlar",
  "recipes_category_qelyanalti": "Qəlyanaltılar",
  "photo_generator_foto": "foto"
}

new_en_keys = {
  "maternitycalculator_normal_hamilelik_fa223b": "Normal pregnancy",
  "maternitycalculator_agir_dogus_3e1a6b": "Difficult birth/Complicated",
  "maternitycalculator_coxdollu_hamilelik_e3c1aa": "Multiple pregnancy",
  "maternitycalculator_title_3c7a2d": "Maternity Calculator",
  "maternitycalculator_calculate_3c7a2d": "Calculate",
  "maternitycalculator_beledci_013a52": "Guide",
  "maternitycalculator_rolunuz": "Your Role",
  "maternitycalculator_ana": "Mother",
  "maternitycalculator_ata": "Father",
  "maternitycalculator_edd_date": "Estimated Due Date (EDD)",
  "maternitycalculator_ayliq_emek_haqqiniz": "Monthly salary",
  "maternitycalculator_meselen_800_4effcf": "e.g. 800",
  "maternitycalculator_minimum_emek_haqqi_f94050": "Minimum salary (",
  "maternitycalculator_azn_esas_goturulecek_5cb1de": "will be taken as basis)",
  "maternitycalculator_hamilelik_novu_ace2e8": "Pregnancy type",
  "maternitycalculator_cemi_mezuniyyet_93196a": "Total leave",
  "maternitycalculator_gun_54e78d": "days",
  "maternitycalculator_zaman_xetti_visual": "Timeline",
  "maternitycalculator_paternity_start": "Paternity leave start",
  "maternitycalculator_leave_start_date": "Leave start date",
  "maternitycalculator_leave_end_date": "Leave end date",
  "maternitycalculator_return_to_work": "Return to work date",
  "maternitycalculator_orta_gunluk_emek_haqqi_39d8be": "Average daily salary",
  "maternitycalculator_dekret_odenisi_af1939": "Maternity pay",
  "maternitycalculator_dogum_muavineti_22766f": "Birth allowance",
  "maternitycalculator_approximate_note": "Note: The calculation is based on general legislation and is approximate. The actual amount may vary depending on experience and taxes.",
  "maternitycalculator_elave_melumat_ucun_9e3dfc": "For more information",
  "maternitycalculator_dsmf_qaynar_xetti_d8e628": "DSMF hotline:",
  "feedinghistorypanel_elave_qida_ac1beb": "Solid food",
  "nutrition_qelyanalti_elave_qida": "Solid food",
  "vitamins_vacib": "Essential",
  "vitamins_xeta": "An error occurred",
  "fairytale_child_name_placeholder": "Child name",
  "recipes_category_sorbalar": "Soups",
  "recipes_category_pureler": "Purees",
  "recipes_category_esas": "Main dishes",
  "recipes_category_sirniyyat": "Desserts",
  "recipes_category_qelyanalti": "Snacks",
  "photo_generator_foto": "photos",
  "nutrition_mes_plov_afdcf0": "e.g. Pasta",
  "nutrition_i_stenilen_vaxt_ec15be": "Anytime",
  "dashboard_elave_qida_676032": "Solid Food"
}

def update_locale_file(filepath, new_keys):
    if not os.path.exists(filepath):
        print(f"ERROR: File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    data.update(new_keys)
    sorted_data = {k: data[k] for k in sorted(data.keys())}
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully updated and sorted {os.path.basename(filepath)}")

update_locale_file(az_path, new_az_keys)
update_locale_file(en_path, new_en_keys)
print("All locale files updated.")
