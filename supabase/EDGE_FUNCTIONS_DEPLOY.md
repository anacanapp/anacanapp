# Supabase Edge Functions - Deployment Guide

Bu sənəd Anacan tətbiqi üçün Supabase Edge Functions-ların siyahısını və yerləşdirilmə təlimatlarını ehtiva edir.

## 📦 Mövcud Edge Functions

### 1. `dr-anacan-chat`
**Məqsəd:** AI chatbot funksiyası - Dr. Anacan süni intellekt köməkçisi

**Fayl yolu:** `supabase/functions/dr-anacan-chat/index.ts`

**Tələb olunan sirlər:**
- `GEMINI_API_KEY` - Google Gemini API açarı

**Endpoint:** `POST /functions/v1/dr-anacan-chat`

**Parametrlər:**
```json
{
  "messages": [{"role": "user", "content": "Salam"}],
  "lifeStage": "bump",
  "pregnancyWeek": 20,
  "isPartner": false,
  "stream": true
}
```

---

### 2. `generate-baby-photo`
**Məqsəd:** AI ilə körpə foto generasiyası

**Fayl yolu:** `supabase/functions/generate-baby-photo/index.ts`

**Tələb olunan sirlər:**
- `GEMINI_API_KEY` - Google Gemini API açarı

**Endpoint:** `POST /functions/v1/generate-baby-photo`

**Parametrlər:**
```json
{
  "babyName": "Ayla",
  "babyGender": "girl",
  "backgroundTheme": "garden"
}
```

---

## 🚀 Deployment Təlimatları

### Supabase CLI ilə

```bash
# Login
supabase login

# Layihəni bağla
supabase link --project-ref YOUR_PROJECT_REF

# Bütün funksiyaları yerləşdir
supabase functions deploy dr-anacan-chat
supabase functions deploy generate-baby-photo

# Sirləri əlavə et
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

### Sirlər (Secrets)

Aşağıdakı sirləri Supabase Dashboard → Edge Functions → Secrets bölməsindən əlavə edin:

| Sirr Adı | Təsviri | Tələb olunur |
|----------|---------|--------------|
| `GEMINI_API_KEY` | Google Gemini API açarı | ✅ |

---

## 📁 Fayl Strukturu

```
supabase/
├── config.toml            # Supabase konfiqurasiyası
├── complete-schema.sql    # Tam verilənlər bazası sxemi
└── functions/
    ├── dr-anacan-chat/
    │   ├── index.ts       # Əsas funksiya
    │   └── deno.json      # Deno konfiqurasiyası
    └── generate-baby-photo/
        └── index.ts       # Əsas funksiya
```

---

## ⚙️ config.toml Parametrləri

```toml
[functions.dr-anacan-chat]
verify_jwt = false

[functions.generate-baby-photo]
verify_jwt = false
```

**Qeyd:** `verify_jwt = false` - Bu funksiyalar öz içində autentifikasiyanı yoxlayır. Bu parametr xarici sorğulara imkan verir.

---

## 🔒 Təhlükəsizlik Qeydləri

1. **Rate Limiting:** Funksiyalar 429 xətası qaytara bilər - client tərəfdə idarə edin
2. **Credit Exhaustion:** 402 xətası kredit bitdikdə gəlir
3. **CORS:** Bütün origin-lərə icazə verilir (`*`)
4. **Auth:** `generate-baby-photo` istifadəçi autentifikasiyası tələb edir

---

## 🧪 Test Əmrləri

```bash
# dr-anacan-chat test
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/dr-anacan-chat' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Salam"}],"lifeStage":"bump"}'

# generate-baby-photo test (auth tələb olunur)
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-baby-photo' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{"babyName":"Test","babyGender":"girl","backgroundTheme":"garden"}'
```

---

## 📝 Əlavə Qeydlər

- Edge Functions Deno runtime istifadə edir
- Funksiyalar avtomatik olaraq cold start olur
- Maksimum icra müddəti: 60 saniyə
- Maksimum payload: 2MB
