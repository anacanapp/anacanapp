# Builds the four demo accounts (pregnancy, mother, cycle, partner) for one language.
# Usage: python3 build_fixtures.py <lang> <outDir>. Demo texts come from demo/<lang>.json.
import json, datetime as dt, uuid, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LANG = sys.argv[1] if len(sys.argv) > 1 else 'az'
H = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'scenarios', LANG)
os.makedirs(H, exist_ok=True)
D = json.load(open(os.path.join(HERE, 'demo', f'{LANG}.json'), encoding='utf-8'))
N = D['names']

T = dt.date.today(); now = dt.datetime.now(dt.timezone.utc)
iso = lambda d: d.isoformat()
ts = lambda d: d.astimezone(dt.timezone.utc).isoformat().replace('+00:00', 'Z')
day = lambda d: ts(dt.datetime.combine(d, dt.time(0), dt.timezone.utc))
uid = lambda n: '00000000-0000-4000-8000-0000000000%02d' % n
rid = lambda: str(uuid.uuid4())

def base_profile(n, name, stage, **kw):
    p = {"id": rid(), "user_id": uid(n), "name": name, "email": f"demo{n}@example.com", "life_stage": stage,
         "partner_code": "ANACAN-7Q2K", "linked_partner_id": None, "avatar_url": None, "cycle_length": 28, "period_length": 5,
         "last_period_date": None, "due_date": None, "baby_birth_date": None, "baby_name": None, "baby_gender": None,
         "baby_count": 1, "multiples_type": "single", "delivery_type": None, "start_weight": 61, "is_premium": True,
         "premium_until": "2030-01-01T00:00:00Z", "badge_type": None, "bio": None, "country_code": D['country'],
         "onboarding_answers": {}, "created_at": "2026-05-01T00:00:00Z", "updated_at": "2026-10-01T00:00:00Z"}
    p.update(kw); return p

def store(p, **kw):
    s = {"isAuthenticated": True, "isOnboarded": True, "hasSeenIntro": True, "hasCompletedFunnel": True, "userId": p['user_id'],
         "email": p['email'], "name": p['name'], "role": "partner" if p['life_stage'] == 'partner' else "woman",
         "lifeStage": p['life_stage'], "cycleLength": 28, "periodLength": 5, "babyCount": 1, "multiplesType": "single",
         "language": LANG, "hasSelectedLanguage": True, "countryCode": D['country']}
    s.update(kw); return {"state": s, "version": 0}

def scenario(name, p, st, fx, functions=None):
    fx = dict(fx); fx.setdefault('profiles', [p]); fx.setdefault('user_roles', [])
    for t in ['daily_logs', 'kick_sessions', 'weight_entries', 'appointments', 'baby_logs', 'period_day_logs', 'user_children',
              'partner_messages', 'user_blocks', 'usage_tracking', 'subscriptions', 'mood_entries', 'vitamin_logs',
              'vitamin_schedules', 'notifications', 'meal_logs', 'rpc/chat_groups_v4', 'rpc/get_my_moderation_status_v1',
              'group_memberships', 'community_groups', 'post_likes', 'community_post_bookmarks', 'partner_sharing_settings']:
        fx.setdefault(t, [] if not t.endswith('status_v1') else {})
    ls = {"anacan-language": LANG, "anacan-user-store": st, "anacan_partner_tour_v2": "1"}
    # Admin-written Azerbaijani community headers lack translations in several languages;
    # other languages fall back to the app's translated default header.
    settings = {} if LANG == 'az' else {"community_header_bump": None, "community_header_flow": None, "community_header_mommy": None}
    json.dump({"email": p['email'], "premium": True, "profile": p, "localStorage": ls, "fixtures": fx, "functions": functions or {}, "appSettings": settings,
               "locale": D['locale']}, open(f'{H}/{name}.json', 'w'), ensure_ascii=False, indent=1)

def log(u, **kw):
    r = {"id": rid(), "user_id": u, "log_date": iso(T), "water_intake": 6, "mood": 4, "symptoms": [], "notes": None,
         "bleeding": None, "sleep_hours": 7.5, "sleep_quality": 4, "temperature": None, "created_at": ts(now)}
    r.update(kw); return r

def appt(u, title, days, time, kind, desc=None):
    return {"id": rid(), "user_id": u, "title": title, "description": desc, "event_date": iso(T + dt.timedelta(days=days)),
            "event_time": time, "event_type": kind, "reminder_enabled": True, "created_at": ts(now)}

# Pregnancy: day 138
lmp = T - dt.timedelta(days=137); due = lmp + dt.timedelta(days=280)
p = base_profile(1, N['mother'], 'bump', last_period_date=iso(lmp), due_date=iso(due))
A = D['appointments']
bump_appts = [appt(p['user_id'], A[0], 1, '10:30:00', 'ultrasound', A[1]), appt(p['user_id'], A[2], 6, '09:00:00', 'test')]
authors = [('30000000-0000-4000-8000-000000000001', D['authors'][0], 'bump', 'admin'),
           ('30000000-0000-4000-8000-000000000002', D['authors'][1], 'mommy', None),
           ('30000000-0000-4000-8000-000000000003', D['authors'][2], 'bump', None)]
feed = [{"id": f"40000000-0000-4000-8000-00000000000{i}", "group_id": None, "user_id": a[0], "content": D['posts'][i],
         "media_urls": None, "likes_count": l, "comments_count": c, "is_pinned": False, "is_anonymous": False, "language": LANG,
         "created_at": ts(now - dt.timedelta(minutes=m)), "is_liked": i == 0, "is_saved": False}
        for i, (a, l, c, m) in enumerate(zip(authors, (124, 89, 57), (18, 12, 23), (5, 32, 75)))]
cards = [{"user_id": a[0], "name": a[1], "avatar_url": None, "badge_type": a[3], "life_stage": a[2], "is_premium": True,
          "is_verified": False, "created_at": "2026-01-01T00:00:00Z", "can_share_links": False} for a in authors]
scenario('bump', p, store(p, lastPeriodDate=day(lmp), dueDate=day(due)), {
    "daily_logs": [log(p['user_id'])],
    "kick_sessions": [{"id": rid(), "user_id": p['user_id'], "session_date": iso(T), "kick_count": 12, "duration_seconds": 900, "position": None, "created_at": ts(now)}],
    "weight_entries": [{"id": rid(), "user_id": p['user_id'], "entry_date": iso(T - dt.timedelta(days=60)), "weight": 61.0, "notes": None, "created_at": ts(now)},
                       {"id": rid(), "user_id": p['user_id'], "entry_date": iso(T), "weight": 65.2, "notes": None, "created_at": ts(now)}],
    "appointments": bump_appts,
    "rpc/get_community_feed_v2": feed, "rpc/get_public_community_profiles_v2": cards, "public_profile_cards": cards,
}, {"dr-anacan-chat": {"sse": D['ai_answer']}})

# Mother: baby 8 months
birth = T - dt.timedelta(days=244)
m = base_profile(2, N['mother'], 'mommy', baby_birth_date=iso(birth), baby_name=N['baby'], baby_gender='girl', delivery_type='natural')
child = {"id": "20000000-0000-4000-8000-000000000001", "user_id": m['user_id'], "name": N['baby'], "birth_date": iso(birth),
         "gender": "girl", "due_date": iso(birth), "avatar_emoji": "👶", "country_code": D['country'], "vaccine_country_code": D['country'],
         "is_active": True, "sort_order": 0, "notes": None, "created_at": ts(now), "updated_at": ts(now)}
def bl(kind, hours_ago, mins, **kw):
    st = now - dt.timedelta(hours=hours_ago)
    r = {"id": rid(), "user_id": m['user_id'], "child_id": child['id'], "log_type": kind, "start_time": ts(st),
         "end_time": ts(st + dt.timedelta(minutes=mins)) if mins else None, "amount_ml": None, "feed_type": None,
         "diaper_type": None, "notes": None, "created_at": ts(st)}
    r.update(kw); return r
scenario('mommy', m, store(m, babyBirthDate=day(birth), babyName=N['baby'], babyGender='girl', deliveryType='natural'), {
    "user_children": [child],
    "baby_logs": [bl('sleep', 3, 95), bl('sleep', 7, 50), bl('feeding', 1.5, 15, feed_type='breast_left'),
                  bl('feeding', 4.5, 0, feed_type='formula', amount_ml=150), bl('feeding', 8, 14, feed_type='breast_right'),
                  bl('diaper', 2, 0, diaper_type='wet'), bl('diaper', 6, 0, diaper_type='both')],
    "period_day_logs": [{"id": rid(), "user_id": m['user_id'], "log_date": iso(T - dt.timedelta(days=d)), "flow_intensity": "medium", "notes": None, "created_at": ts(now)} for d in (1, 0)],
    "appointments": [appt(m['user_id'], A[3], 2, '11:00:00', 'checkup')],
    "daily_logs": [log(m['user_id'], water_intake=7, sleep_hours=6, sleep_quality=3)],
})

# Cycle: day 3 of the period, three earlier cycles
start = T - dt.timedelta(days=2)
f = base_profile(3, N['cycle'], 'flow', last_period_date=iso(start))
fp = [{"id": rid(), "user_id": f['user_id'], "log_date": iso(start + dt.timedelta(days=d)), "flow_intensity": ["medium", "heavy", "medium"][d], "notes": None, "created_at": ts(now)} for d in range(3)]
for back in (28, 56, 84):
    s0 = start - dt.timedelta(days=back)
    fp += [{"id": rid(), "user_id": f['user_id'], "log_date": iso(s0 + dt.timedelta(days=d)), "flow_intensity": "medium", "notes": None, "created_at": ts(now)} for d in range(5)]
scenario('flow', f, store(f, lastPeriodDate=day(start)), {
    "period_day_logs": fp, "daily_logs": [log(f['user_id'], water_intake=5, mood=3, symptoms=['cramps'], bleeding='medium', sleep_hours=7)],
})

# Partner linked to the pregnant user
r = base_profile(4, N['partner'], 'partner', linked_partner_id=p['id'])
scenario('partner', r, store(r, linkedPartnerId=p['id']), {
    "profiles": [r, dict(p, linked_partner_id=r['id'])], "daily_logs": [log(p['user_id'])], "appointments": bump_appts,
    "rpc/get_linked_partner_premium": True,
})
print('ok', LANG, T)
