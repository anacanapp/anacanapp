import os
import re

# Paths
workspace_dir = r"c:\Users\camil.sultanli\Desktop\Ana-can\anacanapp"
tools_dir = os.path.join(workspace_dir, "src", "components", "tools")

def apply_regex_replace(filepath, pattern_str, replacement_str):
    if not os.path.exists(filepath):
        print(f"ERROR: File not found: {filepath}")
        return False
        
    print(f"Processing: {os.path.basename(filepath)}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    pattern = re.compile(pattern_str)
    if not pattern.search(content):
        print(f"  WARNING: Pattern not found in {os.path.basename(filepath)}")
        return False
        
    modified = pattern.sub(replacement_str, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(modified)
    print(f"  SUCCESS: Applied regex replacement")
    return True

# 1. BabyGrowthTracker.tsx
apply_regex_replace(
    os.path.join(tools_dir, "BabyGrowthTracker.tsx"),
    r'tr\(\s*"babygrowthtracker_yenile_570ce2"[^)]*\)\s*:\s*\'Yadda saxla\'',
    'tr("babygrowthtracker_yenile_570ce2", "Yenilə") : tr("babygrowthtracker_yadda_saxla_3c7a2d", "Yadda saxla")'
)

print("Regex replacement complete.")
