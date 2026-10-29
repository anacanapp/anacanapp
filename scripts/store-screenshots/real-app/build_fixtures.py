import json, datetime as dt, uuid
import os, sys
H=sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scenarios')
os.makedirs(H, exist_ok=True)
T=dt.date.today(); now=dt.datetime.now(dt.timezone.utc)
iso=lambda d: d.isoformat()
ts=lambda d: d.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z')
U='00000000-0000-4000-8000-0000000000%02d'
def uid(n): return U % n
def rid(): return str(uuid.uuid4())
def base_profile(n, name, stage, **kw):
    p={"id":rid(),"user_id":uid(n),"name":name,"email":f"{name.lower()}@example.com","life_stage":stage,"partner_code":"ANACAN-7Q2K","linked_partner_id":None,"avatar_url":None,"cycle_length":28,"period_length":5,"last_period_date":None,"due_date":None,"baby_birth_date":None,"baby_name":None,"baby_gender":None,"baby_count":1,"multiples_type":"single","delivery_type":None,"start_weight":61,"is_premium":True,"premium_until":"2030-01-01T00:00:00Z","badge_type":None,"bio":None,"country_code":"AZ","onboarding_answers":{},"created_at":"2026-05-01T00:00:00Z","updated_at":"2026-10-01T00:00:00Z"}
    p.update(kw); return p
def store(p, **kw):
    s={"isAuthenticated":True,"isOnboarded":True,"hasSeenIntro":True,"hasCompletedFunnel":True,"userId":p['user_id'],"email":p['email'],"name":p['name'],"role":"partner" if p['life_stage']=='partner' else "woman","lifeStage":p['life_stage'],"cycleLength":28,"periodLength":5,"babyCount":1,"multiplesType":"single","language":"az","hasSelectedLanguage":True,"countryCode":"AZ"}
    s.update(kw); return {"state":s,"version":0}
def scenario(name, p, st, fx):
    fx=dict(fx); fx.setdefault('profiles',[p]); fx.setdefault('user_roles',[])
    for t in ['daily_logs','kick_sessions','weight_entries','appointments','baby_logs','period_day_logs','user_children','partner_messages','user_blocks','usage_tracking','subscriptions','mood_entries','vitamin_logs','vitamin_schedules','notifications']:
        fx.setdefault(t,[])
    json.dump({"email":p['email'],"premium":True,"profile":p,"localStorage":{"anacan-language":"az","anacan-user-store":st},"fixtures":fx},open(f'{H}/{name}.json','w'),indent=1)

# Pregnancy: week 20 day 3 (day 138)
lmp=T-dt.timedelta(days=137); due=lmp+dt.timedelta(days=280)
p=base_profile(1,'Leyla','bump',last_period_date=iso(lmp),due_date=iso(due))
appts=[{"id":rid(),"user_id":p['user_id'],"title":"USM müayinəsi","description":"Doğum evi №5","event_date":iso(T+dt.timedelta(days=1)),"event_time":"10:30:00","event_type":"ultrasound","reminder_enabled":True,"created_at":ts(now)},
       {"id":rid(),"user_id":p['user_id'],"title":"Qan analizi","description":None,"event_date":iso(T+dt.timedelta(days=6)),"event_time":"09:00:00","event_type":"test","reminder_enabled":True,"created_at":ts(now)}]
scenario('bump',p,store(p,lastPeriodDate=ts(dt.datetime.combine(lmp,dt.time(0),dt.timezone.utc)),dueDate=ts(dt.datetime.combine(due,dt.time(0),dt.timezone.utc))),{
 "daily_logs":[{"id":rid(),"user_id":p['user_id'],"log_date":iso(T),"water_intake":6,"mood":4,"symptoms":[],"notes":None,"bleeding":None,"sleep_hours":7.5,"sleep_quality":4,"temperature":None,"created_at":ts(now)}],
 "kick_sessions":[{"id":rid(),"user_id":p['user_id'],"session_date":iso(T),"kick_count":12,"duration_seconds":900,"position":None,"created_at":ts(now)}],
 "weight_entries":[{"id":rid(),"user_id":p['user_id'],"entry_date":iso(T-dt.timedelta(days=60)),"weight":61.0,"notes":None,"created_at":ts(now)},{"id":rid(),"user_id":p['user_id'],"entry_date":iso(T),"weight":65.2,"notes":None,"created_at":ts(now)}],
 "appointments":appts})

# Mother: baby 8 months
birth=T-dt.timedelta(days=244)
m=base_profile(2,'Leyla','mommy',baby_birth_date=iso(birth),baby_name='Nərmin',baby_gender='girl',delivery_type='natural')
child={"id":"20000000-0000-4000-8000-000000000001","user_id":m['user_id'],"name":"Nərmin","birth_date":iso(birth),"gender":"girl","due_date":iso(birth),"avatar_emoji":"👶","country_code":"AZ","vaccine_country_code":"AZ","is_active":True,"sort_order":0,"notes":None,"created_at":ts(now),"updated_at":ts(now)}
def bl(kind, hours_ago, mins, **kw):
    st=now-dt.timedelta(hours=hours_ago); r={"id":rid(),"user_id":m['user_id'],"child_id":child['id'],"log_type":kind,"start_time":ts(st),"end_time":ts(st+dt.timedelta(minutes=mins)) if mins else None,"amount_ml":None,"feed_type":None,"diaper_type":None,"notes":None,"created_at":ts(st)}
    r.update(kw); return r
blogs=[bl('sleep',3,95),bl('sleep',7,50),bl('feeding',1.5,15,feed_type='breast_left'),bl('feeding',4.5,120 and 0,feed_type='formula',amount_ml=150),bl('feeding',8,14,feed_type='breast_right'),bl('diaper',2,0,diaper_type='wet'),bl('diaper',6,0,diaper_type='both')]
period=[{"id":rid(),"user_id":m['user_id'],"log_date":iso(T-dt.timedelta(days=d)),"flow_intensity":"medium","notes":None,"created_at":ts(now)} for d in (1,0)]
mappts=[{"id":rid(),"user_id":m['user_id'],"title":"Pediatr müayinəsi","description":None,"event_date":iso(T+dt.timedelta(days=2)),"event_time":"11:00:00","event_type":"checkup","reminder_enabled":True,"created_at":ts(now)}]
scenario('mommy',m,store(m,babyBirthDate=ts(dt.datetime.combine(birth,dt.time(0),dt.timezone.utc)),babyName='Nərmin',babyGender='girl',deliveryType='natural'),{
 "user_children":[child],"baby_logs":blogs,"period_day_logs":period,"appointments":mappts,
 "daily_logs":[{"id":rid(),"user_id":m['user_id'],"log_date":iso(T),"water_intake":7,"mood":4,"symptoms":[],"notes":None,"bleeding":None,"sleep_hours":6,"sleep_quality":3,"temperature":None,"created_at":ts(now)}]})

# Cycle: day 3 of period
start=T-dt.timedelta(days=2)
f=base_profile(3,'Aysel','flow',last_period_date=iso(start))
fp=[{"id":rid(),"user_id":f['user_id'],"log_date":iso(start+dt.timedelta(days=d)),"flow_intensity":["medium","heavy","medium"][d],"notes":None,"created_at":ts(now)} for d in range(3)]
for back in (28,56,84):
    s0=start-dt.timedelta(days=back)
    fp+= [{"id":rid(),"user_id":f['user_id'],"log_date":iso(s0+dt.timedelta(days=d)),"flow_intensity":"medium","notes":None,"created_at":ts(now)} for d in range(5)]
scenario('flow',f,store(f,lastPeriodDate=ts(dt.datetime.combine(start,dt.time(0),dt.timezone.utc))),{
 "period_day_logs":fp,
 "daily_logs":[{"id":rid(),"user_id":f['user_id'],"log_date":iso(T),"water_intake":5,"mood":3,"symptoms":["cramps"],"notes":None,"bleeding":"medium","sleep_hours":7,"sleep_quality":4,"temperature":None,"created_at":ts(now)}]})
print('ok', T)

# Community + AI on top of the pregnancy scenario
s=json.load(open(f'{H}/bump.json'))
A=[('30000000-0000-4000-8000-000000000001','Aynur Məmmədova','bump','admin'),('30000000-0000-4000-8000-000000000002','Lalə Kərimova','mommy',None),('30000000-0000-4000-8000-000000000003','Günay Əliyeva','bump',None)]
posts=[
 (A[0],'Bu gün ilk təpikləri hiss etdim! 🥹 Bu hissi sözlə izah edə bilmirəm. Sizdə ilk dəfə neçənci həftədə oldu? #hamiləlik',124,18,5),
 (A[1],'Gecə saat 3-də körpəm yatmayanda Anacan.AI ilə danışmaq çox kömək etdi. Yeni analara tövsiyə edirəm 💛',89,12,32),
 (A[2],'24-cü həftədəyik, xəstəxana çantasını hazırlamağa başladım. Siyahınızda nələr var? 🧳',57,23,75)]
feed=[{"id":f"40000000-0000-4000-8000-00000000000{i}","group_id":None,"user_id":a[0],"content":c,"media_urls":None,"likes_count":l,"comments_count":cm,"is_pinned":False,"is_anonymous":False,"language":"az","created_at":ts(now-dt.timedelta(minutes=mins)),"is_liked":i==0,"is_saved":False} for i,(a,c,l,cm,mins) in enumerate(posts)]
cards=[{"user_id":a[0],"name":a[1],"avatar_url":None,"badge_type":a[3],"life_stage":a[2],"is_premium":True,"is_verified":False,"created_at":"2026-01-01T00:00:00Z","can_share_links":False} for a in A]
s['fixtures'].update({"rpc/get_community_feed_v2":feed,"rpc/get_public_community_profiles_v2":cards,"public_profile_cards":cards,"post_likes":[],"community_post_bookmarks":[],"group_memberships":[],"community_groups":[],"rpc/get_my_moderation_status_v1":{},"rpc/chat_groups_v4":[],"meal_logs":[]})
s['functions']={"dr-anacan-chat":{"sse":["Ürəkbulanmaya qarşı sadə 3 üsul:\n\n","1. **Zəncefil çayı** — səhər ac qarına bir fincan.\n","2. **Az-az, tez-tez yeyin** — mədəni boş saxlamayın.\n","3. **Yataqdan qalxmadan** bir neçə quru peçenye yeyin.\n\n","Gün ərzində bol su için 💧 Qusma güclənsə, həkiminizə müraciət edin."]}}
json.dump(s,open(f'{H}/bump.json','w'),indent=1)
print('community+ai ok')

# Partner (Rauf) linked to the pregnant user
w=json.load(open(f'{H}/bump.json'))['profile']
r=base_profile(4,'Rauf','partner',linked_partner_id=w['id'],is_premium=True)
w2=dict(w, linked_partner_id=r['id'])
scenario('partner',r,store(r,linkedPartnerId=w['id']),{"profiles":[r,w2],
 "daily_logs":[{"id":rid(),"user_id":w['user_id'],"log_date":iso(T),"water_intake":6,"mood":4,"symptoms":[],"notes":None,"bleeding":None,"sleep_hours":7.5,"sleep_quality":4,"temperature":None,"created_at":ts(now)}],
 "appointments":json.load(open(f'{H}/bump.json'))['fixtures']['appointments'],"rpc/get_linked_partner_premium":True,"partner_sharing_settings":[]})
print('partner ok')
