const fs = require('fs');
const path = require('path');

const replacements = {
  "src/components/AIChatScreen.tsx": [
    {
      old: "return `Salam${userName}. Mən Anacan.AI. Menstrual tsikl, simptomlar və ümumi sağlamlıq üzrə suallarınıza peşəkar cavab verməyə hazıram.`;",
      new: "return `${tr(\"aichat_welcome_flow_1\", \"Salam\")}${userName}. ${tr(\"aichat_welcome_flow_2\", \"Mən Anacan.AI. Menstrual tsikl, simptomlar və ümumi sağlamlıq üzrə suallarınıza peşəkar cavab verməyə hazıram.\")}`;"
    },
    {
      old: "return `Salam${userName}. Mən Anacan.AI. ${pregnancyData ? \\`Hazırda hamiləliyin ${pregnancyData.currentWeek}-ci həftəsindəsiniz; körpəniz təxminən ${dynamicFruit || pregnancyData.babySize.fruit} böyüklüyündədir. \\` : ''}Hamiləlik dövrü ilə bağlı suallarınızı verə bilərsiniz.`;",
      new: "return `${tr(\"aichat_welcome_bump_1\", \"Salam\")}${userName}. ${tr(\"aichat_welcome_bump_2\", \"Mən Anacan.AI.\")} ${pregnancyData ? tr(\"aichat_welcome_bump_3\", \"Hazırda hamiləliyin {0}-ci həftəsindəsiniz; körpəniz təxminən {1} böyüklüyündədir. \").replace('{0}', pregnancyData.currentWeek).replace('{1}', dynamicFruit || pregnancyData.babySize.fruit) : ''}${tr(\"aichat_welcome_bump_4\", \"Hamiləlik dövrü ilə bağlı suallarınızı verə bilərsiniz.\")}`;"
    },
    {
      old: "return `Salam${userName}. Mən Anacan.AI. Körpə baxımı, əmizdirmə, yuxu rejimi və doğuşdan sonrakı bərpa ilə bağlı suallarınıza dəstək olmağa hazıram.`;",
      new: "return `${tr(\"aichat_welcome_mommy_1\", \"Salam\")}${userName}. ${tr(\"aichat_welcome_mommy_2\", \"Mən Anacan.AI. Körpə baxımı, əmizdirmə, yuxu rejimi və doğuşdan sonrakı bərpa ilə bağlı suallarınıza dəstək olmağa hazıram.\")}`;"
    },
    {
      old: "return `Salam${userName}. Mən Anacan.AI. Sizə necə kömək edə bilərəm?`;",
      new: "return `${tr(\"aichat_welcome_default_1\", \"Salam\")}${userName}. ${tr(\"aichat_welcome_default_2\", \"Mən Anacan.AI. Sizə necə kömək edə bilərəm?\")}`;"
    }
  ],
  "src/components/AuthScreen.tsx": [
    {
      old: "description: `${partnerProfile.name} ilə əlaqələndirildiniz.`",
      new: "description: `${partnerProfile.name} ${tr(\"auth_linked_with\", \"ilə əlaqələndirildiniz.\")}`"
    }
  ],
  "src/components/BirthOnboardingModal.tsx": [
    {
      old: "description: `${babyName} dünyaya xoş gəldi! Analıq səyahətinizə başlayırıq.`",
      new: "description: `${babyName} ${tr(\"birth_welcome_world\", \"dünyaya xoş gəldi! Analıq səyahətinizə başlayırıq.\")}`"
    }
  ],
  "src/components/cakes/CakeOrderForm.tsx": [
    {
      old: "notes: `${formData.notes || ''} [${paymentLabel} ödəniş]`.trim(),",
      new: "notes: `${formData.notes || ''} [${paymentLabel} ${tr(\"cake_payment\", \"ödəniş\")} ]`.trim(),"
    },
    {
      old: "{paymentMethod === 'card_simulated' ? `Ödə və sifariş ver` :",
      new: "{paymentMethod === 'card_simulated' ? tr(\"cake_pay_and_order\", \"Ödə və sifariş ver\") :"
    },
    {
      old: "paymentMethod === 'c2c_transfer' ? `Sifarişi təsdiqlə` :",
      new: "paymentMethod === 'c2c_transfer' ? tr(\"cake_confirm_order\", \"Sifarişi təsdiqlə\") :"
    },
    {
      old: "`Sifariş göndər`} — {totalPrice.toFixed(2)}₼",
      new: "tr(\"cake_send_order\", \"Sifariş göndər\")} — {totalPrice.toFixed(2)}₼"
    }
  ],
  "src/components/community/CommentReply.tsx": [
    {
      old: "{comment.author?.name?.charAt(0) || 'İ'}",
      new: "{comment.author?.name?.charAt(0) || tr(\"common_initial_i\", \"İ\")}"
    }
  ],
  "src/components/community/CreatePostModal.tsx": [
    {
      old: "if (error) throw new Error(`Fayl yüklənə bilmədi: ${error.message}`);",
      new: "if (error) throw new Error(`${tr(\"community_file_upload_failed\", \"Fayl yüklənə bilmədi:\")} ${error.message}`);"
    }
  ],
  "src/components/community/CreatePostScreen.tsx": [
    {
      old: "if (error) throw new Error(`Fayl yüklənə bilmədi: ${error.message}`);",
      new: "if (error) throw new Error(`${tr(\"community_file_upload_failed\", \"Fayl yüklənə bilmədi:\")} ${error.message}`);"
    }
  ],
  "src/components/community/GroupPresenceBar.tsx": [
    {
      old: "{typingUsers.length === 1 ? `${typingUsers[0].name} yazır...` : `${typingUsers.length} nəfər yazır...`}",
      new: "{typingUsers.length === 1 ? `${typingUsers[0].name} ${tr(\"community_is_typing\", \"yazır...\")}` : `${typingUsers.length} ${tr(\"community_people_are_typing\", \"nəfər yazır...\")}`}"
    }
  ],
  "src/components/community/PostCard.tsx": [
    {
      old: "text-xs\">{post.author?.name?.charAt(0) || 'İ'}</AvatarFallback>",
      new: "text-xs\">{post.author?.name?.charAt(0) || tr(\"common_initial_i\", \"İ\")}</AvatarFallback>"
    }
  ],
  "src/components/community/UserProfileScreen.tsx": [
    {
      old: "{profile.name?.charAt(0) || 'İ'}",
      new: "{profile.name?.charAt(0) || tr(\"common_initial_i\", \"İ\")}"
    }
  ],
  "src/components/Dashboard.tsx": [
    {
      old: "description: `Bu gün ${kickCount + 1} təpik`",
      new: "description: `${tr(\"dashboard_today\", \"Bu gün\")} ${kickCount + 1} ${tr(\"dashboard_kick\", \"təpik\")}`"
    },
    {
      old: "description: `${waterCount + 1}/8 stəkan`",
      new: "description: `${waterCount + 1}/8 ${tr(\"dashboard_glasses\", \"stəkan\")}`"
    },
    {
      old: "alt={`${selectedWeek} həftəlik körpə`}",
      new: "alt={`${selectedWeek} ${tr(\"dashboard_week_baby\", \"həftəlik körpə\")}`}"
    },
    {
      old: "toast({ title: \"Yuxu bitdi! ☀️\", description: `${formatDuration(result.durationSeconds)} yatdı` });",
      new: "toast({ title: tr(\"dashboard_sleep_ended\", \"Yuxu bitdi! ☀️\"), description: `${formatDuration(result.durationSeconds)} ${tr(\"dashboard_slept\", \"yatdı\")}` });"
    },
    {
      old: "description: `Müddət: ${formatDuration(result.durationSeconds)}`",
      new: "description: `${tr(\"dashboard_duration\", \"Müddət:\")} ${formatDuration(result.durationSeconds)}`"
    },
    {
      old: "toast({ title: `Bez dəyişmə: ${typeEmojis[type]}` });",
      new: "toast({ title: `${tr(\"dashboard_diaper_change\", \"Bez dəyişmə:\")} ${typeEmojis[type]}` });"
    },
    {
      old: "if (h === 0) return `${m} dəq`;",
      new: "if (h === 0) return `${m} ${tr(\"dashboard_min\", \"dəq\")}`;"
    },
    {
      old: "return `${h} saat ${m} dəq`;",
      new: "return `${h} ${tr(\"dashboard_hour\", \"saat\")} ${m} ${tr(\"dashboard_min\", \"dəq\")}`;"
    },
    {
      old: "const durText = dH > 0 ? `${dH}s ${dM}d` : dM > 0 ? `${dM} dəq ${dS} san` : `${dS} san`;",
      new: "const durText = dH > 0 ? `${dH}${tr(\"dashboard_h\", \"s\")} ${dM}${tr(\"dashboard_m\", \"d\")}` : dM > 0 ? `${dM} ${tr(\"dashboard_min\", \"dəq\")} ${dS} ${tr(\"dashboard_sec\", \"san\")}` : `${dS} ${tr(\"dashboard_sec\", \"san\")}`;"
    }
  ],
  "src/components/flow/CycleAnomalyBanner.tsx": [
    {
      old: "message: `Ən qısa tsikliniz ${stats.shortestCycle} gündür. 21 gündən az tsikllər həkim müraciəti tələb edə bilər.`",
      new: "message: `${tr(\"flow_shortest_cycle\", \"Ən qısa tsikliniz\")} ${stats.shortestCycle} ${tr(\"flow_days\", \"gündür.\")} ${tr(\"flow_short_cycle_warn\", \"21 gündən az tsikllər həkim müraciəti tələb edə bilər.\")}`"
    },
    {
      old: "message: `Ən uzun tsikliniz ${stats.longestCycle} gündür. 35 gündən uzun tsikllər PCOS və ya hormonal disbalans əlaməti ola bilər.`",
      new: "message: `${tr(\"flow_longest_cycle\", \"Ən uzun tsikliniz\")} ${stats.longestCycle} ${tr(\"flow_days\", \"gündür.\")} ${tr(\"flow_long_cycle_warn\", \"35 gündən uzun tsikllər PCOS və ya hormonal disbalans əlaməti ola bilər.\")}`"
    },
    {
      old: "message: `Tsikllər arasında ${stats.cycleVariation} gün fərq var. Bu stress, çəki dəyişikliyi və ya tireoid problemlərlə bağlı ola bilər.`",
      new: "message: `${tr(\"flow_cycle_diff\", \"Tsikllər arasında\")} ${stats.cycleVariation} ${tr(\"flow_cycle_diff_2\", \"gün fərq var. Bu stress, çəki dəyişikliyi və ya tireoid problemlərlə bağlı ola bilər.\")}`"
    }
  ],
  "src/components/flow/PeriodDelayBanner.tsx": [
    {
      old: "message: `Periodunuz təxmini tarixdən ${delayDays} gün gecikir. Hamiləlik testi etməyi və ya Dr. Anacan-dan soruşmağı düşünün.`,",
      new: "message: `${tr(\"flow_period_delay_1\", \"Periodunuz təxmini tarixdən\")} ${delayDays} ${tr(\"flow_period_delay_2\", \"gün gecikir. Hamiləlik testi etməyi və ya Dr. Anacan-dan soruşmağı düşünün.\")}`,"
    },
    {
      old: "onClick={() => navigate(`/ai-chat?prompt=${encodeURIComponent(`Periodum ${delayDays} gün gecikib, nə edə bilərəm?`)}`)}",
      new: "onClick={() => navigate(`/ai-chat?prompt=${encodeURIComponent(`${tr(\"flow_period_delay_prompt_1\", \"Periodum\")} ${delayDays} ${tr(\"flow_period_delay_prompt_2\", \"gün gecikib, nə edə bilərəm?\")}`)}`)}"
    }
  ],
  "src/components/funnel/funnelData.ts": [
    {
      old: "lines.push(`${name}, ${week}-ci həftədə olan hamilə qadınların 78%-i müəyyən narahatlıqlar yaşayır.`);",
      new: "lines.push(`${name}, ${week}${tr(\"funnel_week_stats\", \"-ci həftədə olan hamilə qadınların 78%-i müəyyən narahatlıqlar yaşayır.\")}`);"
    },
    {
      old: "lines.push(`${name}, ${ageMonths} aylıq körpəsi olan anaların 82%-i oxşar çətinliklərlə üzləşir.`);",
      new: "lines.push(`${name}, ${ageMonths} ${tr(\"funnel_month_stats\", \"aylıq körpəsi olan anaların 82%-i oxşar çətinliklərlə üzləşir.\")}`);"
    },
    {
      old: "lines.push(`${name}, ${cycleLen} günlük tsiklinizə əsasən fərdi təhlil hazırladıq.`);",
      new: "lines.push(`${name}, ${cycleLen} ${tr(\"funnel_cycle_stats\", \"günlük tsiklinizə əsasən fərdi təhlil hazırladıq.\")}`);"
    }
  ],
  "src/components/funnel/steps/AnalysisStep.tsx": [
    {
      old: "contextLine: string; // e.g. \"24-cü həftə, 2-ci trimester\"",
      new: "contextLine: string; // e.g. \"24-cü həftə, 2-ci trimester\""
    }
  ],
  "src/components/funnel/steps/PaywallStep.tsx": [
    {
      old: "yearlyTrialDays ? `${yearlyTrialDays} gün pulsuz sınayın · Sonra ${yearlyPriceStr}/il · İstənilən vaxt ləğv edin` : `${yearlyPriceStr}/il · İstənilən vaxt ləğv edin` :",
      new: "yearlyTrialDays ? `${yearlyTrialDays} ${tr(\"paywall_trial_days\", \"gün pulsuz sınayın · Sonra\")} ${yearlyPriceStr}${tr(\"paywall_per_year\", \"/il\")} · ${tr(\"paywall_cancel_anytime\", \"İstənilən vaxt ləğv edin\")}` : `${yearlyPriceStr}${tr(\"paywall_per_year\", \"/il\")} · ${tr(\"paywall_cancel_anytime\", \"İstənilən vaxt ləğv edin\")}` :"
    },
    {
      old: "monthlyTrialDays ? `${monthlyTrialDays} gün pulsuz sınayın · Sonra ${monthlyPriceStr}/ay · İstənilən vaxt ləğv edin` : `${monthlyPriceStr}/ay · İstənilən vaxt ləğv edin`}",
      new: "monthlyTrialDays ? `${monthlyTrialDays} ${tr(\"paywall_trial_days\", \"gün pulsuz sınayın · Sonra\")} ${monthlyPriceStr}${tr(\"paywall_per_month\", \"/ay\")} · ${tr(\"paywall_cancel_anytime\", \"İstənilən vaxt ləğv edin\")}` : `${monthlyPriceStr}${tr(\"paywall_per_month\", \"/ay\")} · ${tr(\"paywall_cancel_anytime\", \"İstənilən vaxt ləğv edin\")}`}"
    }
  ],
  "src/components/MedicalDisclaimer.tsx": [
    {
      old: "'Bu məlumat yalnız maarifləndirmə məqsədi daşıyır və tibbi məsləhət, diaqnoz və ya müalicə əvəzi DEYİL. Hər hansı tibbi qərar verməzdən əvvəl mütləq həkiminizə və ya ixtisaslı tibb işçisinə müraciət edin. Təcili hallarda 103-ə zəng edin.'",
      new: "tr(\"medical_disclaimer_text\", 'Bu məlumat yalnız maarifləndirmə məqsədi daşıyır və tibbi məsləhət, diaqnoz və ya müalicə əvəzi DEYİL. Hər hansı tibbi qərar verməzdən əvvəl mütləq həkiminizə və ya ixtisaslı tibb işçisinə müraciət edin. Təcili hallarda 103-ə zəng edin.')"
    }
  ],
  "src/components/partner/PartnerHeroCard.tsx": [
    {
      old: "if (lifeStage === 'bump' && currentWeek > 0) return `Hamiləlik: ${currentWeek}. həftə`;",
      new: "if (lifeStage === 'bump' && currentWeek > 0) return `${tr(\"partner_pregnancy_week\", \"Hamiləlik:\")} ${currentWeek}. ${tr(\"partner_week\", \"həftə\")}`;"
    }
  ],
  "src/components/partner/PartnerMissionsCard.tsx": [
    {
      old: "title: `+${result.pointsEarned} xal qazandın! 🎉`,",
      new: "title: `+${result.pointsEarned} ${tr(\"partner_points_earned\", \"xal qazandın! 🎉\")}`,"
    }
  ],
  "src/components/partner/SurpriseTab.tsx": [
    {
      old: "content: `🎁 Həyat yoldaşın sənin üçün xüsusi bir sürpriz planladı!`",
      new: "content: tr(\"partner_surprise_planned\", `🎁 Həyat yoldaşın sənin üçün xüsusi bir sürpriz planladı!`)"
    },
    {
      old: "content: `${emoji} Həyat yoldaşın \"${title}\" sürprizini sənin üçün tamamladı! 🎉`",
      new: "content: `${emoji} ${tr(\"partner_surprise_completed_1\", \"Həyat yoldaşın\")} \"${title}\" ${tr(\"partner_surprise_completed_2\", \"sürprizini sənin üçün tamamladı! 🎉\")}`"
    },
    {
      old: "title: `+${points} xal qazandın! 🏆`,",
      new: "title: `+${points} ${tr(\"partner_points_earned_2\", \"xal qazandın! 🏆\")}`,"
    },
    {
      old: "description: `${title} tamamlandı!`",
      new: "description: `${title} ${tr(\"partner_surprise_done\", \"tamamlandı!\")}`"
    }
  ],
  "src/components/partner/SyncedFeaturesGrid.tsx": [
    {
      old: "subtitle: `${checkedCount}/${totalCount} hazır`,",
      new: "subtitle: `${checkedCount}/${totalCount} ${tr(\"partner_ready\", \"hazır\")}`,"
    }
  ],
  "src/components/PartnerDashboard.tsx": [
    {
      old: "description: `${womanName} bildiriş alacaq`",
      new: "description: `${womanName} ${tr(\"partner_will_receive_notification\", \"bildiriş alacaq\")}`"
    }
  ],
  "src/components/ProfileEditScreen.tsx": [
    {
      old: "{formData.name?.charAt(0) || 'İ'}",
      new: "{formData.name?.charAt(0) || tr(\"common_initial_i\", \"İ\")}"
    }
  ],
  "src/components/ProfileScreen.tsx": [
    {
      old: "toast({ title: `${childForm.name} əlavə edildi` });",
      new: "toast({ title: `${childForm.name} ${tr(\"profile_child_added\", \"əlavə edildi\")}` });"
    },
    {
      old: "const shareText = `Anacan tətbiqinə qoşul və hamiləlik səyahətimizdə mənə dəstək ol! Partnyor kodum: ${partnerCode}\\n\\nTətbiqi yüklə: https://anacanapp.lovable.app`;",
      new: "const shareText = `${tr(\"profile_share_partner_text\", \"Anacan tətbiqinə qoşul və hamiləlik səyahətimizdə mənə dəstək ol! Partnyor kodum:\")} ${partnerCode}\\n\\n${tr(\"profile_download_app\", \"Tətbiqi yüklə:\")} https://anacanapp.lovable.app`;"
    }
  ],
  "src/pages/RevenueCatDebug.tsx": [
    {
      old: "append(`Bundle versiyası: ${RC_BUILD_MARKER}`);",
      new: "append(`${tr(\"rc_bundle_version\", \"Bundle versiyası:\")} ${RC_BUILD_MARKER}`);"
    }
  ]
};

for (const [file, reps] of Object.entries(replacements)) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.log("File missing:", file);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  
  // ensure `import { tr } from "@/lib/tr";` is present
  if (!content.includes('import { tr }')) {
    content = 'import { tr } from "@/lib/tr";\n' + content;
    hasChanges = true;
  }

  reps.forEach(rep => {
    if (content.includes(rep.old)) {
      content = content.replace(rep.old, rep.new);
      hasChanges = true;
    } else {
      console.log("String not found in", file, ":", rep.old);
    }
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated", file);
  }
}
