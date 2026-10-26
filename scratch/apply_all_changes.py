import os

# Paths
workspace_dir = r"c:\Users\camil.sultanli\Desktop\Ana-can\anacanapp"
tools_dir = os.path.join(workspace_dir, "src", "components", "tools")

replacements = {
    # 1. BabyGrowthTracker.tsx
    os.path.join(tools_dir, "BabyGrowthTracker.tsx"): [
        (
            'editingEntry ? tr("babygrowthtracker_yenile_570ce2", "Yenilə") : \'Yadda saxla\'',
            'editingEntry ? tr("babygrowthtracker_yenile_570ce2", "Yenilə") : tr("babygrowthtracker_yadda_saxla_3c7a2d", "Yadda saxla")'
        )
    ],
    # 2. BabyNames.tsx
    os.path.join(tools_dir, "BabyNames.tsx"): [
        (
            '{names.length} ad',
            '{names.length} {tr("babynames_ad_count_3c7a2d", "ad")}'
        ),
        (
            '{filteredNames.length} ad',
            '{filteredNames.length} {tr("babynames_ad_count_3c7a2d", "ad")}'
        )
    ],
    # 3. BabyPhotoshoot.tsx
    os.path.join(tools_dir, "BabyPhotoshoot.tsx"): [
        (
            'Pulsuz: ilk {freeLimits.baby_photoshoot_count} foto',
            '{tr("babyphotoshoot_pulsuz_ilk_foto_3c7a2d", "Pulsuz: ilk")} {freeLimits.baby_photoshoot_count} {tr("babyphotoshoot_foto_suffix_3c7a2d", "foto")}'
        )
    ],
    # 4. BloodSugarTracker.tsx
    os.path.join(tools_dir, "BloodSugarTracker.tsx"): [
        (
            'addLogMutation.isPending ? tr("bloodsugartracker_elave_edilir_3c28b4", "Əlavə edilir...") : \'Qeyd et\'',
            'addLogMutation.isPending ? tr("bloodsugartracker_elave_edilir_3c28b4", "Əlavə edilir...") : tr("bloodsugartracker_qeyd_et_3c7a2d", "Qeyd et")'
        )
    ],
    # 5. CryTranslator.tsx
    os.path.join(tools_dir, "CryTranslator.tsx"): [
        (
            'Yeni analiz\n',
            '{tr("crytranslator_yeni_analiz_3c7a2d", "Yeni analiz")}\n'
        ),
        (
            'Yeni analiz</Button>',
            '{tr("crytranslator_yeni_analiz_3c7a2d", "Yeni analiz")}</Button>'
        )
    ],
    # 6. DoctorsHospitals.tsx
    os.path.join(tools_dir, "DoctorsHospitals.tsx"): [
        (
            "clinic: { label: 'Klinika', icon: Building2 },",
            'clinic: { label: tr("doctorshospitals_klinika_3c7a2d", "Klinika"), icon: Building2 },'
        )
    ],
    # 7. FairyTaleGenerator.tsx
    os.path.join(tools_dir, "FairyTaleGenerator.tsx"): [
        (
            "{ value: 'sleeping', label: 'Yatmaq', emoji: '😴' },",
            '{ value: \'sleeping\', label: tr("fairytalegenerator_yatmaq_3c7a2d", "Yatmaq"), emoji: \'😴\' },'
        ),
        (
            "{ value: 'friendship', label: 'Dostluq', emoji: '👫' },",
            '{ value: \'friendship\', label: tr("fairytalegenerator_dostluq_3c7a2d", "Dostluq"), emoji: \'👫\' },'
        ),
        (
            "{ emoji: '🐶', label: 'Bala it' },",
            '{ emoji: \'🐶\', label: tr("fairytalegenerator_bala_it_3c7a2d", "Bala it") },'
        ),
        (
            "{ emoji: '🌟', label: 'Ulduz' },",
            '{ emoji: \'🌟\', label: tr("fairytalegenerator_ulduz_3c7a2d", "Ulduz") },'
        ),
        (
            "{ emoji: '🦅', label: 'Qartal' },",
            '{ emoji: \'🦅\', label: tr("fairytalegenerator_qartal_3c7a2d", "Qartal") },'
        ),
        (
            "{ emoji: '🐿️', label: 'Sincab' },",
            '{ emoji: \'🐿️\', label: tr("fairytalegenerator_sincab_3c7a2d", "Sincab") },'
        ),
        (
            "{ emoji: '🐬', label: 'Delfin' },",
            '{ emoji: \'🐬\', label: tr("fairytalegenerator_delfin_3c7a2d", "Delfin") },'
        ),
        (
            "desc: 'Orta'",
            'desc: tr("fairytalegenerator_orta_3c7a2d", "Orta")'
        ),
        (
            "{ value: '', label: 'Klassik', emoji: '📖' },",
            '{ value: \'\', label: tr("fairytalegenerator_klassik_3c7a2d", "Klassik"), emoji: \'📖\' },'
        ),
        (
            "{ value: 'lullaby', label: 'Laylay', emoji: '🌙' },",
            '{ value: \'lullaby\', label: tr("fairytalegenerator_laylay_3c7a2d", "Laylay"), emoji: \'🌙\' },'
        ),
        (
            '<p className="text-xs text-muted-foreground">Sevimli</p>',
            '<p className="text-xs text-muted-foreground">{tr("fairytalegenerator_sevimli_3c7a2d", "Sevimli")}</p>'
        )
    ],
    # 8. MaternityCalculator.tsx
    os.path.join(tools_dir, "MaternityCalculator.tsx"): [
        (
            'Dekret Kalkulyatoru',
            '{tr("maternitycalculator_title_3c7a2d", "Dekret Kalkulyatoru")}'
        ),
        (
            'Hesabla\n',
            '{tr("maternitycalculator_calculate_3c7a2d", "Hesabla")}\n'
        )
    ],
    # 9. MentalHealthTracker.tsx
    os.path.join(tools_dir, "MentalHealthTracker.tsx"): [
        (
            '<h3 className="font-bold text-foreground">EPDS Testi</h3>',
            '<h3 className="font-bold text-foreground">{tr("mentalhealthtracker_epds_testi_3c7a2d", "EPDS Testi")}</h3>'
        ),
        (
            'Sayt\n',
            '{tr("mentalhealthtracker_sayt_3c7a2d", "Sayt")}\n'
        ),
        (
            "breathingPhase === 'hold' ? 'Saxla' : 'Burax'}",
            'breathingPhase === \'hold\' ? tr("mentalhealthtracker_saxla_3c7a2d", "Saxla") : tr("mentalhealthtracker_burax_3c7a2d", "Burax")}'
        )
    ],
    # 10. MoodDiary.tsx
    os.path.join(tools_dir, "MoodDiary.tsx"): [
        (
            "{ value: 2, emoji: '😔', label: 'Pis', color: 'bg-orange-100 border-orange-300' },",
            '{ value: 2, emoji: \'😔\', label: tr("mooddiary_pis_3c7a2d", "Pis"), color: \'bg-orange-100 border-orange-300\' },'
        ),
        (
            "{ value: 3, emoji: '😐', label: 'Normal', color: 'bg-yellow-100 border-yellow-300' },",
            '{ value: 3, emoji: \'😐\', label: tr("common_normal", "Normal"), color: \'bg-yellow-100 border-yellow-300\' },'
        ),
        (
            'whileTap={{ scale: 0.98 }}>Yadda saxla</motion.button>',
            'whileTap={{ scale: 0.98 }}>{tr("mooddiary_yadda_saxla_3c7a2d", "Yadda saxla")}</motion.button>'
        )
    ],
    # 11. PoopScanner.tsx
    os.path.join(tools_dir, "PoopScanner.tsx"): [
        (
            "black: { label: 'Qara', emoji: '⚫' },",
            'black: { label: tr("poopscanner_qara_3c7a2d", "Qara"), emoji: \'⚫\' },'
        ),
        (
            "default:return 'Normal';",
            'default:return tr("common_normal", "Normal");'
        ),
        (
            "{analysis.isNormal ? 'Normal' : tr(\"poopscanner_diqqet_764567\", \"Diqqət\")}",
            '{analysis.isNormal ? tr("common_normal", "Normal") : tr("poopscanner_diqqet_764567", "Diqqət")}'
        ),
        (
            "{item.is_normal ? 'Normal' : tr(\"poopscanner_diqqet_764567\", \"Diqqət\")}",
            '{item.is_normal ? tr("common_normal", "Normal") : tr("poopscanner_diqqet_764567", "Diqqət")}'
        )
    ],
    # 12. PregnancyAlbum.tsx
    os.path.join(tools_dir, "PregnancyAlbum.tsx"): [
        (
            '<p className="text-xl font-bold">{currentMonth}-ci ay</p>',
            '<p className="text-xl font-bold">{monthLabels[currentMonth - 1]?.label || `${currentMonth}-ci ay`}</p>'
        ),
        (
            '<span className="text-[11px] font-semibold text-muted-foreground">{currentMonth}/6 ay</span>',
            '<span className="text-[11px] font-semibold text-muted-foreground">{currentMonth}/6 {tr("pregnancyalbum_ay_suffix_3c7a2d", "ay")}</span>'
        )
    ],
    # 13. SecondHandMarket.tsx
    os.path.join(tools_dir, "SecondHandMarket.tsx"): [
        (
            "{ id: 'fair', label: 'Normal', color: 'bg-amber-500', textColor: 'text-amber-600' }",
            '{ id: \'fair\', label: tr("common_normal", "Normal"), color: \'bg-amber-500\', textColor: \'text-amber-600\' }'
        ),
        (
            'Yeni elan yarat\n',
            '{tr("secondhandmarket_yeni_elan_yarat_3c7a2d", "Yeni elan yarat")}\n'
        ),
        (
            'Pullu\n',
            '{tr("secondhandmarket_pullu_3c7a2d", "Pullu")}\n'
        )
    ],
    # 14. WeatherClothing.tsx
    os.path.join(tools_dir, "WeatherClothing.tsx"): [
        (
            '{userContext.babyAgeMonths} ay ({userContext.babyAgeDays}',
            '{userContext.babyAgeMonths} {tr("weatherclothing_ay_suffix_3c7a2d", "ay")} ({userContext.babyAgeDays}'
        )
    ],
    # 15. affiliate/AffiliateProductDetail.tsx
    os.path.join(tools_dir, "affiliate", "AffiliateProductDetail.tsx"): [
        (
            "{isSaved ? tr(\"affiliateproductdetail_saxlanildi_66ffe7\", \"Saxlanıldı\") : 'Saxla'}",
            '{isSaved ? tr("affiliateproductdetail_saxlanildi_66ffe7", "Saxlanıldı") : tr("affiliateproductdetail_saxla_3c7a2d", "Saxla")}'
        )
    ]
}

for filepath, changes in replacements.items():
    if not os.path.exists(filepath):
        print(f"ERROR: File does not exist: {filepath}")
        continue
        
    print(f"Processing: {os.path.basename(filepath)}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    modified = content
    for target, replacement in changes:
        if target not in modified:
            target_clean = target.strip()
            rep_clean = replacement.strip()
            if target_clean in modified:
                modified = modified.replace(target_clean, rep_clean)
                print(f"  SUCCESS (relaxed): Replaced successfully")
            else:
                print(f"  ERROR: Could not find target")
        else:
            modified = modified.replace(target, replacement)
            print(f"  SUCCESS: Replaced successfully")
            
    if modified != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(modified)
        print(f"  Saved changes to {os.path.basename(filepath)}")
    else:
        print(f"  No changes made to {os.path.basename(filepath)}")
print("All replacement tasks complete.")
