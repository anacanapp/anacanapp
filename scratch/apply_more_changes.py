import os
import re
import json

workspace_dir = r"c:\Users\camil.sultanli\Desktop\Ana-can\anacanapp"
tools_dir = os.path.join(workspace_dir, "src", "components", "tools")

def apply_regex_replace(filepath, pattern_str, replacement_str):
    if not os.path.exists(filepath):
        print(f"ERROR: File not found: {filepath}")
        return False
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    pattern = re.compile(pattern_str)
    if not pattern.search(content):
        print(f"  WARNING: Pattern not found in {os.path.basename(filepath)}")
        return False
        
    modified = pattern.sub(replacement_str, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(modified)
    print(f"  SUCCESS: Applied regex replacement in {os.path.basename(filepath)}")
    return True

# 1. MomFriendlyMap.tsx
apply_regex_replace(
    os.path.join(tools_dir, "MomFriendlyMap.tsx"),
    r'orta reytinq',
    '{tr("momfriendlymap_orta_reytinq_3c7a2d", "orta reytinq")}'
)

# 2. SecondHandMarket.tsx (Categories and Age Ranges)
apply_regex_replace(
    os.path.join(tools_dir, "SecondHandMarket.tsx"),
    r"\{ id: 'furniture', label: 'Mebel',",
    '{ id: \'furniture\', label: tr("secondhandmarket_mebel_3c7a2d", "Mebel"),'
)
apply_regex_replace(
    os.path.join(tools_dir, "SecondHandMarket.tsx"),
    r"\{ id: 'stroller', label: 'Araba',",
    '{ id: \'stroller\', label: tr("secondhandmarket_araba_3c7a2d", "Araba"),'
)
apply_regex_replace(
    os.path.join(tools_dir, "SecondHandMarket.tsx"),
    r"\{ id: 'feeding', label: 'Qidalanma',",
    '{ id: \'feeding\', label: tr("secondhandmarket_qidalanma_3c7a2d", "Qidalanma"),'
)
apply_regex_replace(
    os.path.join(tools_dir, "SecondHandMarket.tsx"),
    r"\{ id: 'hygiene', label: 'Gigiyena',",
    '{ id: \'hygiene\', label: tr("secondhandmarket_gigiyena_3c7a2d", "Gigiyena"),'
)
apply_regex_replace(
    os.path.join(tools_dir, "SecondHandMarket.tsx"),
    r"'0-3 ay', '3-6 ay', '6-12 ay'",
    'tr("secondhandmarket_0_3_ay_3c7a2d", "0-3 ay"), tr("secondhandmarket_3_6_ay_3c7a2d", "3-6 ay"), tr("secondhandmarket_6_12_ay_3c7a2d", "6-12 ay")'
)

# 3. Add to locale files
az_path = os.path.join(workspace_dir, "src", "locales", "az.json")
en_path = os.path.join(workspace_dir, "src", "locales", "en.json")

new_az_keys = {
  "momfriendlymap_orta_reytinq_3c7a2d": "orta reytinq",
  "secondhandmarket_mebel_3c7a2d": "Mebel",
  "secondhandmarket_araba_3c7a2d": "Araba",
  "secondhandmarket_qidalanma_3c7a2d": "Qidalanma",
  "secondhandmarket_gigiyena_3c7a2d": "Gigiyena",
  "secondhandmarket_0_3_ay_3c7a2d": "0-3 ay",
  "secondhandmarket_3_6_ay_3c7a2d": "3-6 ay",
  "secondhandmarket_6_12_ay_3c7a2d": "6-12 ay"
}

new_en_keys = {
  "momfriendlymap_orta_reytinq_3c7a2d": "average rating",
  "secondhandmarket_mebel_3c7a2d": "Furniture",
  "secondhandmarket_araba_3c7a2d": "Stroller",
  "secondhandmarket_qidalanma_3c7a2d": "Feeding",
  "secondhandmarket_gigiyena_3c7a2d": "Hygiene",
  "secondhandmarket_0_3_ay_3c7a2d": "0-3 months",
  "secondhandmarket_3_6_ay_3c7a2d": "3-6 months",
  "secondhandmarket_6_12_ay_3c7a2d": "6-12 months"
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

print("All extra changes applied and locale files updated.")
