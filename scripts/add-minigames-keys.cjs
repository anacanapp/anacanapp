/**
 * Adds the mini-games (Sağlam Səbət + Birləşdir + hub/leaderboard) translation
 * keys to the bundled locale files so the games are fully multilanguage.
 * Run: node scripts/add-minigames-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // ---- Hub / tabs / shared ----
  minigames_hub_title: { az: 'Mini Oyunlar', en: 'Mini Games' },
  minigames_hub_subtitle: { az: 'Stresi at, oyna, rahatla', en: 'Unwind, play, relax' },
  minigames_tab_games: { az: 'Oyunlar', en: 'Games' },
  minigames_tab_leaderboard: { az: 'Reytinq', en: 'Leaderboard' },
  minigames_badge_new: { az: 'Yeni', en: 'New' },
  minigames_levels_short: { az: 'səviyyə', en: 'levels' },
  minigames_unlocked_short: { az: 'açıq', en: 'unlocked' },
  minigames_more_soon_title: { az: 'Yeni oyunlar tezliklə', en: 'New games coming soon' },
  minigames_more_soon_desc: {
    az: 'Mini Oyunlar bölməsinə tezliklə yeni oyunlar əlavə olunacaq',
    en: 'New games will be added to the Mini Games section soon',
  },
  minigames_leaderboard_empty_title: { az: 'Reytinq hələ boşdur', en: 'The leaderboard is empty' },
  minigames_leaderboard_empty_desc: {
    az: 'İlk oyunçu siz olun! Oyunu bitirin və xalınız qlobal reytinqə düşsün.',
    en: 'Be the first! Finish a round and your score will join the global leaderboard.',
  },
  minigames_your_best_score: { az: 'Sizin ən yaxşı xalınız', en: 'Your best score' },
  minigames_you_label: { az: 'Siz', en: 'You' },
  minigames_points_label: { az: 'xal', en: 'pts' },
  minigames_level_started: { az: 'Səviyyə başladı', en: 'Level started' },

  // ---- Difficulty tiers (shared) ----
  games_tier_rahat: { az: 'Rahat', en: 'Relaxed' },
  games_tier_orta: { az: 'Orta', en: 'Medium' },
  games_tier_cetin: { az: 'Çətin', en: 'Hard' },
  games_tier_ekspert: { az: 'Ekspert', en: 'Expert' },
  games_tier_asan: { az: 'Asan', en: 'Easy' },

  // ---- Sağlam Səbət ----
  saglamsebet_title: { az: 'Sağlam Səbət', en: 'Healthy Basket' },
  saglamsebet_card_desc: {
    az: 'Sağlam qidaları tut, zərərlilərdən qaç',
    en: 'Catch healthy foods, dodge the junk',
  },
  saglamsebet_choose_level: { az: 'Səviyyə seçin', en: 'Choose a level' },
  saglamsebet_best_score_label: { az: 'Ən yaxşı xalınız', en: 'Best score' },
  saglamsebet_levels_unlocked_prefix: { az: 'Açılmış səviyyələr', en: 'Levels unlocked' },
  saglamsebet_level_label: { az: 'Səviyyə', en: 'Level' },
  saglamsebet_life_lost_text: { az: '-1 ❤️', en: '-1 ❤️' },
  saglamsebet_target_prefix: { az: 'Hədəf', en: 'Target' },
  saglamsebet_target_reached: { az: 'Hədəf keçildi!', en: 'Target reached!' },
  saglamsebet_intro_desc: {
    az: 'Sağlam qidaları səbətə tut, zərərli qidalardan və stress buludlarından qaç!',
    en: 'Catch the healthy foods in your basket — dodge junk food and stress clouds!',
  },
  saglamsebet_points_short: { az: 'xal', en: 'pts' },
  saglamsebet_start_button: { az: 'Başla', en: 'Start' },
  saglamsebet_go_text: { az: 'Başla!', en: 'Go!' },
  saglamsebet_paused_title: { az: 'Fasilə', en: 'Paused' },
  saglamsebet_resume_button: { az: 'Davam et', en: 'Resume' },
  saglamsebet_restart_button: { az: 'Yenidən başla', en: 'Restart' },
  saglamsebet_menu_button: { az: 'Menyu', en: 'Menu' },
  saglamsebet_level_complete_title: { az: 'Səviyyə tamamlandı!', en: 'Level complete!' },
  saglamsebet_your_score_prefix: { az: 'Xalınız', en: 'Your score' },
  saglamsebet_next_level_button: { az: 'Növbəti səviyyə', en: 'Next level' },
  saglamsebet_replay_button: { az: 'Təkrar oyna', en: 'Play again' },
  saglamsebet_out_of_lives_title: { az: 'Canlar bitdi!', en: 'Out of lives!' },
  saglamsebet_time_up_title: { az: 'Vaxt bitdi!', en: "Time's up!" },
  saglamsebet_retry_button: { az: 'Yenidən cəhd et', en: 'Try again' },

  // ---- Birləşdir ----
  birlesdir_title: { az: 'Birləşdir', en: 'Match Up' },
  birlesdir_card_desc: {
    az: '3 və ya daha çoxunu birləşdir, bonusları aç',
    en: 'Match 3 or more, unlock bonuses',
  },
  birlesdir_choose_level: { az: 'Səviyyə seçin', en: 'Choose a level' },
  birlesdir_best_score_label: { az: 'Ən yaxşı xalınız', en: 'Best score' },
  birlesdir_levels_unlocked_prefix: { az: 'Açılmış səviyyələr', en: 'Levels unlocked' },
  birlesdir_level_label: { az: 'Səviyyə', en: 'Level' },
  birlesdir_moves_short: { az: 'gediş', en: 'moves' },
  birlesdir_target_prefix: { az: 'Hədəf', en: 'Target' },
  birlesdir_shuffle_notice: { az: 'Lövhə qarışdırıldı 🔄', en: 'Board reshuffled 🔄' },
  birlesdir_intro_desc: {
    az: '3 və ya daha çox eyni əşyanı yan-yana gətir, "Sakitlik Anı" və "Super Ana" bonuslarını aç!',
    en: 'Line up 3 or more matching items to unlock the "Calm Moment" and "Super Mom" bonuses!',
  },
  birlesdir_points_short: { az: 'xal', en: 'pts' },
  birlesdir_start_button: { az: 'Başla', en: 'Start' },
  birlesdir_paused_title: { az: 'Fasilə', en: 'Paused' },
  birlesdir_resume_button: { az: 'Davam et', en: 'Resume' },
  birlesdir_restart_button: { az: 'Yenidən başla', en: 'Restart' },
  birlesdir_menu_button: { az: 'Menyu', en: 'Menu' },
  birlesdir_level_complete_title: { az: 'Səviyyə tamamlandı!', en: 'Level complete!' },
  birlesdir_your_score_prefix: { az: 'Xalınız', en: 'Your score' },
  birlesdir_move_bonus_label: { az: 'gediş bonusu', en: 'move bonus' },
  birlesdir_next_level_button: { az: 'Növbəti səviyyə', en: 'Next level' },
  birlesdir_replay_button: { az: 'Təkrar oyna', en: 'Play again' },
  birlesdir_out_of_moves_title: { az: 'Gedişlər bitdi!', en: 'Out of moves!' },
  birlesdir_retry_button: { az: 'Yenidən cəhd et', en: 'Try again' },
  birlesdir_bonus_striped: { az: 'Sakitlik Anı!', en: 'Calm Moment!' },
  birlesdir_bonus_wrapped: { az: 'Super Ana!', en: 'Super Mom!' },
  birlesdir_bonus_colorbomb: { az: 'Ana Sehri!', en: 'Mom Magic!' },
};

for (const lang of ['az', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  let updated = 0;
  for (const [key, values] of Object.entries(KEYS)) {
    if (!(key in json)) {
      json[key] = values[lang];
      added++;
    } else if (json[key] !== values[lang]) {
      json[key] = values[lang];
      updated++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: ${added} keys added, ${updated} updated (${Object.keys(json).length} total)`);
}
