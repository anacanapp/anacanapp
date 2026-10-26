const fs = require('fs');
const path = require('path');

const localesPath = path.resolve('src/locales/en.json');
const data = JSON.parse(fs.readFileSync(localesPath, 'utf8'));

const translations = {
  "datepickerwheel_c_ax_6cdba6": "Tue",
  "babymonthlyalbum_legv_et": "Cancel",
  "baby_fun_fact_1": "Your baby learns new things every day!",
  "baby_fun_fact_2": "Love and care help healthy brain development.",
  "baby_fun_fact_3": "Babies recognize their mother's voice before birth.",
  "settingsscreen_delete_confirm_keyword": "DELETE",
  "settingsscreen_silent_hours_desc": "no notifications between",
  "settingsscreen_every_day_at": "Every day at",
  "checkout_place_order": "Place Order",
  "affiliateproducts_search_results": "Search results",
  "firstaid_critical": "CRITICAL",
  "horoscope_share_title": "✨ Family Birth Chart Analysis ✨",
  "horoscope_share_baby": "Baby",
  "horoscope_share_compatibility": "General Compatibility",
  "horoscope_share_footer: ": "Created with Anacan app 💜",
  "safety_added_to_database": "added to database",
  "shopping_item_added": "added!",
  "playbox_cognitive": "Cognitive",
  "playbox_for_you": "For You",
  "vaccine_national_schedule": "National Immunization Schedule",
  "weighttracker_ai_prompt_prefix": "Weight analysis:",
  "weighttracker_ai_prompt_week": "week",
  "weighttracker_ai_prompt_start": "start:",
  "weighttracker_ai_prompt_gain": "gain:",
  "weighttracker_ai_prompt_rec": "recommendation:",
  "weighttracker_ai_prompt_rules": "RULES: 1) No greetings, get straight to the point. 2) Maximum 1-2 sentences. 3) No disclaimers/warnings. 4) Only practical short advice.",
  "toolshub_not_active_yet": "not active yet",
  "toolshub_activate_after_week_prefix": "This tool will activate after",
  "toolshub_activate_after_week_suffix": " weeks",
  "toolshub_not_available": "not available",
  "toolshub_only_maternity_use": "This tool can only be used during pregnancy",
  "toolshub_no_matching_tools": "No matching tools for",
  "useblog_meqalede_istifade_olunur": "is used in articles. Remove it from articles first.",
  "usecommunity_paylasiminizi_beyendi": "liked your post",
  "usedailysummary_ehval": "Mood:",
  "usedailysummary_tepikler": "Kicks:",
  "usefairytales_nagil_yaradila_bilmedi": "Fairy tale could not be created:",
  "usehealthreport_stekan_gun": "glasses/day",
  "usehealthreport_defe_hefte": "times/week",
  "usepartnerconfig_ilk_sevgi": "First Love",
  "usepaywallconfig_illik": "Yearly",
  "usepaywallconfig_premium_illik": "Premium Yearly",
  "usepushnotifications_paylasiminizi_beyendi": "liked your post",
  "useshoppingitems_elave_etdi_siyahini_yoxla": "added. Check the list!",
  "useskillcategories_idrak": "Cognitive",
  "month_jun_short": "Jun",
  "month_jul_short": "Jul"
};

let count = 0;
for (const [key, value] of Object.entries(translations)) {
  if (data[key] !== undefined) {
    data[key] = value;
    count++;
  }
}

fs.writeFileSync(localesPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Updated ${count} keys.`);
