export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_brand_audit: {
        Row: {
          action: string
          actor_id: string | null
          args_hash: string
          brand_id: string | null
          created_at: string
          id: string
          response: Json
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          args_hash: string
          brand_id?: string | null
          created_at?: string
          id: string
          response: Json
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          args_hash?: string
          brand_id?: string | null
          created_at?: string
          id?: string
          response?: Json
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_brand_audit_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ad_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_brand_creatives: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          banner_id: string | null
          brand_id: string
          deleted_at: string | null
          id: string
          legacy_clicks: number
          legacy_views: number
          revision: number
          snapshot: Json
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          banner_id?: string | null
          brand_id: string
          deleted_at?: string | null
          id: string
          legacy_clicks?: number
          legacy_views?: number
          revision?: number
          snapshot: Json
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          banner_id?: string | null
          brand_id?: string
          deleted_at?: string | null
          id?: string
          legacy_clicks?: number
          legacy_views?: number
          revision?: number
          snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_brand_creatives_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: true
            referencedRelation: "banners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_brand_creatives_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ad_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_brand_members: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_brand_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ad_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_brands: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          report_timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          report_timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          report_timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      ad_delivery_receipts: {
        Row: {
          actor_id: string | null
          brand_id: string
          clicked_at: string | null
          creative_id: string
          expires_at: string
          id: string
          impression_at: string | null
          impression_kind: string | null
          issued_at: string
          language: string
          metric_day: string | null
          placement: string
          platform: string
          revision: number
        }
        Insert: {
          actor_id?: string | null
          brand_id: string
          clicked_at?: string | null
          creative_id: string
          expires_at: string
          id: string
          impression_at?: string | null
          impression_kind?: string | null
          issued_at?: string
          language: string
          metric_day?: string | null
          placement: string
          platform: string
          revision: number
        }
        Update: {
          actor_id?: string | null
          brand_id?: string
          clicked_at?: string | null
          creative_id?: string
          expires_at?: string
          id?: string
          impression_at?: string | null
          impression_kind?: string | null
          issued_at?: string
          language?: string
          metric_day?: string | null
          placement?: string
          platform?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_delivery_receipts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ad_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_delivery_receipts_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_brand_creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_metrics_daily: {
        Row: {
          brand_id: string
          clicks: number
          creative_id: string
          impressions: number
          metric_day: string
          placement: string
          platform: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          clicks?: number
          creative_id: string
          impressions?: number
          metric_day: string
          placement: string
          platform: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          clicks?: number
          creative_id?: string
          impressions?: number
          metric_day?: string
          placement?: string
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_daily_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ad_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_metrics_daily_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_brand_creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_deliveries: {
        Row: {
          campaign_id: string
          claim_id: string | null
          claimed_at: string | null
          created_at: string
          error_code: string | null
          finished_at: string | null
          id: string
          platform: string
          state: string
          token_hash: string
          token_id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          claim_id?: string | null
          claimed_at?: string | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          platform: string
          state?: string
          token_hash: string
          token_id: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          claim_id?: string | null
          claimed_at?: string | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          platform?: string
          state?: string
          token_hash?: string
          token_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bulk_push_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_recipes: {
        Row: {
          calories: number | null
          category: string
          category_ar: string | null
          category_de: string | null
          category_en: string | null
          category_es: string | null
          category_fr: string | null
          category_hi: string | null
          category_id: string | null
          category_ja: string | null
          category_ka: string | null
          category_kk: string | null
          category_ko: string | null
          category_nl: string | null
          category_pl: string | null
          category_pt: string | null
          category_ru: string | null
          category_sv: string | null
          category_tr: string | null
          category_uz: string | null
          category_vi: string | null
          category_zh: string | null
          cook_time: number | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          image_url: string | null
          ingredients: Json
          ingredients_ar: Json | null
          ingredients_de: Json | null
          ingredients_en: Json | null
          ingredients_es: Json | null
          ingredients_fr: Json | null
          ingredients_hi: Json | null
          ingredients_id: Json | null
          ingredients_ja: Json | null
          ingredients_ka: Json | null
          ingredients_kk: Json | null
          ingredients_ko: Json | null
          ingredients_nl: Json | null
          ingredients_pl: Json | null
          ingredients_pt: Json | null
          ingredients_ru: Json | null
          ingredients_sv: Json | null
          ingredients_tr: Json | null
          ingredients_uz: Json | null
          ingredients_vi: Json | null
          ingredients_zh: Json | null
          instructions: Json
          instructions_ar: Json | null
          instructions_de: Json | null
          instructions_en: Json | null
          instructions_es: Json | null
          instructions_fr: Json | null
          instructions_hi: Json | null
          instructions_id: Json | null
          instructions_ja: Json | null
          instructions_ka: Json | null
          instructions_kk: Json | null
          instructions_ko: Json | null
          instructions_nl: Json | null
          instructions_pl: Json | null
          instructions_pt: Json | null
          instructions_ru: Json | null
          instructions_sv: Json | null
          instructions_tr: Json | null
          instructions_uz: Json | null
          instructions_vi: Json | null
          instructions_zh: Json | null
          is_active: boolean | null
          prep_time: number | null
          servings: number | null
          tags: string[] | null
          tags_ar: string[] | null
          tags_de: string[] | null
          tags_en: string[] | null
          tags_es: string[] | null
          tags_fr: string[] | null
          tags_hi: string[] | null
          tags_id: string[] | null
          tags_ja: string[] | null
          tags_ka: string[] | null
          tags_kk: string[] | null
          tags_ko: string[] | null
          tags_nl: string[] | null
          tags_pl: string[] | null
          tags_pt: string[] | null
          tags_ru: string[] | null
          tags_sv: string[] | null
          tags_tr: string[] | null
          tags_uz: string[] | null
          tags_vi: string[] | null
          tags_zh: string[] | null
          title: string
          title_ar: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
        }
        Insert: {
          calories?: number | null
          category?: string
          category_ar?: string | null
          category_de?: string | null
          category_en?: string | null
          category_es?: string | null
          category_fr?: string | null
          category_hi?: string | null
          category_id?: string | null
          category_ja?: string | null
          category_ka?: string | null
          category_kk?: string | null
          category_ko?: string | null
          category_nl?: string | null
          category_pl?: string | null
          category_pt?: string | null
          category_ru?: string | null
          category_sv?: string | null
          category_tr?: string | null
          category_uz?: string | null
          category_vi?: string | null
          category_zh?: string | null
          cook_time?: number | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          ingredients_ar?: Json | null
          ingredients_de?: Json | null
          ingredients_en?: Json | null
          ingredients_es?: Json | null
          ingredients_fr?: Json | null
          ingredients_hi?: Json | null
          ingredients_id?: Json | null
          ingredients_ja?: Json | null
          ingredients_ka?: Json | null
          ingredients_kk?: Json | null
          ingredients_ko?: Json | null
          ingredients_nl?: Json | null
          ingredients_pl?: Json | null
          ingredients_pt?: Json | null
          ingredients_ru?: Json | null
          ingredients_sv?: Json | null
          ingredients_tr?: Json | null
          ingredients_uz?: Json | null
          ingredients_vi?: Json | null
          ingredients_zh?: Json | null
          instructions?: Json
          instructions_ar?: Json | null
          instructions_de?: Json | null
          instructions_en?: Json | null
          instructions_es?: Json | null
          instructions_fr?: Json | null
          instructions_hi?: Json | null
          instructions_id?: Json | null
          instructions_ja?: Json | null
          instructions_ka?: Json | null
          instructions_kk?: Json | null
          instructions_ko?: Json | null
          instructions_nl?: Json | null
          instructions_pl?: Json | null
          instructions_pt?: Json | null
          instructions_ru?: Json | null
          instructions_sv?: Json | null
          instructions_tr?: Json | null
          instructions_uz?: Json | null
          instructions_vi?: Json | null
          instructions_zh?: Json | null
          is_active?: boolean | null
          prep_time?: number | null
          servings?: number | null
          tags?: string[] | null
          tags_ar?: string[] | null
          tags_de?: string[] | null
          tags_en?: string[] | null
          tags_es?: string[] | null
          tags_fr?: string[] | null
          tags_hi?: string[] | null
          tags_id?: string[] | null
          tags_ja?: string[] | null
          tags_ka?: string[] | null
          tags_kk?: string[] | null
          tags_ko?: string[] | null
          tags_nl?: string[] | null
          tags_pl?: string[] | null
          tags_pt?: string[] | null
          tags_ru?: string[] | null
          tags_sv?: string[] | null
          tags_tr?: string[] | null
          tags_uz?: string[] | null
          tags_vi?: string[] | null
          tags_zh?: string[] | null
          title: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Update: {
          calories?: number | null
          category?: string
          category_ar?: string | null
          category_de?: string | null
          category_en?: string | null
          category_es?: string | null
          category_fr?: string | null
          category_hi?: string | null
          category_id?: string | null
          category_ja?: string | null
          category_ka?: string | null
          category_kk?: string | null
          category_ko?: string | null
          category_nl?: string | null
          category_pl?: string | null
          category_pt?: string | null
          category_ru?: string | null
          category_sv?: string | null
          category_tr?: string | null
          category_uz?: string | null
          category_vi?: string | null
          category_zh?: string | null
          cook_time?: number | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          ingredients_ar?: Json | null
          ingredients_de?: Json | null
          ingredients_en?: Json | null
          ingredients_es?: Json | null
          ingredients_fr?: Json | null
          ingredients_hi?: Json | null
          ingredients_id?: Json | null
          ingredients_ja?: Json | null
          ingredients_ka?: Json | null
          ingredients_kk?: Json | null
          ingredients_ko?: Json | null
          ingredients_nl?: Json | null
          ingredients_pl?: Json | null
          ingredients_pt?: Json | null
          ingredients_ru?: Json | null
          ingredients_sv?: Json | null
          ingredients_tr?: Json | null
          ingredients_uz?: Json | null
          ingredients_vi?: Json | null
          ingredients_zh?: Json | null
          instructions?: Json
          instructions_ar?: Json | null
          instructions_de?: Json | null
          instructions_en?: Json | null
          instructions_es?: Json | null
          instructions_fr?: Json | null
          instructions_hi?: Json | null
          instructions_id?: Json | null
          instructions_ja?: Json | null
          instructions_ka?: Json | null
          instructions_kk?: Json | null
          instructions_ko?: Json | null
          instructions_nl?: Json | null
          instructions_pl?: Json | null
          instructions_pt?: Json | null
          instructions_ru?: Json | null
          instructions_sv?: Json | null
          instructions_tr?: Json | null
          instructions_uz?: Json | null
          instructions_vi?: Json | null
          instructions_zh?: Json | null
          is_active?: boolean | null
          prep_time?: number | null
          servings?: number | null
          tags?: string[] | null
          tags_ar?: string[] | null
          tags_de?: string[] | null
          tags_en?: string[] | null
          tags_es?: string[] | null
          tags_fr?: string[] | null
          tags_hi?: string[] | null
          tags_id?: string[] | null
          tags_ja?: string[] | null
          tags_ka?: string[] | null
          tags_kk?: string[] | null
          tags_ko?: string[] | null
          tags_nl?: string[] | null
          tags_pl?: string[] | null
          tags_pt?: string[] | null
          tags_ru?: string[] | null
          tags_sv?: string[] | null
          tags_tr?: string[] | null
          tags_uz?: string[] | null
          tags_vi?: string[] | null
          tags_zh?: string[] | null
          title?: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_products: {
        Row: {
          affiliate_url: string
          category: string | null
          category_az: string | null
          category_en: string | null
          category_es: string | null
          category_fr: string | null
          category_hi: string | null
          category_id: string | null
          category_ja: string | null
          category_ko: string | null
          category_nl: string | null
          category_pl: string | null
          category_pt: string | null
          category_ru: string | null
          category_sv: string | null
          category_tr: string | null
          category_vi: string | null
          category_zh: string | null
          cons: string[] | null
          cons_en: string[] | null
          cons_es: string[] | null
          cons_fr: string[] | null
          cons_hi: string[] | null
          cons_id: string[] | null
          cons_ja: string[] | null
          cons_ko: string[] | null
          cons_nl: string[] | null
          cons_pl: string[] | null
          cons_pt: string[] | null
          cons_sv: string[] | null
          cons_vi: string[] | null
          cons_zh: string[] | null
          created_at: string | null
          currency: string | null
          description: string | null
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          life_stages: string[] | null
          name: string
          name_az: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_vi: string | null
          name_zh: string | null
          original_price: number | null
          platform: string | null
          price: number | null
          price_updated_at: string | null
          pros: string[] | null
          pros_en: string[] | null
          pros_es: string[] | null
          pros_fr: string[] | null
          pros_hi: string[] | null
          pros_id: string[] | null
          pros_ja: string[] | null
          pros_ko: string[] | null
          pros_nl: string[] | null
          pros_pl: string[] | null
          pros_pt: string[] | null
          pros_sv: string[] | null
          pros_vi: string[] | null
          pros_zh: string[] | null
          rating: number | null
          review_count: number | null
          review_summary: string | null
          review_summary_az: string | null
          review_summary_en: string | null
          review_summary_es: string | null
          review_summary_fr: string | null
          review_summary_hi: string | null
          review_summary_id: string | null
          review_summary_ja: string | null
          review_summary_ko: string | null
          review_summary_nl: string | null
          review_summary_pl: string | null
          review_summary_pt: string | null
          review_summary_ru: string | null
          review_summary_sv: string | null
          review_summary_tr: string | null
          review_summary_vi: string | null
          review_summary_zh: string | null
          sort_order: number | null
          specifications: Json | null
          store_logo_url: string | null
          store_name: string | null
          store_name_en: string | null
          store_name_es: string | null
          store_name_fr: string | null
          store_name_hi: string | null
          store_name_id: string | null
          store_name_ja: string | null
          store_name_ko: string | null
          store_name_nl: string | null
          store_name_pl: string | null
          store_name_pt: string | null
          store_name_sv: string | null
          store_name_vi: string | null
          store_name_zh: string | null
          tags: string[] | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          affiliate_url: string
          category?: string | null
          category_az?: string | null
          category_en?: string | null
          category_es?: string | null
          category_fr?: string | null
          category_hi?: string | null
          category_id?: string | null
          category_ja?: string | null
          category_ko?: string | null
          category_nl?: string | null
          category_pl?: string | null
          category_pt?: string | null
          category_ru?: string | null
          category_sv?: string | null
          category_tr?: string | null
          category_vi?: string | null
          category_zh?: string | null
          cons?: string[] | null
          cons_en?: string[] | null
          cons_es?: string[] | null
          cons_fr?: string[] | null
          cons_hi?: string[] | null
          cons_id?: string[] | null
          cons_ja?: string[] | null
          cons_ko?: string[] | null
          cons_nl?: string[] | null
          cons_pl?: string[] | null
          cons_pt?: string[] | null
          cons_sv?: string[] | null
          cons_vi?: string[] | null
          cons_zh?: string[] | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          life_stages?: string[] | null
          name: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          original_price?: number | null
          platform?: string | null
          price?: number | null
          price_updated_at?: string | null
          pros?: string[] | null
          pros_en?: string[] | null
          pros_es?: string[] | null
          pros_fr?: string[] | null
          pros_hi?: string[] | null
          pros_id?: string[] | null
          pros_ja?: string[] | null
          pros_ko?: string[] | null
          pros_nl?: string[] | null
          pros_pl?: string[] | null
          pros_pt?: string[] | null
          pros_sv?: string[] | null
          pros_vi?: string[] | null
          pros_zh?: string[] | null
          rating?: number | null
          review_count?: number | null
          review_summary?: string | null
          review_summary_az?: string | null
          review_summary_en?: string | null
          review_summary_es?: string | null
          review_summary_fr?: string | null
          review_summary_hi?: string | null
          review_summary_id?: string | null
          review_summary_ja?: string | null
          review_summary_ko?: string | null
          review_summary_nl?: string | null
          review_summary_pl?: string | null
          review_summary_pt?: string | null
          review_summary_ru?: string | null
          review_summary_sv?: string | null
          review_summary_tr?: string | null
          review_summary_vi?: string | null
          review_summary_zh?: string | null
          sort_order?: number | null
          specifications?: Json | null
          store_logo_url?: string | null
          store_name?: string | null
          store_name_en?: string | null
          store_name_es?: string | null
          store_name_fr?: string | null
          store_name_hi?: string | null
          store_name_id?: string | null
          store_name_ja?: string | null
          store_name_ko?: string | null
          store_name_nl?: string | null
          store_name_pl?: string | null
          store_name_pt?: string | null
          store_name_sv?: string | null
          store_name_vi?: string | null
          store_name_zh?: string | null
          tags?: string[] | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          affiliate_url?: string
          category?: string | null
          category_az?: string | null
          category_en?: string | null
          category_es?: string | null
          category_fr?: string | null
          category_hi?: string | null
          category_id?: string | null
          category_ja?: string | null
          category_ko?: string | null
          category_nl?: string | null
          category_pl?: string | null
          category_pt?: string | null
          category_ru?: string | null
          category_sv?: string | null
          category_tr?: string | null
          category_vi?: string | null
          category_zh?: string | null
          cons?: string[] | null
          cons_en?: string[] | null
          cons_es?: string[] | null
          cons_fr?: string[] | null
          cons_hi?: string[] | null
          cons_id?: string[] | null
          cons_ja?: string[] | null
          cons_ko?: string[] | null
          cons_nl?: string[] | null
          cons_pl?: string[] | null
          cons_pt?: string[] | null
          cons_sv?: string[] | null
          cons_vi?: string[] | null
          cons_zh?: string[] | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          life_stages?: string[] | null
          name?: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          original_price?: number | null
          platform?: string | null
          price?: number | null
          price_updated_at?: string | null
          pros?: string[] | null
          pros_en?: string[] | null
          pros_es?: string[] | null
          pros_fr?: string[] | null
          pros_hi?: string[] | null
          pros_id?: string[] | null
          pros_ja?: string[] | null
          pros_ko?: string[] | null
          pros_nl?: string[] | null
          pros_pl?: string[] | null
          pros_pt?: string[] | null
          pros_sv?: string[] | null
          pros_vi?: string[] | null
          pros_zh?: string[] | null
          rating?: number | null
          review_count?: number | null
          review_summary?: string | null
          review_summary_az?: string | null
          review_summary_en?: string | null
          review_summary_es?: string | null
          review_summary_fr?: string | null
          review_summary_hi?: string | null
          review_summary_id?: string | null
          review_summary_ja?: string | null
          review_summary_ko?: string | null
          review_summary_nl?: string | null
          review_summary_pl?: string | null
          review_summary_pt?: string | null
          review_summary_ru?: string | null
          review_summary_sv?: string | null
          review_summary_tr?: string | null
          review_summary_vi?: string | null
          review_summary_zh?: string | null
          sort_order?: number | null
          specifications?: Json | null
          store_logo_url?: string | null
          store_name?: string | null
          store_name_en?: string | null
          store_name_es?: string | null
          store_name_fr?: string | null
          store_name_hi?: string | null
          store_name_id?: string | null
          store_name_ja?: string | null
          store_name_ko?: string | null
          store_name_nl?: string | null
          store_name_pl?: string | null
          store_name_pt?: string | null
          store_name_sv?: string | null
          store_name_vi?: string | null
          store_name_zh?: string | null
          tags?: string[] | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      age_ranges: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          max_months: number | null
          min_months: number | null
          range_key: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          max_months?: number | null
          min_months?: number | null
          range_key: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          max_months?: number | null
          min_months?: number | null
          range_key?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          chat_type: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          user_id: string
        }
        Insert: {
          chat_type?: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          user_id: string
        }
        Update: {
          chat_type?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_suggested_questions: {
        Row: {
          color_from: string | null
          color_to: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          life_stage: string
          question: string
          question_ar: string | null
          question_az: string | null
          question_de: string | null
          question_en: string | null
          question_es: string | null
          question_fr: string | null
          question_hi: string | null
          question_id: string | null
          question_ja: string | null
          question_ka: string | null
          question_kk: string | null
          question_ko: string | null
          question_nl: string | null
          question_pl: string | null
          question_pt: string | null
          question_ru: string | null
          question_sv: string | null
          question_tr: string | null
          question_uz: string | null
          question_vi: string | null
          question_zh: string | null
          sort_order: number | null
          user_type: string
        }
        Insert: {
          color_from?: string | null
          color_to?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string
          question: string
          question_ar?: string | null
          question_az?: string | null
          question_de?: string | null
          question_en?: string | null
          question_es?: string | null
          question_fr?: string | null
          question_hi?: string | null
          question_id?: string | null
          question_ja?: string | null
          question_ka?: string | null
          question_kk?: string | null
          question_ko?: string | null
          question_nl?: string | null
          question_pl?: string | null
          question_pt?: string | null
          question_ru?: string | null
          question_sv?: string | null
          question_tr?: string | null
          question_uz?: string | null
          question_vi?: string | null
          question_zh?: string | null
          sort_order?: number | null
          user_type?: string
        }
        Update: {
          color_from?: string | null
          color_to?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string
          question?: string
          question_ar?: string | null
          question_az?: string | null
          question_de?: string | null
          question_en?: string | null
          question_es?: string | null
          question_fr?: string | null
          question_hi?: string | null
          question_id?: string | null
          question_ja?: string | null
          question_ka?: string | null
          question_kk?: string | null
          question_ko?: string | null
          question_nl?: string | null
          question_pl?: string | null
          question_pt?: string | null
          question_ru?: string | null
          question_sv?: string | null
          question_tr?: string | null
          question_uz?: string | null
          question_vi?: string | null
          question_zh?: string | null
          sort_order?: number | null
          user_type?: string
        }
        Relationships: []
      }
      album_orders: {
        Row: {
          album_type: string
          contact_phone: string | null
          created_at: string
          customer_name: string
          delivery_address: string | null
          id: string
          notes: string | null
          order_number: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_status: string | null
          status: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          album_type?: string
          contact_phone?: string | null
          created_at?: string
          customer_name: string
          delivery_address?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          album_type?: string
          contact_phone?: string | null
          created_at?: string
          customer_name?: string
          delivery_address?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_daily_summary: {
        Row: {
          event_category: string
          event_name: string
          id: string
          life_stage: string | null
          premium_users: number | null
          summary_date: string
          total_count: number | null
          unique_users: number | null
          updated_at: string | null
        }
        Insert: {
          event_category?: string
          event_name: string
          id?: string
          life_stage?: string | null
          premium_users?: number | null
          summary_date: string
          total_count?: number | null
          unique_users?: number | null
          updated_at?: string | null
        }
        Update: {
          event_category?: string
          event_name?: string
          id?: string
          life_stage?: string | null
          premium_users?: number | null
          summary_date?: string
          total_count?: number | null
          unique_users?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_category: string
          event_data: Json | null
          event_name: string
          id: string
          is_premium: boolean | null
          life_stage: string | null
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_category?: string
          event_data?: Json | null
          event_name: string
          id?: string
          is_premium?: boolean | null
          life_stage?: string | null
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_category?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          is_premium?: boolean | null
          life_stage?: string | null
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_branding: {
        Row: {
          created_at: string | null
          description: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_sv: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          image_url: string | null
          key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_sv?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_sv?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_languages: {
        Row: {
          code: string
          created_at: string
          disabled_tools: Json
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          native_name: string
          regions: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          disabled_tools?: Json
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          native_name: string
          regions?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          disabled_tools?: Json
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          native_name?: string
          regions?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_rating_prompts: {
        Row: {
          created_at: string
          first_shown_at: string
          id: string
          last_action: string
          last_shown_at: string
          platform: string | null
          rated_at: string | null
          show_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_shown_at?: string
          id?: string
          last_action?: string
          last_shown_at?: string
          platform?: string | null
          rated_at?: string | null
          show_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_shown_at?: string
          id?: string
          last_action?: string
          last_shown_at?: string
          platform?: string | null
          rated_at?: string | null
          show_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      apple_auth_notifications: {
        Row: {
          apple_user_id: string
          created_at: string
          email: string | null
          event_time: string | null
          event_type: string
          id: string
          is_private_email: boolean | null
          raw_payload: string | null
        }
        Insert: {
          apple_user_id: string
          created_at?: string
          email?: string | null
          event_time?: string | null
          event_type: string
          id?: string
          is_private_email?: boolean | null
          raw_payload?: string | null
        }
        Update: {
          apple_user_id?: string
          created_at?: string
          email?: string | null
          event_time?: string | null
          event_type?: string
          id?: string
          is_private_email?: boolean | null
          raw_payload?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          reminder_enabled: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string
          id?: string
          reminder_enabled?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          id?: string
          reminder_enabled?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      baby_crisis_periods: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          duration_days: number | null
          emoji: string | null
          id: string
          is_active: boolean
          leap_number: number | null
          severity: string | null
          sort_order: number
          symptoms: string[] | null
          symptoms_ar: string | null
          symptoms_az: string[] | null
          symptoms_de: string | null
          symptoms_en: string | null
          symptoms_es: string | null
          symptoms_fr: string | null
          symptoms_hi: string | null
          symptoms_id: string | null
          symptoms_ja: string | null
          symptoms_ka: string | null
          symptoms_kk: string | null
          symptoms_ko: string | null
          symptoms_nl: string | null
          symptoms_pl: string | null
          symptoms_pt: string | null
          symptoms_ru: string | null
          symptoms_sv: string | null
          symptoms_tr: string | null
          symptoms_uz: string | null
          symptoms_vi: string | null
          symptoms_zh: string | null
          tips: string[] | null
          tips_ar: string | null
          tips_az: string[] | null
          tips_de: string | null
          tips_en: string | null
          tips_es: string | null
          tips_fr: string | null
          tips_hi: string | null
          tips_id: string | null
          tips_ja: string | null
          tips_ka: string | null
          tips_kk: string | null
          tips_ko: string | null
          tips_nl: string | null
          tips_pl: string | null
          tips_pt: string | null
          tips_ru: string | null
          tips_sv: string | null
          tips_tr: string | null
          tips_uz: string | null
          tips_vi: string | null
          tips_zh: string | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
          week_end: number
          week_start: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          duration_days?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          leap_number?: number | null
          severity?: string | null
          sort_order?: number
          symptoms?: string[] | null
          symptoms_ar?: string | null
          symptoms_az?: string[] | null
          symptoms_de?: string | null
          symptoms_en?: string | null
          symptoms_es?: string | null
          symptoms_fr?: string | null
          symptoms_hi?: string | null
          symptoms_id?: string | null
          symptoms_ja?: string | null
          symptoms_ka?: string | null
          symptoms_kk?: string | null
          symptoms_ko?: string | null
          symptoms_nl?: string | null
          symptoms_pl?: string | null
          symptoms_pt?: string | null
          symptoms_ru?: string | null
          symptoms_sv?: string | null
          symptoms_tr?: string | null
          symptoms_uz?: string | null
          symptoms_vi?: string | null
          symptoms_zh?: string | null
          tips?: string[] | null
          tips_ar?: string | null
          tips_az?: string[] | null
          tips_de?: string | null
          tips_en?: string | null
          tips_es?: string | null
          tips_fr?: string | null
          tips_hi?: string | null
          tips_id?: string | null
          tips_ja?: string | null
          tips_ka?: string | null
          tips_kk?: string | null
          tips_ko?: string | null
          tips_nl?: string | null
          tips_pl?: string | null
          tips_pt?: string | null
          tips_ru?: string | null
          tips_sv?: string | null
          tips_tr?: string | null
          tips_uz?: string | null
          tips_vi?: string | null
          tips_zh?: string | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
          week_end: number
          week_start: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          duration_days?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          leap_number?: number | null
          severity?: string | null
          sort_order?: number
          symptoms?: string[] | null
          symptoms_ar?: string | null
          symptoms_az?: string[] | null
          symptoms_de?: string | null
          symptoms_en?: string | null
          symptoms_es?: string | null
          symptoms_fr?: string | null
          symptoms_hi?: string | null
          symptoms_id?: string | null
          symptoms_ja?: string | null
          symptoms_ka?: string | null
          symptoms_kk?: string | null
          symptoms_ko?: string | null
          symptoms_nl?: string | null
          symptoms_pl?: string | null
          symptoms_pt?: string | null
          symptoms_ru?: string | null
          symptoms_sv?: string | null
          symptoms_tr?: string | null
          symptoms_uz?: string | null
          symptoms_vi?: string | null
          symptoms_zh?: string | null
          tips?: string[] | null
          tips_ar?: string | null
          tips_az?: string[] | null
          tips_de?: string | null
          tips_en?: string | null
          tips_es?: string | null
          tips_fr?: string | null
          tips_hi?: string | null
          tips_id?: string | null
          tips_ja?: string | null
          tips_ka?: string | null
          tips_kk?: string | null
          tips_ko?: string | null
          tips_nl?: string | null
          tips_pl?: string | null
          tips_pt?: string | null
          tips_ru?: string | null
          tips_sv?: string | null
          tips_tr?: string | null
          tips_uz?: string | null
          tips_vi?: string | null
          tips_zh?: string | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
          week_end?: number
          week_start?: number
        }
        Relationships: []
      }
      baby_daily_info: {
        Row: {
          created_at: string
          day_number: number
          id: string
          info: string
          info_ar: string | null
          info_de: string | null
          info_en: string | null
          info_es: string | null
          info_fr: string | null
          info_hi: string | null
          info_id: string | null
          info_ja: string | null
          info_ka: string | null
          info_kk: string | null
          info_ko: string | null
          info_nl: string | null
          info_pl: string | null
          info_pt: string | null
          info_ru: string | null
          info_sv: string | null
          info_tr: string | null
          info_uz: string | null
          info_vi: string | null
          info_zh: string | null
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          info: string
          info_ar?: string | null
          info_de?: string | null
          info_en?: string | null
          info_es?: string | null
          info_fr?: string | null
          info_hi?: string | null
          info_id?: string | null
          info_ja?: string | null
          info_ka?: string | null
          info_kk?: string | null
          info_ko?: string | null
          info_nl?: string | null
          info_pl?: string | null
          info_pt?: string | null
          info_ru?: string | null
          info_sv?: string | null
          info_tr?: string | null
          info_uz?: string | null
          info_vi?: string | null
          info_zh?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          info?: string
          info_ar?: string | null
          info_de?: string | null
          info_en?: string | null
          info_es?: string | null
          info_fr?: string | null
          info_hi?: string | null
          info_id?: string | null
          info_ja?: string | null
          info_ka?: string | null
          info_kk?: string | null
          info_ko?: string | null
          info_nl?: string | null
          info_pl?: string | null
          info_pt?: string | null
          info_ru?: string | null
          info_sv?: string | null
          info_tr?: string | null
          info_uz?: string | null
          info_vi?: string | null
          info_zh?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      baby_growth: {
        Row: {
          child_id: string | null
          created_at: string
          entry_date: string
          head_cm: number | null
          height_cm: number | null
          id: string
          notes: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          entry_date?: string
          head_cm?: number | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          child_id?: string | null
          created_at?: string
          entry_date?: string
          head_cm?: number | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "baby_growth_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "user_children"
            referencedColumns: ["id"]
          },
        ]
      }
      baby_logs: {
        Row: {
          amount_ml: number | null
          child_id: string | null
          created_at: string
          diaper_type: string | null
          end_time: string | null
          feed_type: string | null
          id: string
          log_type: string
          notes: string | null
          start_time: string
          user_id: string
        }
        Insert: {
          amount_ml?: number | null
          child_id?: string | null
          created_at?: string
          diaper_type?: string | null
          end_time?: string | null
          feed_type?: string | null
          id?: string
          log_type: string
          notes?: string | null
          start_time?: string
          user_id: string
        }
        Update: {
          amount_ml?: number | null
          child_id?: string | null
          created_at?: string
          diaper_type?: string | null
          end_time?: string | null
          feed_type?: string | null
          id?: string
          log_type?: string
          notes?: string | null
          start_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "baby_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "user_children"
            referencedColumns: ["id"]
          },
        ]
      }
      baby_milestones: {
        Row: {
          achieved_at: string
          child_id: string | null
          created_at: string
          id: string
          milestone_id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          achieved_at?: string
          child_id?: string | null
          created_at?: string
          id?: string
          milestone_id: string
          notes?: string | null
          user_id: string
        }
        Update: {
          achieved_at?: string
          child_id?: string | null
          created_at?: string
          id?: string
          milestone_id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "baby_milestones_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "user_children"
            referencedColumns: ["id"]
          },
        ]
      }
      baby_milestones_db: {
        Row: {
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          milestone_key: string
          sort_order: number | null
          week_number: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          milestone_key: string
          sort_order?: number | null
          week_number: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          milestone_key?: string
          sort_order?: number | null
          week_number?: number
        }
        Relationships: []
      }
      baby_month_illustrations: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          image_url: string
          is_active: boolean
          month_number: number
          sort_order: number
          title: string | null
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          month_number: number
          sort_order?: number
          title?: string | null
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          month_number?: number
          sort_order?: number
          title?: string | null
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      baby_names_db: {
        Row: {
          created_at: string
          gender: string
          id: string
          is_active: boolean | null
          lang: string
          meaning: string | null
          meaning_ar: string | null
          meaning_az: string | null
          meaning_de: string | null
          meaning_en: string | null
          meaning_es: string | null
          meaning_fr: string | null
          meaning_hi: string | null
          meaning_id: string | null
          meaning_ja: string | null
          meaning_ka: string | null
          meaning_kk: string | null
          meaning_ko: string | null
          meaning_nl: string | null
          meaning_pl: string | null
          meaning_pt: string | null
          meaning_ru: string | null
          meaning_sv: string | null
          meaning_tr: string | null
          meaning_uz: string | null
          meaning_vi: string | null
          meaning_zh: string | null
          name: string
          origin: string | null
          origin_ar: string | null
          origin_de: string | null
          origin_en: string | null
          origin_es: string | null
          origin_fr: string | null
          origin_hi: string | null
          origin_id: string | null
          origin_ja: string | null
          origin_ka: string | null
          origin_kk: string | null
          origin_ko: string | null
          origin_nl: string | null
          origin_pl: string | null
          origin_pt: string | null
          origin_ru: string | null
          origin_sv: string | null
          origin_tr: string | null
          origin_uz: string | null
          origin_vi: string | null
          origin_zh: string | null
          popularity: number | null
        }
        Insert: {
          created_at?: string
          gender?: string
          id?: string
          is_active?: boolean | null
          lang?: string
          meaning?: string | null
          meaning_ar?: string | null
          meaning_az?: string | null
          meaning_de?: string | null
          meaning_en?: string | null
          meaning_es?: string | null
          meaning_fr?: string | null
          meaning_hi?: string | null
          meaning_id?: string | null
          meaning_ja?: string | null
          meaning_ka?: string | null
          meaning_kk?: string | null
          meaning_ko?: string | null
          meaning_nl?: string | null
          meaning_pl?: string | null
          meaning_pt?: string | null
          meaning_ru?: string | null
          meaning_sv?: string | null
          meaning_tr?: string | null
          meaning_uz?: string | null
          meaning_vi?: string | null
          meaning_zh?: string | null
          name: string
          origin?: string | null
          origin_ar?: string | null
          origin_de?: string | null
          origin_en?: string | null
          origin_es?: string | null
          origin_fr?: string | null
          origin_hi?: string | null
          origin_id?: string | null
          origin_ja?: string | null
          origin_ka?: string | null
          origin_kk?: string | null
          origin_ko?: string | null
          origin_nl?: string | null
          origin_pl?: string | null
          origin_pt?: string | null
          origin_ru?: string | null
          origin_sv?: string | null
          origin_tr?: string | null
          origin_uz?: string | null
          origin_vi?: string | null
          origin_zh?: string | null
          popularity?: number | null
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          is_active?: boolean | null
          lang?: string
          meaning?: string | null
          meaning_ar?: string | null
          meaning_az?: string | null
          meaning_de?: string | null
          meaning_en?: string | null
          meaning_es?: string | null
          meaning_fr?: string | null
          meaning_hi?: string | null
          meaning_id?: string | null
          meaning_ja?: string | null
          meaning_ka?: string | null
          meaning_kk?: string | null
          meaning_ko?: string | null
          meaning_nl?: string | null
          meaning_pl?: string | null
          meaning_pt?: string | null
          meaning_ru?: string | null
          meaning_sv?: string | null
          meaning_tr?: string | null
          meaning_uz?: string | null
          meaning_vi?: string | null
          meaning_zh?: string | null
          name?: string
          origin?: string | null
          origin_ar?: string | null
          origin_de?: string | null
          origin_en?: string | null
          origin_es?: string | null
          origin_fr?: string | null
          origin_hi?: string | null
          origin_id?: string | null
          origin_ja?: string | null
          origin_ka?: string | null
          origin_kk?: string | null
          origin_ko?: string | null
          origin_nl?: string | null
          origin_pl?: string | null
          origin_pt?: string | null
          origin_ru?: string | null
          origin_sv?: string | null
          origin_tr?: string | null
          origin_uz?: string | null
          origin_vi?: string | null
          origin_zh?: string | null
          popularity?: number | null
        }
        Relationships: []
      }
      baby_photos: {
        Row: {
          background_theme: string
          created_at: string
          customization: Json | null
          id: string
          prompt: string
          source_image_path: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          background_theme: string
          created_at?: string
          customization?: Json | null
          id?: string
          prompt: string
          source_image_path?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          background_theme?: string
          created_at?: string
          customization?: Json | null
          id?: string
          prompt?: string
          source_image_path?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      baby_teeth_db: {
        Row: {
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          position: string
          side: string
          sort_order: number | null
          svg_path_id: string | null
          tooth_code: string
          tooth_type: string
          typical_emergence_months_max: number | null
          typical_emergence_months_min: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          position: string
          side: string
          sort_order?: number | null
          svg_path_id?: string | null
          tooth_code: string
          tooth_type: string
          typical_emergence_months_max?: number | null
          typical_emergence_months_min?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          position?: string
          side?: string
          sort_order?: number | null
          svg_path_id?: string | null
          tooth_code?: string
          tooth_type?: string
          typical_emergence_months_max?: number | null
          typical_emergence_months_min?: number | null
        }
        Relationships: []
      }
      banner_impressions: {
        Row: {
          banner_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          seen_count: number
          user_id: string
        }
        Insert: {
          banner_id: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          seen_count?: number
          user_id: string
        }
        Update: {
          banner_id?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          seen_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banner_impressions_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "banners"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          background_color: string | null
          banner_type: string | null
          button_text: string | null
          button_text_az: string | null
          button_text_en: string | null
          button_text_es: string | null
          button_text_fr: string | null
          button_text_hi: string | null
          button_text_id: string | null
          button_text_ja: string | null
          button_text_ko: string | null
          button_text_nl: string | null
          button_text_pl: string | null
          button_text_pt: string | null
          button_text_ru: string | null
          button_text_sv: string | null
          button_text_tr: string | null
          button_text_vi: string | null
          button_text_zh: string | null
          click_count: number | null
          created_at: string | null
          description: string | null
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_premium_only: boolean | null
          link_type: string | null
          link_url: string | null
          max_impressions_per_user: number | null
          placement: string
          sort_order: number | null
          start_date: string | null
          target_countries: string[] | null
          target_languages: string[] | null
          target_life_stages: string[] | null
          text_color: string | null
          title: string
          title_az: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          background_color?: string | null
          banner_type?: string | null
          button_text?: string | null
          button_text_az?: string | null
          button_text_en?: string | null
          button_text_es?: string | null
          button_text_fr?: string | null
          button_text_hi?: string | null
          button_text_id?: string | null
          button_text_ja?: string | null
          button_text_ko?: string | null
          button_text_nl?: string | null
          button_text_pl?: string | null
          button_text_pt?: string | null
          button_text_ru?: string | null
          button_text_sv?: string | null
          button_text_tr?: string | null
          button_text_vi?: string | null
          button_text_zh?: string | null
          click_count?: number | null
          created_at?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_premium_only?: boolean | null
          link_type?: string | null
          link_url?: string | null
          max_impressions_per_user?: number | null
          placement: string
          sort_order?: number | null
          start_date?: string | null
          target_countries?: string[] | null
          target_languages?: string[] | null
          target_life_stages?: string[] | null
          text_color?: string | null
          title: string
          title_az?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          background_color?: string | null
          banner_type?: string | null
          button_text?: string | null
          button_text_az?: string | null
          button_text_en?: string | null
          button_text_es?: string | null
          button_text_fr?: string | null
          button_text_hi?: string | null
          button_text_id?: string | null
          button_text_ja?: string | null
          button_text_ko?: string | null
          button_text_nl?: string | null
          button_text_pl?: string | null
          button_text_pt?: string | null
          button_text_ru?: string | null
          button_text_sv?: string | null
          button_text_tr?: string | null
          button_text_vi?: string | null
          button_text_zh?: string | null
          click_count?: number | null
          created_at?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_premium_only?: boolean | null
          link_type?: string | null
          link_url?: string | null
          max_impressions_per_user?: number | null
          placement?: string
          sort_order?: number | null
          start_date?: string | null
          target_countries?: string[] | null
          target_languages?: string[] | null
          target_life_stages?: string[] | null
          text_color?: string | null
          title?: string
          title_az?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      blog_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          likes_count: number | null
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          category: string
          category_en: string | null
          comments_count: number | null
          content: string
          content_ar: string | null
          content_az: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          countries_exclude: string[] | null
          countries_include: string[] | null
          cover_image_url: string | null
          created_at: string
          editorial_metadata: Json | null
          excerpt: string | null
          excerpt_ar: string | null
          excerpt_az: string | null
          excerpt_de: string | null
          excerpt_en: string | null
          excerpt_es: string | null
          excerpt_fr: string | null
          excerpt_hi: string | null
          excerpt_id: string | null
          excerpt_ja: string | null
          excerpt_ka: string | null
          excerpt_kk: string | null
          excerpt_ko: string | null
          excerpt_nl: string | null
          excerpt_pl: string | null
          excerpt_pt: string | null
          excerpt_ru: string | null
          excerpt_sv: string | null
          excerpt_tr: string | null
          excerpt_uz: string | null
          excerpt_vi: string | null
          excerpt_zh: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          life_stage: string | null
          likes_count: number | null
          reading_time: number | null
          saves_count: number | null
          slug: string
          tags: string[] | null
          tags_en: string[] | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          category?: string
          category_en?: string | null
          comments_count?: number | null
          content: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          countries_exclude?: string[] | null
          countries_include?: string[] | null
          cover_image_url?: string | null
          created_at?: string
          editorial_metadata?: Json | null
          excerpt?: string | null
          excerpt_ar?: string | null
          excerpt_az?: string | null
          excerpt_de?: string | null
          excerpt_en?: string | null
          excerpt_es?: string | null
          excerpt_fr?: string | null
          excerpt_hi?: string | null
          excerpt_id?: string | null
          excerpt_ja?: string | null
          excerpt_ka?: string | null
          excerpt_kk?: string | null
          excerpt_ko?: string | null
          excerpt_nl?: string | null
          excerpt_pl?: string | null
          excerpt_pt?: string | null
          excerpt_ru?: string | null
          excerpt_sv?: string | null
          excerpt_tr?: string | null
          excerpt_uz?: string | null
          excerpt_vi?: string | null
          excerpt_zh?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          life_stage?: string | null
          likes_count?: number | null
          reading_time?: number | null
          saves_count?: number | null
          slug: string
          tags?: string[] | null
          tags_en?: string[] | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          category?: string
          category_en?: string | null
          comments_count?: number | null
          content?: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          countries_exclude?: string[] | null
          countries_include?: string[] | null
          cover_image_url?: string | null
          created_at?: string
          editorial_metadata?: Json | null
          excerpt?: string | null
          excerpt_ar?: string | null
          excerpt_az?: string | null
          excerpt_de?: string | null
          excerpt_en?: string | null
          excerpt_es?: string | null
          excerpt_fr?: string | null
          excerpt_hi?: string | null
          excerpt_id?: string | null
          excerpt_ja?: string | null
          excerpt_ka?: string | null
          excerpt_kk?: string | null
          excerpt_ko?: string | null
          excerpt_nl?: string | null
          excerpt_pl?: string | null
          excerpt_pt?: string | null
          excerpt_ru?: string | null
          excerpt_sv?: string | null
          excerpt_tr?: string | null
          excerpt_uz?: string | null
          excerpt_vi?: string | null
          excerpt_zh?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          life_stage?: string | null
          likes_count?: number | null
          reading_time?: number | null
          saves_count?: number | null
          slug?: string
          tags?: string[] | null
          tags_en?: string[] | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      blood_pressure_logs: {
        Row: {
          created_at: string
          diastolic: number
          id: string
          measured_at: string
          notes: string | null
          pulse: number | null
          systolic: number
          user_id: string
        }
        Insert: {
          created_at?: string
          diastolic: number
          id?: string
          measured_at?: string
          notes?: string | null
          pulse?: number | null
          systolic: number
          user_id: string
        }
        Update: {
          created_at?: string
          diastolic?: number
          id?: string
          measured_at?: string
          notes?: string | null
          pulse?: number | null
          systolic?: number
          user_id?: string
        }
        Relationships: []
      }
      blood_sugar_logs: {
        Row: {
          created_at: string | null
          id: string
          logged_at: string | null
          meal_context: string | null
          notes: string | null
          reading_type: string
          reading_value: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logged_at?: string | null
          meal_context?: string | null
          notes?: string | null
          reading_type?: string
          reading_value: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logged_at?: string | null
          meal_context?: string | null
          notes?: string | null
          reading_type?: string
          reading_value?: number
          user_id?: string
        }
        Relationships: []
      }
      breathing_exercises: {
        Row: {
          benefits: string[] | null
          benefits_az: string[] | null
          benefits_en: string | null
          benefits_ru: string | null
          benefits_tr: string | null
          color: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          exhale_seconds: number
          hold_after_exhale_seconds: number | null
          hold_seconds: number | null
          icon: string | null
          id: string
          inhale_seconds: number
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
          total_cycles: number | null
        }
        Insert: {
          benefits?: string[] | null
          benefits_az?: string[] | null
          benefits_en?: string | null
          benefits_ru?: string | null
          benefits_tr?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          exhale_seconds?: number
          hold_after_exhale_seconds?: number | null
          hold_seconds?: number | null
          icon?: string | null
          id?: string
          inhale_seconds?: number
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          total_cycles?: number | null
        }
        Update: {
          benefits?: string[] | null
          benefits_az?: string[] | null
          benefits_en?: string | null
          benefits_ru?: string | null
          benefits_tr?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          exhale_seconds?: number
          hold_after_exhale_seconds?: number | null
          hold_seconds?: number | null
          icon?: string | null
          id?: string
          inhale_seconds?: number
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          total_cycles?: number | null
        }
        Relationships: []
      }
      bulk_push_notifications: {
        Row: {
          audience_snapshot: Json | null
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          scheduled_at: string | null
          segment: Json | null
          sent_at: string | null
          status: string | null
          target_audience: string
          title: string
          total_failed: number | null
          total_sent: number | null
        }
        Insert: {
          audience_snapshot?: Json | null
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          scheduled_at?: string | null
          segment?: Json | null
          sent_at?: string | null
          status?: string | null
          target_audience?: string
          title: string
          total_failed?: number | null
          total_sent?: number | null
        }
        Update: {
          audience_snapshot?: Json | null
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          scheduled_at?: string | null
          segment?: Json | null
          sent_at?: string | null
          status?: string | null
          target_audience?: string
          title?: string
          total_failed?: number | null
          total_sent?: number | null
        }
        Relationships: []
      }
      cake_orders: {
        Row: {
          cake_id: string | null
          child_age_months: number | null
          child_name: string | null
          contact_phone: string | null
          created_at: string
          custom_fields: Json | null
          custom_text: string | null
          customer_name: string
          delivery_address: string | null
          delivery_date: string | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_status: string | null
          status: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cake_id?: string | null
          child_age_months?: number | null
          child_name?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json | null
          custom_text?: string | null
          customer_name: string
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cake_id?: string | null
          child_age_months?: number | null
          child_name?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json | null
          custom_text?: string | null
          customer_name?: string
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cake_orders_cake_id_fkey"
            columns: ["cake_id"]
            isOneToOne: false
            referencedRelation: "cakes"
            referencedColumns: ["id"]
          },
        ]
      }
      cakes: {
        Row: {
          category: string
          created_at: string
          custom_field_labels: Json | null
          description: string | null
          description_ar: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          has_custom_fields: boolean | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          milestone_label: string | null
          milestone_label_ar: string | null
          milestone_label_de: string | null
          milestone_label_en: string | null
          milestone_label_es: string | null
          milestone_label_fr: string | null
          milestone_label_hi: string | null
          milestone_label_id: string | null
          milestone_label_ja: string | null
          milestone_label_ka: string | null
          milestone_label_kk: string | null
          milestone_label_ko: string | null
          milestone_label_nl: string | null
          milestone_label_pl: string | null
          milestone_label_pt: string | null
          milestone_label_ru: string | null
          milestone_label_sv: string | null
          milestone_label_tr: string | null
          milestone_label_uz: string | null
          milestone_label_vi: string | null
          milestone_label_zh: string | null
          milestone_type: string | null
          month_number: number | null
          name: string
          name_ar: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          price: number
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          custom_field_labels?: Json | null
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          has_custom_fields?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          milestone_label?: string | null
          milestone_label_ar?: string | null
          milestone_label_de?: string | null
          milestone_label_en?: string | null
          milestone_label_es?: string | null
          milestone_label_fr?: string | null
          milestone_label_hi?: string | null
          milestone_label_id?: string | null
          milestone_label_ja?: string | null
          milestone_label_ka?: string | null
          milestone_label_kk?: string | null
          milestone_label_ko?: string | null
          milestone_label_nl?: string | null
          milestone_label_pl?: string | null
          milestone_label_pt?: string | null
          milestone_label_ru?: string | null
          milestone_label_sv?: string | null
          milestone_label_tr?: string | null
          milestone_label_uz?: string | null
          milestone_label_vi?: string | null
          milestone_label_zh?: string | null
          milestone_type?: string | null
          month_number?: number | null
          name: string
          name_ar?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          price?: number
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          custom_field_labels?: Json | null
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          has_custom_fields?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          milestone_label?: string | null
          milestone_label_ar?: string | null
          milestone_label_de?: string | null
          milestone_label_en?: string | null
          milestone_label_es?: string | null
          milestone_label_fr?: string | null
          milestone_label_hi?: string | null
          milestone_label_id?: string | null
          milestone_label_ja?: string | null
          milestone_label_ka?: string | null
          milestone_label_kk?: string | null
          milestone_label_ko?: string | null
          milestone_label_nl?: string | null
          milestone_label_pl?: string | null
          milestone_label_pt?: string | null
          milestone_label_ru?: string | null
          milestone_label_sv?: string | null
          milestone_label_tr?: string | null
          milestone_label_uz?: string | null
          milestone_label_vi?: string | null
          milestone_label_zh?: string | null
          milestone_type?: string | null
          month_number?: number | null
          name?: string
          name_ar?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          price?: number
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          direct_message_id: string | null
          emoji: string
          group_message_id: string | null
          id: string
          partner_message_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          direct_message_id?: string | null
          emoji: string
          group_message_id?: string | null
          id?: string
          partner_message_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          direct_message_id?: string | null
          emoji?: string
          group_message_id?: string | null
          id?: string
          partner_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_direct_message_id_fkey"
            columns: ["direct_message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_group_message_id_fkey"
            columns: ["group_message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reactions_partner_message_id_fkey"
            columns: ["partner_message_id"]
            isOneToOne: false
            referencedRelation: "partner_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      child_vaccinations: {
        Row: {
          administered_at: string | null
          batch_number: string | null
          child_id: string
          country_code: string
          created_at: string
          id: string
          is_skipped: boolean
          location_az: string | null
          location_en: string | null
          location_ru: string | null
          location_tr: string | null
          notes: string | null
          reminder_sent_at: string | null
          skip_reason: string | null
          updated_at: string
          user_id: string
          vaccine_schedule_id: string
        }
        Insert: {
          administered_at?: string | null
          batch_number?: string | null
          child_id: string
          country_code: string
          created_at?: string
          id?: string
          is_skipped?: boolean
          location_az?: string | null
          location_en?: string | null
          location_ru?: string | null
          location_tr?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          skip_reason?: string | null
          updated_at?: string
          user_id: string
          vaccine_schedule_id: string
        }
        Update: {
          administered_at?: string | null
          batch_number?: string | null
          child_id?: string
          country_code?: string
          created_at?: string
          id?: string
          is_skipped?: boolean
          location_az?: string | null
          location_en?: string | null
          location_ru?: string | null
          location_tr?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          skip_reason?: string | null
          updated_at?: string
          user_id?: string
          vaccine_schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_vaccinations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "user_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_vaccinations_vaccine_schedule_id_fkey"
            columns: ["vaccine_schedule_id"]
            isOneToOne: false
            referencedRelation: "vaccine_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      common_foods: {
        Row: {
          calories: number
          category: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          meal_types: string[] | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          calories: number
          category?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          meal_types?: string[] | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          calories?: number
          category?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          meal_types?: string[] | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      communication_push_claims: {
        Row: {
          claimed_at: string
          interaction_id: string
          kind: string
          target_user_id: string
        }
        Insert: {
          claimed_at?: string
          interaction_id: string
          kind: string
          target_user_id: string
        }
        Update: {
          claimed_at?: string
          interaction_id?: string
          kind?: string
          target_user_id?: string
        }
        Relationships: []
      }
      community_ad_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error_code: string | null
          event: string
          finished_at: string | null
          id: string
          lease_id: string | null
          lease_until: string | null
          next_attempt_at: string
          notice_round: number
          payload: Json
          review_id: string
          state: string
          token_hash: string | null
          token_id: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error_code?: string | null
          event: string
          finished_at?: string | null
          id?: string
          lease_id?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          notice_round?: number
          payload: Json
          review_id: string
          state?: string
          token_hash?: string | null
          token_id?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error_code?: string | null
          event?: string
          finished_at?: string | null
          id?: string
          lease_id?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          notice_round?: number
          payload?: Json
          review_id?: string
          state?: string
          token_hash?: string | null
          token_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_ad_deliveries_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "community_ad_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      community_ad_review_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: Json
          event: string
          id: string
          request_id: string | null
          review_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
          request_id?: string | null
          review_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          request_id?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_ad_review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "community_ad_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      community_ad_reviews: {
        Row: {
          assessment: Json | null
          attempts: number
          author_id: string
          content_hash: string
          created_at: string
          decision_reason: string | null
          id: string
          language: string | null
          last_error: string | null
          lease_id: string | null
          lease_until: string | null
          moderator_note: string | null
          next_attempt_at: string
          payload: Json
          post_id: string | null
          review_round: number
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number
          state: string
          updated_at: string
        }
        Insert: {
          assessment?: Json | null
          attempts?: number
          author_id: string
          content_hash: string
          created_at?: string
          decision_reason?: string | null
          id?: string
          language?: string | null
          last_error?: string | null
          lease_id?: string | null
          lease_until?: string | null
          moderator_note?: string | null
          next_attempt_at?: string
          payload: Json
          post_id?: string | null
          review_round?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision: number
          state?: string
          updated_at?: string
        }
        Update: {
          assessment?: Json | null
          attempts?: number
          author_id?: string
          content_hash?: string
          created_at?: string
          decision_reason?: string | null
          id?: string
          language?: string | null
          last_error?: string | null
          lease_id?: string | null
          lease_until?: string | null
          moderator_note?: string | null
          next_attempt_at?: string
          payload?: Json
          post_id?: string | null
          review_round?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_ad_reviews_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_ad_worker_state: {
        Row: {
          last_seen_at: string
          name: string
          report: Json
          run_id: string
        }
        Insert: {
          last_seen_at: string
          name: string
          report: Json
          run_id: string
        }
        Update: {
          last_seen_at?: string
          name?: string
          report?: Json
          run_id?: string
        }
        Relationships: []
      }
      community_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      community_groups: {
        Row: {
          auto_join_criteria: Json | null
          chat_posting_policy: string | null
          chat_visibility: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          description_en: string | null
          discovery_language: string | null
          group_type: string
          icon_emoji: string | null
          id: string
          is_active: boolean | null
          is_auto_join: boolean | null
          member_count: number | null
          name: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          auto_join_criteria?: Json | null
          chat_posting_policy?: string | null
          chat_visibility?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          discovery_language?: string | null
          group_type?: string
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_join?: boolean | null
          member_count?: number | null
          name: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          auto_join_criteria?: Json | null
          chat_posting_policy?: string | null
          chat_visibility?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_en?: string | null
          discovery_language?: string | null
          group_type?: string
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_join?: boolean | null
          member_count?: number | null
          name?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      community_post_bookmarks: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_reads: {
        Row: {
          id: string
          post_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          post_id: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          post_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_reads_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_translations: {
        Row: {
          content: string
          created_at: string
          id: string
          lang: string
          model: string | null
          post_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lang: string
          model?: string | null
          post_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lang?: string
          model?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          ad_moderated_at: string | null
          ad_moderation_revision: number | null
          ad_moderation_state: string | null
          blog_post_id: string | null
          comments_count: number | null
          comments_locked: boolean | null
          content: string
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean | null
          is_anonymous: boolean
          is_pinned: boolean | null
          language: string | null
          likes_count: number | null
          media_urls: string[] | null
          moderation_action_id: string | null
          moderation_edited_at: string | null
          moderation_edited_by: string | null
          moderation_reason: string | null
          moderation_removed_at: string | null
          moderation_version: number | null
          tagged_group_ids: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_moderated_at?: string | null
          ad_moderation_revision?: number | null
          ad_moderation_state?: string | null
          blog_post_id?: string | null
          comments_count?: number | null
          comments_locked?: boolean | null
          content: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean
          is_pinned?: boolean | null
          language?: string | null
          likes_count?: number | null
          media_urls?: string[] | null
          moderation_action_id?: string | null
          moderation_edited_at?: string | null
          moderation_edited_by?: string | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_version?: number | null
          tagged_group_ids?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_moderated_at?: string | null
          ad_moderation_revision?: number | null
          ad_moderation_state?: string | null
          blog_post_id?: string | null
          comments_count?: number | null
          comments_locked?: boolean | null
          content?: string
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean
          is_pinned?: boolean | null
          language?: string | null
          likes_count?: number | null
          media_urls?: string[] | null
          moderation_action_id?: string | null
          moderation_edited_at?: string | null
          moderation_edited_by?: string | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_version?: number | null
          tagged_group_ids?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_stories: {
        Row: {
          background_color: string | null
          created_at: string
          editor_layout: Json | null
          expires_at: string
          group_id: string | null
          id: string
          likes_count: number
          media_type: string
          media_url: string
          moderation_action_id: string | null
          moderation_edited_at: string | null
          moderation_edited_by: string | null
          moderation_reason: string | null
          moderation_removed_at: string | null
          moderation_version: number | null
          replies_count: number
          text_overlay: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          editor_layout?: Json | null
          expires_at?: string
          group_id?: string | null
          id?: string
          likes_count?: number
          media_type?: string
          media_url: string
          moderation_action_id?: string | null
          moderation_edited_at?: string | null
          moderation_edited_by?: string | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_version?: number | null
          replies_count?: number
          text_overlay?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          background_color?: string | null
          created_at?: string
          editor_layout?: Json | null
          expires_at?: string
          group_id?: string | null
          id?: string
          likes_count?: number
          media_type?: string
          media_url?: string
          moderation_action_id?: string | null
          moderation_edited_at?: string | null
          moderation_edited_by?: string | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_version?: number | null
          replies_count?: number
          text_overlay?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_stories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      contractions: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          interval_seconds: number | null
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          interval_seconds?: number | null
          start_time?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          interval_seconds?: number | null
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          created_at: string | null
          discount_amount: number
          id: string
          order_id: string | null
          order_type: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_type?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          order_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_to: string[]
          code: string
          created_at: string | null
          description: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_sv: string | null
          description_vi: string | null
          description_zh: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_amount: number | null
          starts_at: string | null
          updated_at: string | null
          used_count: number | null
        }
        Insert: {
          applicable_to?: string[]
          code: string
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_sv?: string | null
          description_vi?: string | null
          description_zh?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          starts_at?: string | null
          updated_at?: string | null
          used_count?: number | null
        }
        Update: {
          applicable_to?: string[]
          code?: string
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_sv?: string | null
          description_vi?: string | null
          description_zh?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          starts_at?: string | null
          updated_at?: string | null
          used_count?: number | null
        }
        Relationships: []
      }
      crash_reports: {
        Row: {
          app_version: string | null
          component_stack: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          extra_data: Json | null
          id: string
          platform: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          component_stack?: string | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          extra_data?: Json | null
          id?: string
          platform?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          component_stack?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          extra_data?: Json | null
          id?: string
          platform?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cry_analyses: {
        Row: {
          analysis_result: Json
          audio_duration_seconds: number | null
          confidence_score: number | null
          created_at: string
          cry_type: string | null
          id: string
          user_id: string
        }
        Insert: {
          analysis_result: Json
          audio_duration_seconds?: number | null
          confidence_score?: number | null
          created_at?: string
          cry_type?: string | null
          id?: string
          user_id: string
        }
        Update: {
          analysis_result?: Json
          audio_duration_seconds?: number | null
          confidence_score?: number | null
          created_at?: string
          cry_type?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      cry_type_labels: {
        Row: {
          color: string | null
          created_at: string | null
          cry_type: string
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          cry_type: string
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          cry_type?: string
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      customerio_audience_facts: {
        Row: {
          attempts: number
          checked_at: string | null
          claimed_revision: number | null
          covered_revision: number
          ever_paid: boolean
          ever_premium: boolean
          ever_trial: boolean
          last_error: string | null
          lease_id: string | null
          lease_until: string | null
          next_check_at: string
          provider_facts: Json | null
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          checked_at?: string | null
          claimed_revision?: number | null
          covered_revision?: number
          ever_paid?: boolean
          ever_premium?: boolean
          ever_trial?: boolean
          last_error?: string | null
          lease_id?: string | null
          lease_until?: string | null
          next_check_at?: string
          provider_facts?: Json | null
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          checked_at?: string | null
          claimed_revision?: number | null
          covered_revision?: number
          ever_paid?: boolean
          ever_premium?: boolean
          ever_trial?: boolean
          last_error?: string | null
          lease_id?: string | null
          lease_until?: string | null
          next_check_at?: string
          provider_facts?: Json | null
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customerio_sync_control: {
        Row: {
          backend: string
          backfill_seeded_at: string | null
          backfill_total: number
          cooldown_until: string | null
          created_at: string
          destination_id: string | null
          enabled: boolean
          last_error: string | null
          last_finished_at: string | null
          last_report: Json
          last_started_at: string | null
          last_success_at: string | null
          lease_until: string | null
          reconcile_after: string | null
          reconcile_at: string
          run_id: string | null
          singleton: boolean
          worker_token_hash: string | null
        }
        Insert: {
          backend: string
          backfill_seeded_at?: string | null
          backfill_total?: number
          cooldown_until?: string | null
          created_at?: string
          destination_id?: string | null
          enabled?: boolean
          last_error?: string | null
          last_finished_at?: string | null
          last_report?: Json
          last_started_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          reconcile_after?: string | null
          reconcile_at?: string
          run_id?: string | null
          singleton?: boolean
          worker_token_hash?: string | null
        }
        Update: {
          backend?: string
          backfill_seeded_at?: string | null
          backfill_total?: number
          cooldown_until?: string | null
          created_at?: string
          destination_id?: string | null
          enabled?: boolean
          last_error?: string | null
          last_finished_at?: string | null
          last_report?: Json
          last_started_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          reconcile_after?: string | null
          reconcile_at?: string
          run_id?: string | null
          singleton?: boolean
          worker_token_hash?: string | null
        }
        Relationships: []
      }
      customerio_sync_queue: {
        Row: {
          attempts: number
          claimed_deleted: boolean | null
          claimed_hash: string | null
          claimed_revision: number | null
          initial_backfill: boolean
          last_error: string | null
          last_http_status: number | null
          last_sent_at: string | null
          lease_id: string | null
          lease_until: string | null
          needs_resend: boolean
          next_attempt_at: string
          revision: number
          sent_deleted: boolean
          sent_hash: string | null
          sent_revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          claimed_deleted?: boolean | null
          claimed_hash?: string | null
          claimed_revision?: number | null
          initial_backfill?: boolean
          last_error?: string | null
          last_http_status?: number | null
          last_sent_at?: string | null
          lease_id?: string | null
          lease_until?: string | null
          needs_resend?: boolean
          next_attempt_at?: string
          revision?: number
          sent_deleted?: boolean
          sent_hash?: string | null
          sent_revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          claimed_deleted?: boolean | null
          claimed_hash?: string | null
          claimed_revision?: number | null
          initial_backfill?: boolean
          last_error?: string | null
          last_http_status?: number | null
          last_sent_at?: string | null
          lease_id?: string | null
          lease_until?: string | null
          needs_resend?: boolean
          next_attempt_at?: string
          revision?: number
          sent_deleted?: boolean
          sent_hash?: string | null
          sent_revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cycle_history: {
        Row: {
          created_at: string
          cycle_length: number | null
          cycle_number: number
          end_date: string | null
          id: string
          notes: string | null
          ovulation_date: string | null
          period_length: number | null
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_length?: number | null
          cycle_number: number
          end_date?: string | null
          id?: string
          notes?: string | null
          ovulation_date?: string | null
          period_length?: number | null
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_length?: number | null
          cycle_number?: number
          end_date?: string | null
          id?: string
          notes?: string | null
          ovulation_date?: string | null
          period_length?: number | null
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          bleeding: string | null
          created_at: string
          id: string
          log_date: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          symptoms: string[] | null
          temperature: number | null
          user_id: string
          water_intake: number | null
        }
        Insert: {
          bleeding?: string | null
          created_at?: string
          id?: string
          log_date?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          symptoms?: string[] | null
          temperature?: number | null
          user_id: string
          water_intake?: number | null
        }
        Update: {
          bleeding?: string | null
          created_at?: string
          id?: string
          log_date?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          symptoms?: string[] | null
          temperature?: number | null
          user_id?: string
          water_intake?: number | null
        }
        Relationships: []
      }
      daily_summaries: {
        Row: {
          contraction_count: number | null
          created_at: string
          id: string
          is_sent: boolean | null
          kick_count: number | null
          mood: number | null
          notes: string | null
          partner_user_id: string
          sent_at: string | null
          summary_date: string
          symptoms: string[] | null
          user_id: string
          water_intake: number | null
        }
        Insert: {
          contraction_count?: number | null
          created_at?: string
          id?: string
          is_sent?: boolean | null
          kick_count?: number | null
          mood?: number | null
          notes?: string | null
          partner_user_id: string
          sent_at?: string | null
          summary_date?: string
          symptoms?: string[] | null
          user_id: string
          water_intake?: number | null
        }
        Update: {
          contraction_count?: number | null
          created_at?: string
          id?: string
          is_sent?: boolean | null
          kick_count?: number | null
          mood?: number | null
          notes?: string | null
          partner_user_id?: string
          sent_at?: string | null
          summary_date?: string
          symptoms?: string[] | null
          user_id?: string
          water_intake?: number | null
        }
        Relationships: []
      }
      day_labels: {
        Row: {
          created_at: string | null
          day_key: string
          day_number: number
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          short_label: string | null
          short_label_az: string | null
          short_label_en: string | null
          short_label_es: string | null
          short_label_fr: string | null
          short_label_hi: string | null
          short_label_id: string | null
          short_label_ja: string | null
          short_label_ko: string | null
          short_label_nl: string | null
          short_label_pl: string | null
          short_label_pt: string | null
          short_label_ru: string | null
          short_label_sv: string | null
          short_label_tr: string | null
          short_label_vi: string | null
          short_label_zh: string | null
        }
        Insert: {
          created_at?: string | null
          day_key: string
          day_number: number
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          short_label?: string | null
          short_label_az?: string | null
          short_label_en?: string | null
          short_label_es?: string | null
          short_label_fr?: string | null
          short_label_hi?: string | null
          short_label_id?: string | null
          short_label_ja?: string | null
          short_label_ko?: string | null
          short_label_nl?: string | null
          short_label_pl?: string | null
          short_label_pt?: string | null
          short_label_ru?: string | null
          short_label_sv?: string | null
          short_label_tr?: string | null
          short_label_vi?: string | null
          short_label_zh?: string | null
        }
        Update: {
          created_at?: string | null
          day_key?: string
          day_number?: number
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          short_label?: string | null
          short_label_az?: string | null
          short_label_en?: string | null
          short_label_es?: string | null
          short_label_fr?: string | null
          short_label_hi?: string | null
          short_label_id?: string | null
          short_label_ja?: string | null
          short_label_ko?: string | null
          short_label_nl?: string | null
          short_label_pl?: string | null
          short_label_pt?: string | null
          short_label_ru?: string | null
          short_label_sv?: string | null
          short_label_tr?: string | null
          short_label_vi?: string | null
          short_label_zh?: string | null
        }
        Relationships: []
      }
      default_shopping_items: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          life_stage: string | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          priority: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          priority?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          priority?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      development_tips: {
        Row: {
          age_group: string
          content: string
          content_ar: string | null
          content_az: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string | null
          emoji: string
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
        }
        Insert: {
          age_group: string
          content: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Update: {
          age_group?: string
          content?: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string | null
          created_at: string
          duration_ms: number | null
          id: string
          is_read: boolean
          media_mime: string | null
          media_path: string | null
          media_url: string | null
          message_type: string
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          is_read?: boolean
          media_mime?: string | null
          media_path?: string | null
          media_url?: string | null
          message_type?: string
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          is_read?: boolean
          media_mime?: string | null
          media_path?: string | null
          media_url?: string | null
          message_type?: string
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_reply_v2"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      epds_assessments: {
        Row: {
          answers: Json
          completed_at: string | null
          id: string
          recommendation: string | null
          risk_level: string
          total_score: number
          user_id: string
        }
        Insert: {
          answers: Json
          completed_at?: string | null
          id?: string
          recommendation?: string | null
          risk_level: string
          total_score: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          id?: string
          recommendation?: string | null
          risk_level?: string
          total_score?: number
          user_id?: string
        }
        Relationships: []
      }
      epds_questions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_reverse_scored: boolean | null
          options: Json
          options_es: Json | null
          options_fr: Json | null
          options_hi: Json | null
          options_id: Json | null
          options_ja: Json | null
          options_ko: Json | null
          options_nl: Json | null
          options_pl: Json | null
          options_pt: Json | null
          options_sv: Json | null
          options_vi: Json | null
          options_zh: Json | null
          question_number: number
          question_text: string
          question_text_ar: string | null
          question_text_az: string | null
          question_text_de: string | null
          question_text_en: string | null
          question_text_es: string | null
          question_text_fr: string | null
          question_text_hi: string | null
          question_text_id: string | null
          question_text_ja: string | null
          question_text_ka: string | null
          question_text_kk: string | null
          question_text_ko: string | null
          question_text_nl: string | null
          question_text_pl: string | null
          question_text_pt: string | null
          question_text_ru: string | null
          question_text_sv: string | null
          question_text_tr: string | null
          question_text_uz: string | null
          question_text_vi: string | null
          question_text_zh: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_reverse_scored?: boolean | null
          options?: Json
          options_es?: Json | null
          options_fr?: Json | null
          options_hi?: Json | null
          options_id?: Json | null
          options_ja?: Json | null
          options_ko?: Json | null
          options_nl?: Json | null
          options_pl?: Json | null
          options_pt?: Json | null
          options_sv?: Json | null
          options_vi?: Json | null
          options_zh?: Json | null
          question_number: number
          question_text: string
          question_text_ar?: string | null
          question_text_az?: string | null
          question_text_de?: string | null
          question_text_en?: string | null
          question_text_es?: string | null
          question_text_fr?: string | null
          question_text_hi?: string | null
          question_text_id?: string | null
          question_text_ja?: string | null
          question_text_ka?: string | null
          question_text_kk?: string | null
          question_text_ko?: string | null
          question_text_nl?: string | null
          question_text_pl?: string | null
          question_text_pt?: string | null
          question_text_ru?: string | null
          question_text_sv?: string | null
          question_text_tr?: string | null
          question_text_uz?: string | null
          question_text_vi?: string | null
          question_text_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_reverse_scored?: boolean | null
          options?: Json
          options_es?: Json | null
          options_fr?: Json | null
          options_hi?: Json | null
          options_id?: Json | null
          options_ja?: Json | null
          options_ko?: Json | null
          options_nl?: Json | null
          options_pl?: Json | null
          options_pt?: Json | null
          options_sv?: Json | null
          options_vi?: Json | null
          options_zh?: Json | null
          question_number?: number
          question_text?: string
          question_text_ar?: string | null
          question_text_az?: string | null
          question_text_de?: string | null
          question_text_en?: string | null
          question_text_es?: string | null
          question_text_fr?: string | null
          question_text_hi?: string | null
          question_text_id?: string | null
          question_text_ja?: string | null
          question_text_ka?: string | null
          question_text_kk?: string | null
          question_text_ko?: string | null
          question_text_nl?: string | null
          question_text_pl?: string | null
          question_text_pt?: string | null
          question_text_ru?: string | null
          question_text_sv?: string | null
          question_text_tr?: string | null
          question_text_uz?: string | null
          question_text_vi?: string | null
          question_text_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      exercise_daily_tips: {
        Row: {
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          tip: string
          tip_az: string | null
          tip_en: string | null
          tip_es: string | null
          tip_fr: string | null
          tip_hi: string | null
          tip_id: string | null
          tip_ja: string | null
          tip_ko: string | null
          tip_nl: string | null
          tip_pl: string | null
          tip_pt: string | null
          tip_ru: string | null
          tip_sv: string | null
          tip_tr: string | null
          tip_vi: string | null
          tip_zh: string | null
          trimester: number[] | null
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          tip: string
          tip_az?: string | null
          tip_en?: string | null
          tip_es?: string | null
          tip_fr?: string | null
          tip_hi?: string | null
          tip_id?: string | null
          tip_ja?: string | null
          tip_ko?: string | null
          tip_nl?: string | null
          tip_pl?: string | null
          tip_pt?: string | null
          tip_ru?: string | null
          tip_sv?: string | null
          tip_tr?: string | null
          tip_vi?: string | null
          tip_zh?: string | null
          trimester?: number[] | null
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          tip?: string
          tip_az?: string | null
          tip_en?: string | null
          tip_es?: string | null
          tip_fr?: string | null
          tip_hi?: string | null
          tip_id?: string | null
          tip_ja?: string | null
          tip_ko?: string | null
          tip_nl?: string | null
          tip_pl?: string | null
          tip_pt?: string | null
          tip_ru?: string | null
          tip_sv?: string | null
          tip_tr?: string | null
          tip_vi?: string | null
          tip_zh?: string | null
          trimester?: number[] | null
        }
        Relationships: []
      }
      exercise_logs: {
        Row: {
          calories_burned: number
          completed_at: string
          duration_minutes: number
          exercise_id: string
          exercise_name: string
          id: string
          user_id: string
        }
        Insert: {
          calories_burned: number
          completed_at?: string
          duration_minutes: number
          exercise_id: string
          exercise_name: string
          id?: string
          user_id: string
        }
        Update: {
          calories_burned?: number
          completed_at?: string
          duration_minutes?: number
          exercise_id?: string
          exercise_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          calories: number
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          duration_minutes: number
          icon: string | null
          id: string
          is_active: boolean | null
          is_postpartum: boolean
          level: string
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          postpartum_delivery_types: string[] | null
          postpartum_week_end: number | null
          postpartum_week_start: number | null
          sort_order: number | null
          steps: Json | null
          steps_ar: Json | null
          steps_az: Json | null
          steps_de: Json | null
          steps_en: Json | null
          steps_es: Json | null
          steps_fr: Json | null
          steps_hi: Json | null
          steps_id: Json | null
          steps_ja: Json | null
          steps_ka: string[] | null
          steps_kk: Json | null
          steps_ko: Json | null
          steps_nl: Json | null
          steps_pl: Json | null
          steps_pt: Json | null
          steps_ru: Json | null
          steps_sv: Json | null
          steps_tr: Json | null
          steps_uz: Json | null
          steps_vi: Json | null
          steps_zh: Json | null
          trimester: number[] | null
          updated_at: string | null
        }
        Insert: {
          calories?: number
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          duration_minutes?: number
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_postpartum?: boolean
          level?: string
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          postpartum_delivery_types?: string[] | null
          postpartum_week_end?: number | null
          postpartum_week_start?: number | null
          sort_order?: number | null
          steps?: Json | null
          steps_ar?: Json | null
          steps_az?: Json | null
          steps_de?: Json | null
          steps_en?: Json | null
          steps_es?: Json | null
          steps_fr?: Json | null
          steps_hi?: Json | null
          steps_id?: Json | null
          steps_ja?: Json | null
          steps_ka?: string[] | null
          steps_kk?: Json | null
          steps_ko?: Json | null
          steps_nl?: Json | null
          steps_pl?: Json | null
          steps_pt?: Json | null
          steps_ru?: Json | null
          steps_sv?: Json | null
          steps_tr?: Json | null
          steps_uz?: Json | null
          steps_vi?: Json | null
          steps_zh?: Json | null
          trimester?: number[] | null
          updated_at?: string | null
        }
        Update: {
          calories?: number
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          duration_minutes?: number
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_postpartum?: boolean
          level?: string
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          postpartum_delivery_types?: string[] | null
          postpartum_week_end?: number | null
          postpartum_week_start?: number | null
          sort_order?: number | null
          steps?: Json | null
          steps_ar?: Json | null
          steps_az?: Json | null
          steps_de?: Json | null
          steps_en?: Json | null
          steps_es?: Json | null
          steps_fr?: Json | null
          steps_hi?: Json | null
          steps_id?: Json | null
          steps_ja?: Json | null
          steps_ka?: string[] | null
          steps_kk?: Json | null
          steps_ko?: Json | null
          steps_nl?: Json | null
          steps_pl?: Json | null
          steps_pt?: Json | null
          steps_ru?: Json | null
          steps_sv?: Json | null
          steps_tr?: Json | null
          steps_uz?: Json | null
          steps_vi?: Json | null
          steps_zh?: Json | null
          trimester?: number[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fairy_tale_themes: {
        Row: {
          cover_image_url: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          cover_image_url?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          cover_image_url?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      fairy_tales: {
        Row: {
          audio_url: string | null
          child_name: string | null
          content: string
          cover_image_url: string | null
          created_at: string | null
          duration_minutes: number | null
          hero: string | null
          id: string
          is_favorite: boolean | null
          moral_lesson: string | null
          play_count: number | null
          theme: string | null
          title: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          child_name?: string | null
          content: string
          cover_image_url?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          hero?: string | null
          id?: string
          is_favorite?: boolean | null
          moral_lesson?: string | null
          play_count?: number | null
          theme?: string | null
          title: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          child_name?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          hero?: string | null
          id?: string
          is_favorite?: boolean | null
          moral_lesson?: string | null
          play_count?: number | null
          theme?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          answer_ar: string | null
          answer_az: string | null
          answer_de: string | null
          answer_en: string | null
          answer_es: string | null
          answer_fr: string | null
          answer_hi: string | null
          answer_id: string | null
          answer_ja: string | null
          answer_ka: string | null
          answer_kk: string | null
          answer_ko: string | null
          answer_nl: string | null
          answer_pl: string | null
          answer_pt: string | null
          answer_ru: string | null
          answer_sv: string | null
          answer_tr: string | null
          answer_uz: string | null
          answer_vi: string | null
          answer_zh: string | null
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          question: string
          question_ar: string | null
          question_az: string | null
          question_de: string | null
          question_en: string | null
          question_es: string | null
          question_fr: string | null
          question_hi: string | null
          question_id: string | null
          question_ja: string | null
          question_ka: string | null
          question_kk: string | null
          question_ko: string | null
          question_nl: string | null
          question_pl: string | null
          question_pt: string | null
          question_ru: string | null
          question_sv: string | null
          question_tr: string | null
          question_uz: string | null
          question_vi: string | null
          question_zh: string | null
          sort_order: number | null
        }
        Insert: {
          answer: string
          answer_ar?: string | null
          answer_az?: string | null
          answer_de?: string | null
          answer_en?: string | null
          answer_es?: string | null
          answer_fr?: string | null
          answer_hi?: string | null
          answer_id?: string | null
          answer_ja?: string | null
          answer_ka?: string | null
          answer_kk?: string | null
          answer_ko?: string | null
          answer_nl?: string | null
          answer_pl?: string | null
          answer_pt?: string | null
          answer_ru?: string | null
          answer_sv?: string | null
          answer_tr?: string | null
          answer_uz?: string | null
          answer_vi?: string | null
          answer_zh?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question: string
          question_ar?: string | null
          question_az?: string | null
          question_de?: string | null
          question_en?: string | null
          question_es?: string | null
          question_fr?: string | null
          question_hi?: string | null
          question_id?: string | null
          question_ja?: string | null
          question_ka?: string | null
          question_kk?: string | null
          question_ko?: string | null
          question_nl?: string | null
          question_pl?: string | null
          question_pt?: string | null
          question_ru?: string | null
          question_sv?: string | null
          question_tr?: string | null
          question_uz?: string | null
          question_vi?: string | null
          question_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          answer?: string
          answer_ar?: string | null
          answer_az?: string | null
          answer_de?: string | null
          answer_en?: string | null
          answer_es?: string | null
          answer_fr?: string | null
          answer_hi?: string | null
          answer_id?: string | null
          answer_ja?: string | null
          answer_ka?: string | null
          answer_kk?: string | null
          answer_ko?: string | null
          answer_nl?: string | null
          answer_pl?: string | null
          answer_pt?: string | null
          answer_ru?: string | null
          answer_sv?: string | null
          answer_tr?: string | null
          answer_uz?: string | null
          answer_vi?: string | null
          answer_zh?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
          question_ar?: string | null
          question_az?: string | null
          question_de?: string | null
          question_en?: string | null
          question_es?: string | null
          question_fr?: string | null
          question_hi?: string | null
          question_id?: string | null
          question_ja?: string | null
          question_ka?: string | null
          question_kk?: string | null
          question_ko?: string | null
          question_nl?: string | null
          question_pl?: string | null
          question_pt?: string | null
          question_ru?: string | null
          question_sv?: string | null
          question_tr?: string | null
          question_uz?: string | null
          question_vi?: string | null
          question_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      favorite_names: {
        Row: {
          created_at: string
          gender: string
          id: string
          meaning: string | null
          name: string
          origin: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gender: string
          id?: string
          meaning?: string | null
          name: string
          origin?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          meaning?: string | null
          name?: string
          origin?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fetal_growth_scans: {
        Row: {
          baby_label: string
          created_at: string
          efw_grams: number
          id: string
          notes: string | null
          scan_date: string
          user_id: string
        }
        Insert: {
          baby_label?: string
          created_at?: string
          efw_grams: number
          id?: string
          notes?: string | null
          scan_date?: string
          user_id: string
        }
        Update: {
          baby_label?: string
          created_at?: string
          efw_grams?: number
          id?: string
          notes?: string | null
          scan_date?: string
          user_id?: string
        }
        Relationships: []
      }
      first_aid_scenarios: {
        Row: {
          color: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          emergency_level: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
        }
        Insert: {
          color?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emergency_level?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Update: {
          color?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emergency_level?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Relationships: []
      }
      first_aid_steps: {
        Row: {
          animation_url: string | null
          audio_url: string | null
          duration_seconds: number | null
          id: string
          image_url: string | null
          instruction: string
          instruction_ar: string | null
          instruction_az: string
          instruction_de: string | null
          instruction_en: string | null
          instruction_es: string | null
          instruction_fr: string | null
          instruction_hi: string | null
          instruction_id: string | null
          instruction_ja: string | null
          instruction_ka: string | null
          instruction_kk: string | null
          instruction_ko: string | null
          instruction_nl: string | null
          instruction_pl: string | null
          instruction_pt: string | null
          instruction_ru: string | null
          instruction_sv: string | null
          instruction_tr: string | null
          instruction_uz: string | null
          instruction_vi: string | null
          instruction_zh: string | null
          is_critical: boolean | null
          scenario_id: string
          step_number: number
          title: string
          title_ar: string | null
          title_az: string
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
        }
        Insert: {
          animation_url?: string | null
          audio_url?: string | null
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          instruction: string
          instruction_ar?: string | null
          instruction_az: string
          instruction_de?: string | null
          instruction_en?: string | null
          instruction_es?: string | null
          instruction_fr?: string | null
          instruction_hi?: string | null
          instruction_id?: string | null
          instruction_ja?: string | null
          instruction_ka?: string | null
          instruction_kk?: string | null
          instruction_ko?: string | null
          instruction_nl?: string | null
          instruction_pl?: string | null
          instruction_pt?: string | null
          instruction_ru?: string | null
          instruction_sv?: string | null
          instruction_tr?: string | null
          instruction_uz?: string | null
          instruction_vi?: string | null
          instruction_zh?: string | null
          is_critical?: boolean | null
          scenario_id: string
          step_number: number
          title: string
          title_ar?: string | null
          title_az: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Update: {
          animation_url?: string | null
          audio_url?: string | null
          duration_seconds?: number | null
          id?: string
          image_url?: string | null
          instruction?: string
          instruction_ar?: string | null
          instruction_az?: string
          instruction_de?: string | null
          instruction_en?: string | null
          instruction_es?: string | null
          instruction_fr?: string | null
          instruction_hi?: string | null
          instruction_id?: string | null
          instruction_ja?: string | null
          instruction_ka?: string | null
          instruction_kk?: string | null
          instruction_ko?: string | null
          instruction_nl?: string | null
          instruction_pl?: string | null
          instruction_pt?: string | null
          instruction_ru?: string | null
          instruction_sv?: string | null
          instruction_tr?: string | null
          instruction_uz?: string | null
          instruction_vi?: string | null
          instruction_zh?: string | null
          is_critical?: boolean | null
          scenario_id?: string
          step_number?: number
          title?: string
          title_ar?: string | null
          title_az?: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "first_aid_steps_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "first_aid_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_daily_logs: {
        Row: {
          cervical_mucus: string | null
          created_at: string
          energy_level: number | null
          flow_intensity: string | null
          id: string
          libido: number | null
          log_date: string
          mood: number | null
          notes: string | null
          ovulation_test: string | null
          pain_level: number | null
          sexual_activity: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          symptoms: string[] | null
          temperature: number | null
          updated_at: string
          user_id: string
          water_glasses: number | null
        }
        Insert: {
          cervical_mucus?: string | null
          created_at?: string
          energy_level?: number | null
          flow_intensity?: string | null
          id?: string
          libido?: number | null
          log_date?: string
          mood?: number | null
          notes?: string | null
          ovulation_test?: string | null
          pain_level?: number | null
          sexual_activity?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          symptoms?: string[] | null
          temperature?: number | null
          updated_at?: string
          user_id: string
          water_glasses?: number | null
        }
        Update: {
          cervical_mucus?: string | null
          created_at?: string
          energy_level?: number | null
          flow_intensity?: string | null
          id?: string
          libido?: number | null
          log_date?: string
          mood?: number | null
          notes?: string | null
          ovulation_test?: string | null
          pain_level?: number | null
          sexual_activity?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          symptoms?: string[] | null
          temperature?: number | null
          updated_at?: string
          user_id?: string
          water_glasses?: number | null
        }
        Relationships: []
      }
      flow_insights: {
        Row: {
          category: string | null
          content: string
          content_ar: string | null
          content_az: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          phase: string | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
        }
        Insert: {
          category?: string | null
          content: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          phase?: string | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          phase?: string | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Relationships: []
      }
      flow_phase_tips: {
        Row: {
          category: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          phase: string
          sort_order: number | null
          tip_text: string
          tip_text_ar: string | null
          tip_text_az: string | null
          tip_text_de: string | null
          tip_text_en: string | null
          tip_text_es: string | null
          tip_text_fr: string | null
          tip_text_hi: string | null
          tip_text_id: string | null
          tip_text_ja: string | null
          tip_text_ka: string | null
          tip_text_kk: string | null
          tip_text_ko: string | null
          tip_text_nl: string | null
          tip_text_pl: string | null
          tip_text_pt: string | null
          tip_text_ru: string | null
          tip_text_sv: string | null
          tip_text_tr: string | null
          tip_text_uz: string | null
          tip_text_vi: string | null
          tip_text_zh: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          phase: string
          sort_order?: number | null
          tip_text: string
          tip_text_ar?: string | null
          tip_text_az?: string | null
          tip_text_de?: string | null
          tip_text_en?: string | null
          tip_text_es?: string | null
          tip_text_fr?: string | null
          tip_text_hi?: string | null
          tip_text_id?: string | null
          tip_text_ja?: string | null
          tip_text_ka?: string | null
          tip_text_kk?: string | null
          tip_text_ko?: string | null
          tip_text_nl?: string | null
          tip_text_pl?: string | null
          tip_text_pt?: string | null
          tip_text_ru?: string | null
          tip_text_sv?: string | null
          tip_text_tr?: string | null
          tip_text_uz?: string | null
          tip_text_vi?: string | null
          tip_text_zh?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          phase?: string
          sort_order?: number | null
          tip_text?: string
          tip_text_ar?: string | null
          tip_text_az?: string | null
          tip_text_de?: string | null
          tip_text_en?: string | null
          tip_text_es?: string | null
          tip_text_fr?: string | null
          tip_text_hi?: string | null
          tip_text_id?: string | null
          tip_text_ja?: string | null
          tip_text_ka?: string | null
          tip_text_kk?: string | null
          tip_text_ko?: string | null
          tip_text_nl?: string | null
          tip_text_pl?: string | null
          tip_text_pt?: string | null
          tip_text_ru?: string | null
          tip_text_sv?: string | null
          tip_text_tr?: string | null
          tip_text_uz?: string | null
          tip_text_vi?: string | null
          tip_text_zh?: string | null
        }
        Relationships: []
      }
      flow_reminders: {
        Row: {
          created_at: string
          days_before: number | null
          id: string
          is_enabled: boolean | null
          message: string | null
          message_en: string | null
          reminder_type: string
          time_of_day: string | null
          title: string | null
          title_en: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_before?: number | null
          id?: string
          is_enabled?: boolean | null
          message?: string | null
          message_en?: string | null
          reminder_type: string
          time_of_day?: string | null
          title?: string | null
          title_en?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_before?: number | null
          id?: string
          is_enabled?: boolean | null
          message?: string | null
          message_en?: string | null
          reminder_type?: string
          time_of_day?: string | null
          title?: string | null
          title_en?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flow_symptoms: {
        Row: {
          category: string | null
          created_at: string | null
          emoji: string
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
          symptom_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          emoji: string
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          symptom_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          symptom_id?: string
        }
        Relationships: []
      }
      flow_symptoms_db: {
        Row: {
          category: string | null
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
          symptom_key: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          symptom_key: string
        }
        Update: {
          category?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          symptom_key?: string
        }
        Relationships: []
      }
      fruit_size_images: {
        Row: {
          created_at: string
          emoji: string
          fruit_name: string
          fruit_name_az: string | null
          fruit_name_en: string | null
          fruit_name_es: string | null
          fruit_name_fr: string | null
          fruit_name_hi: string | null
          fruit_name_id: string | null
          fruit_name_ja: string | null
          fruit_name_ko: string | null
          fruit_name_nl: string | null
          fruit_name_pl: string | null
          fruit_name_pt: string | null
          fruit_name_ru: string | null
          fruit_name_sv: string | null
          fruit_name_tr: string | null
          fruit_name_vi: string | null
          fruit_name_zh: string | null
          id: string
          image_url: string | null
          length_cm: number | null
          updated_at: string
          week_number: number
          weight_g: number | null
        }
        Insert: {
          created_at?: string
          emoji?: string
          fruit_name: string
          fruit_name_az?: string | null
          fruit_name_en?: string | null
          fruit_name_es?: string | null
          fruit_name_fr?: string | null
          fruit_name_hi?: string | null
          fruit_name_id?: string | null
          fruit_name_ja?: string | null
          fruit_name_ko?: string | null
          fruit_name_nl?: string | null
          fruit_name_pl?: string | null
          fruit_name_pt?: string | null
          fruit_name_ru?: string | null
          fruit_name_sv?: string | null
          fruit_name_tr?: string | null
          fruit_name_vi?: string | null
          fruit_name_zh?: string | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          updated_at?: string
          week_number: number
          weight_g?: number | null
        }
        Update: {
          created_at?: string
          emoji?: string
          fruit_name?: string
          fruit_name_az?: string | null
          fruit_name_en?: string | null
          fruit_name_es?: string | null
          fruit_name_fr?: string | null
          fruit_name_hi?: string | null
          fruit_name_id?: string | null
          fruit_name_ja?: string | null
          fruit_name_ko?: string | null
          fruit_name_nl?: string | null
          fruit_name_pl?: string | null
          fruit_name_pt?: string | null
          fruit_name_ru?: string | null
          fruit_name_sv?: string | null
          fruit_name_tr?: string | null
          fruit_name_vi?: string | null
          fruit_name_zh?: string | null
          id?: string
          image_url?: string | null
          length_cm?: number | null
          updated_at?: string
          week_number?: number
          weight_g?: number | null
        }
        Relationships: []
      }
      game_score_receipts: {
        Row: {
          created_at: string
          game_id: string
          level: number
          score: number
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          level: number
          score: number
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          level?: number
          score?: number
          submission_id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          best_level: number
          best_score: number
          created_at: string
          game_id: string
          id: string
          total_plays: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_level?: number
          best_score?: number
          created_at?: string
          game_id?: string
          id?: string
          total_plays?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_level?: number
          best_score?: number
          created_at?: string
          game_id?: string
          id?: string
          total_plays?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_chat_access: {
        Row: {
          actor_id: string | null
          created_at: string
          group_id: string
          id: string
          owner_id: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          owner_id?: string | null
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          owner_id?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chat_access_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string | null
          created_at: string
          duration_ms: number | null
          group_id: string
          id: string
          media_mime: string | null
          media_path: string | null
          message_type: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration_ms?: number | null
          group_id: string
          id?: string
          media_mime?: string | null
          media_path?: string | null
          message_type?: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration_ms?: number | null
          group_id?: string
          id?: string
          media_mime?: string | null
          media_path?: string | null
          message_type?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_provider_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_active: boolean
          provider_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_provider_reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "healthcare_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_providers: {
        Row: {
          accepts_reservations: boolean | null
          address: string | null
          address_ar: string | null
          address_az: string | null
          address_de: string | null
          address_en: string | null
          address_es: string | null
          address_fr: string | null
          address_hi: string | null
          address_id: string | null
          address_ja: string | null
          address_ka: string | null
          address_kk: string | null
          address_ko: string | null
          address_nl: string | null
          address_pl: string | null
          address_pt: string | null
          address_ru: string | null
          address_sv: string | null
          address_tr: string | null
          address_uz: string | null
          address_vi: string | null
          address_zh: string | null
          city: string | null
          country_code: string
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          email: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          phone: string | null
          provider_type: string
          rating: number | null
          review_count: number | null
          services: Json | null
          sort_order: number | null
          specialty: string | null
          specialty_ar: string | null
          specialty_az: string | null
          specialty_de: string | null
          specialty_en: string | null
          specialty_es: string | null
          specialty_fr: string | null
          specialty_hi: string | null
          specialty_id: string | null
          specialty_ja: string | null
          specialty_ka: string | null
          specialty_kk: string | null
          specialty_ko: string | null
          specialty_nl: string | null
          specialty_pl: string | null
          specialty_pt: string | null
          specialty_ru: string | null
          specialty_sv: string | null
          specialty_tr: string | null
          specialty_uz: string | null
          specialty_vi: string | null
          specialty_zh: string | null
          updated_at: string | null
          website: string | null
          working_hours: Json | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          address?: string | null
          address_ar?: string | null
          address_az?: string | null
          address_de?: string | null
          address_en?: string | null
          address_es?: string | null
          address_fr?: string | null
          address_hi?: string | null
          address_id?: string | null
          address_ja?: string | null
          address_ka?: string | null
          address_kk?: string | null
          address_ko?: string | null
          address_nl?: string | null
          address_pl?: string | null
          address_pt?: string | null
          address_ru?: string | null
          address_sv?: string | null
          address_tr?: string | null
          address_uz?: string | null
          address_vi?: string | null
          address_zh?: string | null
          city?: string | null
          country_code?: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          provider_type?: string
          rating?: number | null
          review_count?: number | null
          services?: Json | null
          sort_order?: number | null
          specialty?: string | null
          specialty_ar?: string | null
          specialty_az?: string | null
          specialty_de?: string | null
          specialty_en?: string | null
          specialty_es?: string | null
          specialty_fr?: string | null
          specialty_hi?: string | null
          specialty_id?: string | null
          specialty_ja?: string | null
          specialty_ka?: string | null
          specialty_kk?: string | null
          specialty_ko?: string | null
          specialty_nl?: string | null
          specialty_pl?: string | null
          specialty_pt?: string | null
          specialty_ru?: string | null
          specialty_sv?: string | null
          specialty_tr?: string | null
          specialty_uz?: string | null
          specialty_vi?: string | null
          specialty_zh?: string | null
          updated_at?: string | null
          website?: string | null
          working_hours?: Json | null
        }
        Update: {
          accepts_reservations?: boolean | null
          address?: string | null
          address_ar?: string | null
          address_az?: string | null
          address_de?: string | null
          address_en?: string | null
          address_es?: string | null
          address_fr?: string | null
          address_hi?: string | null
          address_id?: string | null
          address_ja?: string | null
          address_ka?: string | null
          address_kk?: string | null
          address_ko?: string | null
          address_nl?: string | null
          address_pl?: string | null
          address_pt?: string | null
          address_ru?: string | null
          address_sv?: string | null
          address_tr?: string | null
          address_uz?: string | null
          address_vi?: string | null
          address_zh?: string | null
          city?: string | null
          country_code?: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          provider_type?: string
          rating?: number | null
          review_count?: number | null
          services?: Json | null
          sort_order?: number | null
          specialty?: string | null
          specialty_ar?: string | null
          specialty_az?: string | null
          specialty_de?: string | null
          specialty_en?: string | null
          specialty_es?: string | null
          specialty_fr?: string | null
          specialty_hi?: string | null
          specialty_id?: string | null
          specialty_ja?: string | null
          specialty_ka?: string | null
          specialty_kk?: string | null
          specialty_ko?: string | null
          specialty_nl?: string | null
          specialty_pl?: string | null
          specialty_pt?: string | null
          specialty_ru?: string | null
          specialty_sv?: string | null
          specialty_tr?: string | null
          specialty_uz?: string | null
          specialty_vi?: string | null
          specialty_zh?: string | null
          updated_at?: string | null
          website?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      horoscope_elements: {
        Row: {
          color: string
          created_at: string | null
          element_key: string
          icon: string
          id: string
          is_active: boolean | null
          name: string
          name_az: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          element_key: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          color?: string
          created_at?: string | null
          element_key?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      horoscope_loading_steps: {
        Row: {
          created_at: string | null
          icon: string
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
          step_key: string
        }
        Insert: {
          created_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          step_key: string
        }
        Update: {
          created_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          step_key?: string
        }
        Relationships: []
      }
      horoscope_readings: {
        Row: {
          baby_sign: string | null
          compatibility_result: Json | null
          created_at: string | null
          dad_sign: string | null
          id: string
          mom_sign: string | null
          shared_count: number | null
          user_id: string
        }
        Insert: {
          baby_sign?: string | null
          compatibility_result?: Json | null
          created_at?: string | null
          dad_sign?: string | null
          id?: string
          mom_sign?: string | null
          shared_count?: number | null
          user_id: string
        }
        Update: {
          baby_sign?: string | null
          compatibility_result?: Json | null
          created_at?: string | null
          dad_sign?: string | null
          id?: string
          mom_sign?: string | null
          shared_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      hospital_bag_items: {
        Row: {
          added_by: string | null
          category: string
          created_at: string
          id: string
          is_checked: boolean
          item_id: string
          item_name: string
          item_name_en: string | null
          item_name_ru: string | null
          item_name_tr: string | null
          notes: string | null
          notes_en: string | null
          notes_ru: string | null
          notes_tr: string | null
          priority: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          category: string
          created_at?: string
          id?: string
          is_checked?: boolean
          item_id: string
          item_name: string
          item_name_en?: string | null
          item_name_ru?: string | null
          item_name_tr?: string | null
          notes?: string | null
          notes_en?: string | null
          notes_ru?: string | null
          notes_tr?: string | null
          priority?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          category?: string
          created_at?: string
          id?: string
          is_checked?: boolean
          item_id?: string
          item_name?: string
          item_name_en?: string | null
          item_name_ru?: string | null
          item_name_tr?: string | null
          notes?: string | null
          notes_en?: string | null
          notes_ru?: string | null
          notes_tr?: string | null
          priority?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hospital_bag_templates: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean | null
          is_essential: boolean | null
          item_name: string
          item_name_ar: string | null
          item_name_az: string | null
          item_name_de: string | null
          item_name_en: string | null
          item_name_es: string | null
          item_name_fr: string | null
          item_name_hi: string | null
          item_name_id: string | null
          item_name_ja: string | null
          item_name_ka: string | null
          item_name_kk: string | null
          item_name_ko: string | null
          item_name_nl: string | null
          item_name_pl: string | null
          item_name_pt: string | null
          item_name_ru: string | null
          item_name_sv: string | null
          item_name_tr: string | null
          item_name_uz: string | null
          item_name_vi: string | null
          item_name_zh: string | null
          notes: string | null
          notes_ar: string | null
          notes_de: string | null
          notes_en: string | null
          notes_es: string | null
          notes_fr: string | null
          notes_hi: string | null
          notes_id: string | null
          notes_ja: string | null
          notes_ka: string | null
          notes_kk: string | null
          notes_ko: string | null
          notes_nl: string | null
          notes_pl: string | null
          notes_pt: string | null
          notes_ru: string | null
          notes_sv: string | null
          notes_tr: string | null
          notes_uz: string | null
          notes_vi: string | null
          notes_zh: string | null
          priority: number | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_essential?: boolean | null
          item_name: string
          item_name_ar?: string | null
          item_name_az?: string | null
          item_name_de?: string | null
          item_name_en?: string | null
          item_name_es?: string | null
          item_name_fr?: string | null
          item_name_hi?: string | null
          item_name_id?: string | null
          item_name_ja?: string | null
          item_name_ka?: string | null
          item_name_kk?: string | null
          item_name_ko?: string | null
          item_name_nl?: string | null
          item_name_pl?: string | null
          item_name_pt?: string | null
          item_name_ru?: string | null
          item_name_sv?: string | null
          item_name_tr?: string | null
          item_name_uz?: string | null
          item_name_vi?: string | null
          item_name_zh?: string | null
          notes?: string | null
          notes_ar?: string | null
          notes_de?: string | null
          notes_en?: string | null
          notes_es?: string | null
          notes_fr?: string | null
          notes_hi?: string | null
          notes_id?: string | null
          notes_ja?: string | null
          notes_ka?: string | null
          notes_kk?: string | null
          notes_ko?: string | null
          notes_nl?: string | null
          notes_pl?: string | null
          notes_pt?: string | null
          notes_ru?: string | null
          notes_sv?: string | null
          notes_tr?: string | null
          notes_uz?: string | null
          notes_vi?: string | null
          notes_zh?: string | null
          priority?: number | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_essential?: boolean | null
          item_name?: string
          item_name_ar?: string | null
          item_name_az?: string | null
          item_name_de?: string | null
          item_name_en?: string | null
          item_name_es?: string | null
          item_name_fr?: string | null
          item_name_hi?: string | null
          item_name_id?: string | null
          item_name_ja?: string | null
          item_name_ka?: string | null
          item_name_kk?: string | null
          item_name_ko?: string | null
          item_name_nl?: string | null
          item_name_pl?: string | null
          item_name_pt?: string | null
          item_name_ru?: string | null
          item_name_sv?: string | null
          item_name_tr?: string | null
          item_name_uz?: string | null
          item_name_vi?: string | null
          item_name_zh?: string | null
          notes?: string | null
          notes_ar?: string | null
          notes_de?: string | null
          notes_en?: string | null
          notes_es?: string | null
          notes_fr?: string | null
          notes_hi?: string | null
          notes_id?: string | null
          notes_ja?: string | null
          notes_ka?: string | null
          notes_kk?: string | null
          notes_ko?: string | null
          notes_nl?: string | null
          notes_pl?: string | null
          notes_pt?: string | null
          notes_ru?: string | null
          notes_sv?: string | null
          notes_tr?: string | null
          notes_uz?: string | null
          notes_vi?: string | null
          notes_zh?: string | null
          priority?: number | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      intro_slides: {
        Row: {
          bg_decor: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          gradient: string
          icon_name: string
          id: string
          is_active: boolean
          sort_order: number
          subtitle: string | null
          subtitle_ar: string | null
          subtitle_de: string | null
          subtitle_en: string | null
          subtitle_es: string | null
          subtitle_fr: string | null
          subtitle_hi: string | null
          subtitle_id: string | null
          subtitle_ja: string | null
          subtitle_ka: string | null
          subtitle_kk: string | null
          subtitle_ko: string | null
          subtitle_nl: string | null
          subtitle_pl: string | null
          subtitle_pt: string | null
          subtitle_ru: string | null
          subtitle_sv: string | null
          subtitle_tr: string | null
          subtitle_uz: string | null
          subtitle_vi: string | null
          subtitle_zh: string | null
          title: string
          title_ar: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
        }
        Insert: {
          bg_decor?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          gradient?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          subtitle_ar?: string | null
          subtitle_de?: string | null
          subtitle_en?: string | null
          subtitle_es?: string | null
          subtitle_fr?: string | null
          subtitle_hi?: string | null
          subtitle_id?: string | null
          subtitle_ja?: string | null
          subtitle_ka?: string | null
          subtitle_kk?: string | null
          subtitle_ko?: string | null
          subtitle_nl?: string | null
          subtitle_pl?: string | null
          subtitle_pt?: string | null
          subtitle_ru?: string | null
          subtitle_sv?: string | null
          subtitle_tr?: string | null
          subtitle_uz?: string | null
          subtitle_vi?: string | null
          subtitle_zh?: string | null
          title: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Update: {
          bg_decor?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          gradient?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          subtitle_ar?: string | null
          subtitle_de?: string | null
          subtitle_en?: string | null
          subtitle_es?: string | null
          subtitle_fr?: string | null
          subtitle_hi?: string | null
          subtitle_id?: string | null
          subtitle_ja?: string | null
          subtitle_ka?: string | null
          subtitle_kk?: string | null
          subtitle_ko?: string | null
          subtitle_nl?: string | null
          subtitle_pl?: string | null
          subtitle_pt?: string | null
          subtitle_ru?: string | null
          subtitle_sv?: string | null
          subtitle_tr?: string | null
          subtitle_uz?: string | null
          subtitle_vi?: string | null
          subtitle_zh?: string | null
          title?: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kick_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          kick_count: number
          position: string | null
          session_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          kick_count?: number
          position?: string | null
          session_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          kick_count?: number
          position?: string | null
          session_date?: string
          user_id?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          content: string
          content_ar: string | null
          content_az: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string | null
          document_type: string
          effective_date: string | null
          id: string
          is_active: boolean | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          content: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          document_type: string
          effective_date?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          content?: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          document_type?: string
          effective_date?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      marketplace_categories: {
        Row: {
          category_key: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category_key: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category_key?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          admin_notes: string | null
          age_range: string | null
          category: string
          condition: string
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          is_free: boolean | null
          location_city: string | null
          price: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          age_range?: string | null
          category?: string
          condition?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_free?: boolean | null
          location_city?: string | null
          price?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          age_range?: string | null
          category?: string
          condition?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_free?: boolean | null
          location_city?: string | null
          price?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          listing_id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          listing_id: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          listing_id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      maternity_config: {
        Row: {
          config_key: string
          description: string | null
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          config_key: string
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          updated_at?: string | null
          value: number
        }
        Update: {
          config_key?: string
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      maternity_guidelines: {
        Row: {
          category: string | null
          content: string
          content_ar: string | null
          content_az: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          calories: number
          created_at: string
          food_name: string
          id: string
          logged_at: string
          meal_type: string
          notes: string | null
          portion: string | null
          user_id: string
        }
        Insert: {
          calories?: number
          created_at?: string
          food_name: string
          id?: string
          logged_at?: string
          meal_type: string
          notes?: string | null
          portion?: string | null
          user_id: string
        }
        Update: {
          calories?: number
          created_at?: string
          food_name?: string
          id?: string
          logged_at?: string
          meal_type?: string
          notes?: string | null
          portion?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meal_types: {
        Row: {
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          life_stages: string[] | null
          meal_id: string
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
          time_range: string | null
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          life_stages?: string[] | null
          meal_id: string
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          time_range?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          life_stages?: string[] | null
          meal_id?: string
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          time_range?: string | null
        }
        Relationships: []
      }
      menstruation_phase_tips: {
        Row: {
          category: string | null
          content: string
          content_ar: string | null
          content_az: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          phase: string
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          phase: string
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          phase?: string
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mental_health_resources: {
        Row: {
          address: string | null
          address_az: string | null
          address_en: string | null
          address_ru: string | null
          address_tr: string | null
          country_code: string
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          is_active: boolean | null
          is_emergency: boolean | null
          name: string
          name_ar: string | null
          name_az: string
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          phone: string | null
          resource_type: string
          sort_order: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          address_az?: string | null
          address_en?: string | null
          address_ru?: string | null
          address_tr?: string | null
          country_code?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          is_emergency?: boolean | null
          name: string
          name_ar?: string | null
          name_az: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          resource_type: string
          sort_order?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          address_az?: string | null
          address_en?: string | null
          address_ru?: string | null
          address_tr?: string | null
          country_code?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          is_emergency?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          resource_type?: string
          sort_order?: number | null
          website?: string | null
        }
        Relationships: []
      }
      moderator_actions: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          after_data: Json | null
          args_hash: string
          before_data: Json | null
          created_at: string
          id: string
          note: string
          public_detail: string
          reason: string
          response: Json | null
          subject_id: string | null
          subject_kind: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: string
          after_data?: Json | null
          args_hash: string
          before_data?: Json | null
          created_at?: string
          id: string
          note?: string
          public_detail?: string
          reason: string
          response?: Json | null
          subject_id?: string | null
          subject_kind: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          after_data?: Json | null
          args_hash?: string
          before_data?: Json | null
          created_at?: string
          id?: string
          note?: string
          public_detail?: string
          reason?: string
          response?: Json | null
          subject_id?: string | null
          subject_kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      moderator_appeals: {
        Row: {
          action_id: string
          body: string
          created_at: string
          id: string
          response: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          user_id: string
        }
        Insert: {
          action_id: string
          body: string
          created_at?: string
          id: string
          response?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          user_id: string
        }
        Update: {
          action_id?: string
          body?: string
          created_at?: string
          id?: string
          response?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_appeals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "moderator_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_ip_observations: {
        Row: {
          address: unknown
          event_id: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          proposed_user_id: string | null
          source: string
          trusted: boolean
          user_id: string | null
        }
        Insert: {
          address: unknown
          event_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          proposed_user_id?: string | null
          source: string
          trusted?: boolean
          user_id?: string | null
        }
        Update: {
          address?: unknown
          event_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          proposed_user_id?: string | null
          source?: string
          trusted?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      moderator_ip_rules: {
        Row: {
          address: unknown
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          issuer_role: string
          note: string
          observation_id: string | null
          reason: string
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          address: unknown
          created_at?: string
          created_by?: string | null
          expires_at: string
          id: string
          issuer_role: string
          note?: string
          observation_id?: string | null
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          address?: unknown
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          issuer_role?: string
          note?: string
          observation_id?: string | null
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderator_ip_rules_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "moderator_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          issuer_role: string
          legacy_block_id: string | null
          public_detail: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id: string
          issuer_role: string
          legacy_block_id?: string | null
          public_detail?: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          issuer_role?: string
          legacy_block_id?: string | null
          public_detail?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_restrictions_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "moderator_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_restrictions_legacy_block_id_fkey"
            columns: ["legacy_block_id"]
            isOneToOne: false
            referencedRelation: "user_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_runtime_settings: {
        Row: {
          id: string
          installed_at: string
          ip_mode: string
          previous_auth_hook: string | null
          previous_pre_request: string | null
          trusted_since: string | null
        }
        Insert: {
          id: string
          installed_at?: string
          ip_mode?: string
          previous_auth_hook?: string | null
          previous_pre_request?: string | null
          trusted_since?: string | null
        }
        Update: {
          id?: string
          installed_at?: string
          ip_mode?: string
          previous_auth_hook?: string | null
          previous_pre_request?: string | null
          trusted_since?: string | null
        }
        Relationships: []
      }
      moderator_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          resolved_at: string | null
          revision: number
          source_id: string
          source_kind: string
          state: string
          subject_id: string | null
          subject_kind: string
          summary: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          revision?: number
          source_id: string
          source_kind: string
          state?: string
          subject_id?: string | null
          subject_kind: string
          summary?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          revision?: number
          source_id?: string
          source_kind?: string
          state?: string
          subject_id?: string | null
          subject_kind?: string
          summary?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      moderator_warnings: {
        Row: {
          acknowledged_at: string | null
          claim_id: string | null
          claim_owner: string | null
          claim_until: string | null
          created_at: string
          created_by: string | null
          id: string
          public_detail: string
          reason: string
          revoked_at: string | null
          shown_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          claim_id?: string | null
          claim_owner?: string | null
          claim_until?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          public_detail?: string
          reason: string
          revoked_at?: string | null
          shown_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          claim_id?: string | null
          claim_owner?: string | null
          claim_until?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          public_detail?: string
          reason?: string
          revoked_at?: string | null
          shown_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_warnings_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "moderator_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      mom_friendly_places: {
        Row: {
          address: string | null
          address_ar: string | null
          address_az: string | null
          address_de: string | null
          address_en: string | null
          address_es: string | null
          address_fr: string | null
          address_hi: string | null
          address_id: string | null
          address_ja: string | null
          address_ka: string | null
          address_kk: string | null
          address_ko: string | null
          address_nl: string | null
          address_pl: string | null
          address_pt: string | null
          address_ru: string | null
          address_sv: string | null
          address_tr: string | null
          address_uz: string | null
          address_vi: string | null
          address_zh: string | null
          avg_rating: number | null
          category: Database["public"]["Enums"]["place_category"]
          created_at: string | null
          created_by: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          has_breastfeeding_room: boolean | null
          has_changing_table: boolean | null
          has_elevator: boolean | null
          has_high_chair: boolean | null
          has_kids_menu: boolean | null
          has_parking: boolean | null
          has_play_area: boolean | null
          has_ramp: boolean | null
          has_stroller_access: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_verified: boolean | null
          latitude: number
          longitude: number
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          phone: string | null
          review_count: number | null
          updated_at: string | null
          verified_count: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          address_ar?: string | null
          address_az?: string | null
          address_de?: string | null
          address_en?: string | null
          address_es?: string | null
          address_fr?: string | null
          address_hi?: string | null
          address_id?: string | null
          address_ja?: string | null
          address_ka?: string | null
          address_kk?: string | null
          address_ko?: string | null
          address_nl?: string | null
          address_pl?: string | null
          address_pt?: string | null
          address_ru?: string | null
          address_sv?: string | null
          address_tr?: string | null
          address_uz?: string | null
          address_vi?: string | null
          address_zh?: string | null
          avg_rating?: number | null
          category?: Database["public"]["Enums"]["place_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          has_breastfeeding_room?: boolean | null
          has_changing_table?: boolean | null
          has_elevator?: boolean | null
          has_high_chair?: boolean | null
          has_kids_menu?: boolean | null
          has_parking?: boolean | null
          has_play_area?: boolean | null
          has_ramp?: boolean | null
          has_stroller_access?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude: number
          longitude: number
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          review_count?: number | null
          updated_at?: string | null
          verified_count?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          address_ar?: string | null
          address_az?: string | null
          address_de?: string | null
          address_en?: string | null
          address_es?: string | null
          address_fr?: string | null
          address_hi?: string | null
          address_id?: string | null
          address_ja?: string | null
          address_ka?: string | null
          address_kk?: string | null
          address_ko?: string | null
          address_nl?: string | null
          address_pl?: string | null
          address_pt?: string | null
          address_ru?: string | null
          address_sv?: string | null
          address_tr?: string | null
          address_uz?: string | null
          address_vi?: string | null
          address_zh?: string | null
          avg_rating?: number | null
          category?: Database["public"]["Enums"]["place_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          has_breastfeeding_room?: boolean | null
          has_changing_table?: boolean | null
          has_elevator?: boolean | null
          has_high_chair?: boolean | null
          has_kids_menu?: boolean | null
          has_parking?: boolean | null
          has_play_area?: boolean | null
          has_ramp?: boolean | null
          has_stroller_access?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          review_count?: number | null
          updated_at?: string | null
          verified_count?: number | null
          website?: string | null
        }
        Relationships: []
      }
      mommy_daily_messages: {
        Row: {
          created_at: string
          day_number: number
          id: string
          is_active: boolean
          message: string
          message_ar: string | null
          message_de: string | null
          message_en: string | null
          message_es: string | null
          message_fr: string | null
          message_hi: string | null
          message_id: string | null
          message_ja: string | null
          message_ka: string | null
          message_kk: string | null
          message_ko: string | null
          message_nl: string | null
          message_pl: string | null
          message_pt: string | null
          message_ru: string | null
          message_sv: string | null
          message_tr: string | null
          message_uz: string | null
          message_vi: string | null
          message_zh: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          is_active?: boolean
          message: string
          message_ar?: string | null
          message_de?: string | null
          message_en?: string | null
          message_es?: string | null
          message_fr?: string | null
          message_hi?: string | null
          message_id?: string | null
          message_ja?: string | null
          message_ka?: string | null
          message_kk?: string | null
          message_ko?: string | null
          message_nl?: string | null
          message_pl?: string | null
          message_pt?: string | null
          message_ru?: string | null
          message_sv?: string | null
          message_tr?: string | null
          message_uz?: string | null
          message_vi?: string | null
          message_zh?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          is_active?: boolean
          message?: string
          message_ar?: string | null
          message_de?: string | null
          message_en?: string | null
          message_es?: string | null
          message_fr?: string | null
          message_hi?: string | null
          message_id?: string | null
          message_ja?: string | null
          message_ka?: string | null
          message_kk?: string | null
          message_ko?: string | null
          message_nl?: string | null
          message_pl?: string | null
          message_pt?: string | null
          message_ru?: string | null
          message_sv?: string | null
          message_tr?: string | null
          message_uz?: string | null
          message_vi?: string | null
          message_zh?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mommy_day_notifications: {
        Row: {
          body: string
          body_ar: string | null
          body_de: string | null
          body_en: string | null
          body_es: string | null
          body_fr: string | null
          body_hi: string | null
          body_id: string | null
          body_ja: string | null
          body_ka: string | null
          body_kk: string | null
          body_ko: string | null
          body_nl: string | null
          body_pl: string | null
          body_pt: string | null
          body_ru: string | null
          body_sv: string | null
          body_tr: string | null
          body_uz: string | null
          body_vi: string | null
          body_zh: string | null
          calendar_day_offset: number | null
          calendar_months: number | null
          created_at: string
          day_number: number
          emoji: string | null
          id: string
          is_active: boolean | null
          send_time: string
          title: string
          title_ar: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
        }
        Insert: {
          body: string
          body_ar?: string | null
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          body_hi?: string | null
          body_id?: string | null
          body_ja?: string | null
          body_ka?: string | null
          body_kk?: string | null
          body_ko?: string | null
          body_nl?: string | null
          body_pl?: string | null
          body_pt?: string | null
          body_ru?: string | null
          body_sv?: string | null
          body_tr?: string | null
          body_uz?: string | null
          body_vi?: string | null
          body_zh?: string | null
          calendar_day_offset?: number | null
          calendar_months?: number | null
          created_at?: string
          day_number: number
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          send_time?: string
          title: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          body_ar?: string | null
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          body_hi?: string | null
          body_id?: string | null
          body_ja?: string | null
          body_ka?: string | null
          body_kk?: string | null
          body_ko?: string | null
          body_nl?: string | null
          body_pl?: string | null
          body_pt?: string | null
          body_ru?: string | null
          body_sv?: string | null
          body_tr?: string | null
          body_uz?: string | null
          body_vi?: string | null
          body_zh?: string | null
          calendar_day_offset?: number | null
          calendar_months?: number | null
          created_at?: string
          day_number?: number
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          send_time?: string
          title?: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mood_checkins: {
        Row: {
          checked_at: string | null
          created_at: string | null
          id: string
          mood_level: number
          mood_type: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string | null
          id?: string
          mood_level: number
          mood_type?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string | null
          id?: string
          mood_level?: number
          mood_type?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mood_levels: {
        Row: {
          color: string | null
          created_at: string | null
          emoji: string
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          mood_value: number
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          emoji: string
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          mood_value: number
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          mood_value?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      mood_options: {
        Row: {
          color_class: string | null
          created_at: string | null
          emoji: string
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          value: number
        }
        Insert: {
          color_class?: string | null
          created_at?: string | null
          emoji: string
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          value: number
        }
        Update: {
          color_class?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          value?: number
        }
        Relationships: []
      }
      multiples_options: {
        Row: {
          baby_count: number
          created_at: string | null
          emoji: string
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          option_id: string
          sort_order: number | null
        }
        Insert: {
          baby_count?: number
          created_at?: string | null
          emoji: string
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          option_id: string
          sort_order?: number | null
        }
        Update: {
          baby_count?: number
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          option_id?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      name_votes: {
        Row: {
          created_at: string
          gender: string
          id: string
          meaning: string | null
          name: string
          origin: string | null
          partner_user_id: string | null
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          gender?: string
          id?: string
          meaning?: string | null
          name: string
          origin?: string | null
          partner_user_id?: string | null
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          meaning?: string | null
          name?: string
          origin?: string | null
          partner_user_id?: string | null
          user_id?: string
          vote?: string
        }
        Relationships: []
      }
      noise_measurements: {
        Row: {
          created_at: string
          decibel_level: number
          id: string
          is_too_loud: boolean | null
          room_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decibel_level: number
          id?: string
          is_too_loud?: boolean | null
          room_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          decibel_level?: number
          id?: string
          is_too_loud?: boolean | null
          room_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      noise_thresholds: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          max_db: number | null
          min_db: number
          sort_order: number | null
          threshold_key: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          max_db?: number | null
          min_db: number
          sort_order?: number | null
          threshold_key: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          max_db?: number | null
          min_db?: number
          sort_order?: number | null
          threshold_key?: string
        }
        Relationships: []
      }
      notification_run_log: {
        Row: {
          active_slot: string | null
          baku_time: string | null
          eligible_count: number | null
          ended_at: string | null
          error_message: string | null
          failed_count: number
          function_name: string
          id: string
          payload: Json | null
          reasons: Json
          sent_count: number
          skipped_count: number
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          active_slot?: string | null
          baku_time?: string | null
          eligible_count?: number | null
          ended_at?: string | null
          error_message?: string | null
          failed_count?: number
          function_name: string
          id?: string
          payload?: Json | null
          reasons?: Json
          sent_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          active_slot?: string | null
          baku_time?: string | null
          eligible_count?: number | null
          ended_at?: string | null
          error_message?: string | null
          failed_count?: number
          function_name?: string
          id?: string
          payload?: Json | null
          reasons?: Json
          sent_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      notification_send_log: {
        Row: {
          body: string
          error_code: string | null
          id: string
          notification_id: string | null
          notification_type: string | null
          reason: string | null
          sent_at: string | null
          source_notification_id: string | null
          source_type: string | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          error_code?: string | null
          id?: string
          notification_id?: string | null
          notification_type?: string | null
          reason?: string | null
          sent_at?: string | null
          source_notification_id?: string | null
          source_type?: string | null
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          error_code?: string | null
          id?: string
          notification_id?: string | null
          notification_type?: string | null
          reason?: string | null
          sent_at?: string | null
          source_notification_id?: string | null
          source_type?: string | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_send_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "scheduled_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_data: Json | null
          action_type: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          title: string
          user_id: string
        }
        Insert: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          notification_type?: string
          title: string
          user_id: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          calories: number
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          is_active: boolean | null
          life_stage: string
          updated_at: string | null
          water_glasses: number
        }
        Insert: {
          calories?: number
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          life_stage: string
          updated_at?: string | null
          water_glasses?: number
        }
        Update: {
          calories?: number
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string
          updated_at?: string | null
          water_glasses?: number
        }
        Relationships: []
      }
      nutrition_tips: {
        Row: {
          calories: number | null
          category: string
          content: string
          content_ar: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string
          id: string
          is_active: boolean | null
          nutrients: Json | null
          title: string
          title_ar: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          trimester: number | null
          updated_at: string
        }
        Insert: {
          calories?: number | null
          category?: string
          content: string
          content_ar?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          nutrients?: Json | null
          title: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          trimester?: number | null
          updated_at?: string
        }
        Update: {
          calories?: number | null
          category?: string
          content?: string
          content_ar?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          nutrients?: Json | null
          title?: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          trimester?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_stages: {
        Row: {
          bg_gradient: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          stage_id: string
          subtitle: string | null
          subtitle_ar: string | null
          subtitle_az: string | null
          subtitle_de: string | null
          subtitle_en: string | null
          subtitle_es: string | null
          subtitle_fr: string | null
          subtitle_hi: string | null
          subtitle_id: string | null
          subtitle_ja: string | null
          subtitle_ka: string | null
          subtitle_kk: string | null
          subtitle_ko: string | null
          subtitle_nl: string | null
          subtitle_pl: string | null
          subtitle_pt: string | null
          subtitle_ru: string | null
          subtitle_sv: string | null
          subtitle_tr: string | null
          subtitle_uz: string | null
          subtitle_vi: string | null
          subtitle_zh: string | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
        }
        Insert: {
          bg_gradient?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          stage_id: string
          subtitle?: string | null
          subtitle_ar?: string | null
          subtitle_az?: string | null
          subtitle_de?: string | null
          subtitle_en?: string | null
          subtitle_es?: string | null
          subtitle_fr?: string | null
          subtitle_hi?: string | null
          subtitle_id?: string | null
          subtitle_ja?: string | null
          subtitle_ka?: string | null
          subtitle_kk?: string | null
          subtitle_ko?: string | null
          subtitle_nl?: string | null
          subtitle_pl?: string | null
          subtitle_pt?: string | null
          subtitle_ru?: string | null
          subtitle_sv?: string | null
          subtitle_tr?: string | null
          subtitle_uz?: string | null
          subtitle_vi?: string | null
          subtitle_zh?: string | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Update: {
          bg_gradient?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          stage_id?: string
          subtitle?: string | null
          subtitle_ar?: string | null
          subtitle_az?: string | null
          subtitle_de?: string | null
          subtitle_en?: string | null
          subtitle_es?: string | null
          subtitle_fr?: string | null
          subtitle_hi?: string | null
          subtitle_id?: string | null
          subtitle_ja?: string | null
          subtitle_ka?: string | null
          subtitle_kk?: string | null
          subtitle_ko?: string | null
          subtitle_nl?: string | null
          subtitle_pl?: string | null
          subtitle_pt?: string | null
          subtitle_ru?: string | null
          subtitle_sv?: string | null
          subtitle_tr?: string | null
          subtitle_uz?: string | null
          subtitle_vi?: string | null
          subtitle_zh?: string | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          created_at: string
          id: string
          notes: string | null
          order_number: string
          shipping_address: Json | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number: string
          shipping_address?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          shipping_address?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_achievements: {
        Row: {
          achievement_key: string
          created_at: string | null
          description: string | null
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string
          id: string
          is_active: boolean | null
          name: string
          name_az: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
          unlock_condition: string | null
          unlock_threshold: number | null
        }
        Insert: {
          achievement_key: string
          created_at?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          name: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          unlock_condition?: string | null
          unlock_threshold?: number | null
        }
        Update: {
          achievement_key?: string
          created_at?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          name?: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          unlock_condition?: string | null
          unlock_threshold?: number | null
        }
        Relationships: []
      }
      partner_daily_tips: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          life_stage: string
          sort_order: number | null
          tip_emoji: string | null
          tip_text: string
          tip_text_ar: string | null
          tip_text_az: string | null
          tip_text_de: string | null
          tip_text_en: string | null
          tip_text_es: string | null
          tip_text_fr: string | null
          tip_text_hi: string | null
          tip_text_id: string | null
          tip_text_ja: string | null
          tip_text_ka: string | null
          tip_text_kk: string | null
          tip_text_ko: string | null
          tip_text_nl: string | null
          tip_text_pl: string | null
          tip_text_pt: string | null
          tip_text_ru: string | null
          tip_text_sv: string | null
          tip_text_tr: string | null
          tip_text_uz: string | null
          tip_text_vi: string | null
          tip_text_zh: string | null
          updated_at: string | null
          week_number: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string
          sort_order?: number | null
          tip_emoji?: string | null
          tip_text: string
          tip_text_ar?: string | null
          tip_text_az?: string | null
          tip_text_de?: string | null
          tip_text_en?: string | null
          tip_text_es?: string | null
          tip_text_fr?: string | null
          tip_text_hi?: string | null
          tip_text_id?: string | null
          tip_text_ja?: string | null
          tip_text_ka?: string | null
          tip_text_kk?: string | null
          tip_text_ko?: string | null
          tip_text_nl?: string | null
          tip_text_pl?: string | null
          tip_text_pt?: string | null
          tip_text_ru?: string | null
          tip_text_sv?: string | null
          tip_text_tr?: string | null
          tip_text_uz?: string | null
          tip_text_vi?: string | null
          tip_text_zh?: string | null
          updated_at?: string | null
          week_number?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string
          sort_order?: number | null
          tip_emoji?: string | null
          tip_text?: string
          tip_text_ar?: string | null
          tip_text_az?: string | null
          tip_text_de?: string | null
          tip_text_en?: string | null
          tip_text_es?: string | null
          tip_text_fr?: string | null
          tip_text_hi?: string | null
          tip_text_id?: string | null
          tip_text_ja?: string | null
          tip_text_ka?: string | null
          tip_text_kk?: string | null
          tip_text_ko?: string | null
          tip_text_nl?: string | null
          tip_text_pl?: string | null
          tip_text_pt?: string | null
          tip_text_ru?: string | null
          tip_text_sv?: string | null
          tip_text_tr?: string | null
          tip_text_uz?: string | null
          tip_text_vi?: string | null
          tip_text_zh?: string | null
          updated_at?: string | null
          week_number?: number | null
        }
        Relationships: []
      }
      partner_menu_items: {
        Row: {
          created_at: string | null
          icon_name: string
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          menu_key: string
          route: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          menu_key: string
          route: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          menu_key?: string
          route?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      partner_messages: {
        Row: {
          content: string | null
          created_at: string
          duration_ms: number | null
          id: string
          is_read: boolean | null
          media_mime: string | null
          media_path: string | null
          message_type: string
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          is_read?: boolean | null
          media_mime?: string | null
          media_path?: string | null
          message_type: string
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          is_read?: boolean | null
          media_mime?: string | null
          media_path?: string | null
          message_type?: string
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_message_reply_v2"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "partner_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_missions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          mission_id: string
          points_earned: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          mission_id: string
          points_earned?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          mission_id?: string
          points_earned?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_redemptions: {
        Row: {
          client_meta: Json | null
          created_at: string
          expires_at: string
          id: string
          status: string
          token: string
          user_id: string
          venue_id: string
          verified_at: string | null
          verified_ip: string | null
        }
        Insert: {
          client_meta?: Json | null
          created_at?: string
          expires_at: string
          id?: string
          status?: string
          token: string
          user_id: string
          venue_id: string
          verified_at?: string | null
          verified_ip?: string | null
        }
        Update: {
          client_meta?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          user_id?: string
          venue_id?: string
          verified_at?: string | null
          verified_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_redemptions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "partner_venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_redemptions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "partner_venues_public"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_sharing_settings: {
        Row: {
          share_appointments: boolean
          share_baby_logs: boolean
          share_contractions: boolean
          share_cycle: boolean
          share_kicks: boolean
          share_mood: boolean
          share_symptoms: boolean
          share_water: boolean
          share_weight: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          share_appointments?: boolean
          share_baby_logs?: boolean
          share_contractions?: boolean
          share_cycle?: boolean
          share_kicks?: boolean
          share_mood?: boolean
          share_symptoms?: boolean
          share_water?: boolean
          share_weight?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          share_appointments?: boolean
          share_baby_logs?: boolean
          share_contractions?: boolean
          share_cycle?: boolean
          share_kicks?: boolean
          share_mood?: boolean
          share_symptoms?: boolean
          share_water?: boolean
          share_weight?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_surprises: {
        Row: {
          completed_date: string | null
          created_at: string
          id: string
          notes: string | null
          planned_date: string
          status: string
          surprise_category: string
          surprise_emoji: string
          surprise_id: string
          surprise_points: number
          surprise_title: string
          surprise_title_en: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_date: string
          status?: string
          surprise_category: string
          surprise_emoji: string
          surprise_id: string
          surprise_points?: number
          surprise_title: string
          surprise_title_en?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_date?: string
          status?: string
          surprise_category?: string
          surprise_emoji?: string
          surprise_id?: string
          surprise_points?: number
          surprise_title?: string
          surprise_title_en?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_venue_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          key: string
          label_ar: string | null
          label_az: string
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          label_ar?: string | null
          label_az: string
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label_ar?: string | null
          label_az?: string
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_venues: {
        Row: {
          address: string | null
          address_en: string | null
          address_es: string | null
          address_fr: string | null
          address_hi: string | null
          address_id: string | null
          address_ja: string | null
          address_ko: string | null
          address_nl: string | null
          address_pl: string | null
          address_pt: string | null
          address_sv: string | null
          address_vi: string | null
          address_zh: string | null
          category_key: string
          city: string | null
          city_en: string | null
          city_es: string | null
          city_fr: string | null
          city_hi: string | null
          city_id: string | null
          city_ja: string | null
          city_ko: string | null
          city_nl: string | null
          city_pl: string | null
          city_pt: string | null
          city_sv: string | null
          city_vi: string | null
          city_zh: string | null
          countries: string[] | null
          cover_url: string | null
          created_at: string
          description: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_sv: string | null
          description_vi: string | null
          description_zh: string | null
          discount_label: string
          discount_label_en: string | null
          discount_label_es: string | null
          discount_label_fr: string | null
          discount_label_hi: string | null
          discount_label_id: string | null
          discount_label_ja: string | null
          discount_label_ko: string | null
          discount_label_nl: string | null
          discount_label_pl: string | null
          discount_label_pt: string | null
          discount_label_sv: string | null
          discount_label_vi: string | null
          discount_label_zh: string | null
          discount_terms: string | null
          discount_terms_en: string | null
          discount_terms_es: string | null
          discount_terms_fr: string | null
          discount_terms_hi: string | null
          discount_terms_id: string | null
          discount_terms_ja: string | null
          discount_terms_ko: string | null
          discount_terms_nl: string | null
          discount_terms_pl: string | null
          discount_terms_pt: string | null
          discount_terms_sv: string | null
          discount_terms_vi: string | null
          discount_terms_zh: string | null
          discount_value: number | null
          district: string | null
          district_en: string | null
          district_es: string | null
          district_fr: string | null
          district_hi: string | null
          district_id: string | null
          district_ja: string | null
          district_ko: string | null
          district_nl: string | null
          district_pl: string | null
          district_pt: string | null
          district_sv: string | null
          district_vi: string | null
          district_zh: string | null
          gallery_urls: string[] | null
          id: string
          instagram: string | null
          is_active: boolean
          is_featured: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_sv: string | null
          name_vi: string | null
          name_zh: string | null
          phone: string | null
          pin_hash: string
          qr_ttl_seconds: number
          redemption_cooldown_hours: number
          redemption_lifetime_limit: number | null
          slug: string | null
          sort_order: number
          updated_at: string
          website: string | null
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          address_en?: string | null
          address_es?: string | null
          address_fr?: string | null
          address_hi?: string | null
          address_id?: string | null
          address_ja?: string | null
          address_ko?: string | null
          address_nl?: string | null
          address_pl?: string | null
          address_pt?: string | null
          address_sv?: string | null
          address_vi?: string | null
          address_zh?: string | null
          category_key: string
          city?: string | null
          city_en?: string | null
          city_es?: string | null
          city_fr?: string | null
          city_hi?: string | null
          city_id?: string | null
          city_ja?: string | null
          city_ko?: string | null
          city_nl?: string | null
          city_pl?: string | null
          city_pt?: string | null
          city_sv?: string | null
          city_vi?: string | null
          city_zh?: string | null
          countries?: string[] | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_sv?: string | null
          description_vi?: string | null
          description_zh?: string | null
          discount_label: string
          discount_label_en?: string | null
          discount_label_es?: string | null
          discount_label_fr?: string | null
          discount_label_hi?: string | null
          discount_label_id?: string | null
          discount_label_ja?: string | null
          discount_label_ko?: string | null
          discount_label_nl?: string | null
          discount_label_pl?: string | null
          discount_label_pt?: string | null
          discount_label_sv?: string | null
          discount_label_vi?: string | null
          discount_label_zh?: string | null
          discount_terms?: string | null
          discount_terms_en?: string | null
          discount_terms_es?: string | null
          discount_terms_fr?: string | null
          discount_terms_hi?: string | null
          discount_terms_id?: string | null
          discount_terms_ja?: string | null
          discount_terms_ko?: string | null
          discount_terms_nl?: string | null
          discount_terms_pl?: string | null
          discount_terms_pt?: string | null
          discount_terms_sv?: string | null
          discount_terms_vi?: string | null
          discount_terms_zh?: string | null
          discount_value?: number | null
          district?: string | null
          district_en?: string | null
          district_es?: string | null
          district_fr?: string | null
          district_hi?: string | null
          district_id?: string | null
          district_ja?: string | null
          district_ko?: string | null
          district_nl?: string | null
          district_pl?: string | null
          district_pt?: string | null
          district_sv?: string | null
          district_vi?: string | null
          district_zh?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          is_featured?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_sv?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          pin_hash: string
          qr_ttl_seconds?: number
          redemption_cooldown_hours?: number
          redemption_lifetime_limit?: number | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
          website?: string | null
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          address_en?: string | null
          address_es?: string | null
          address_fr?: string | null
          address_hi?: string | null
          address_id?: string | null
          address_ja?: string | null
          address_ko?: string | null
          address_nl?: string | null
          address_pl?: string | null
          address_pt?: string | null
          address_sv?: string | null
          address_vi?: string | null
          address_zh?: string | null
          category_key?: string
          city?: string | null
          city_en?: string | null
          city_es?: string | null
          city_fr?: string | null
          city_hi?: string | null
          city_id?: string | null
          city_ja?: string | null
          city_ko?: string | null
          city_nl?: string | null
          city_pl?: string | null
          city_pt?: string | null
          city_sv?: string | null
          city_vi?: string | null
          city_zh?: string | null
          countries?: string[] | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_sv?: string | null
          description_vi?: string | null
          description_zh?: string | null
          discount_label?: string
          discount_label_en?: string | null
          discount_label_es?: string | null
          discount_label_fr?: string | null
          discount_label_hi?: string | null
          discount_label_id?: string | null
          discount_label_ja?: string | null
          discount_label_ko?: string | null
          discount_label_nl?: string | null
          discount_label_pl?: string | null
          discount_label_pt?: string | null
          discount_label_sv?: string | null
          discount_label_vi?: string | null
          discount_label_zh?: string | null
          discount_terms?: string | null
          discount_terms_en?: string | null
          discount_terms_es?: string | null
          discount_terms_fr?: string | null
          discount_terms_hi?: string | null
          discount_terms_id?: string | null
          discount_terms_ja?: string | null
          discount_terms_ko?: string | null
          discount_terms_nl?: string | null
          discount_terms_pl?: string | null
          discount_terms_pt?: string | null
          discount_terms_sv?: string | null
          discount_terms_vi?: string | null
          discount_terms_zh?: string | null
          discount_value?: number | null
          district?: string | null
          district_en?: string | null
          district_es?: string | null
          district_fr?: string | null
          district_hi?: string | null
          district_id?: string | null
          district_ja?: string | null
          district_ko?: string | null
          district_nl?: string | null
          district_pl?: string | null
          district_pt?: string | null
          district_sv?: string | null
          district_vi?: string | null
          district_zh?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          is_featured?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_sv?: string | null
          name_vi?: string | null
          name_zh?: string | null
          phone?: string | null
          pin_hash?: string
          qr_ttl_seconds?: number
          redemption_cooldown_hours?: number
          redemption_lifetime_limit?: number | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
          website?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_venues_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "partner_venue_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      payment_methods: {
        Row: {
          config: Json | null
          created_at: string | null
          description: string | null
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          method_key: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          method_key: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          method_key?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          bank_response: string | null
          bank_transaction: string | null
          callback_received_at: string | null
          card_mask: string | null
          card_name: string | null
          created_at: string | null
          currency: string
          description: string | null
          epoint_transaction: string | null
          error_code: string | null
          error_message: string | null
          id: string
          operation_code: string | null
          order_id: string
          order_reference_id: string | null
          order_type: string
          redirect_url: string | null
          rrn: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bank_response?: string | null
          bank_transaction?: string | null
          callback_received_at?: string | null
          card_mask?: string | null
          card_name?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          epoint_transaction?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          operation_code?: string | null
          order_id: string
          order_reference_id?: string | null
          order_type?: string
          redirect_url?: string | null
          rrn?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bank_response?: string | null
          bank_transaction?: string | null
          callback_received_at?: string | null
          card_mask?: string | null
          card_name?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          epoint_transaction?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          operation_code?: string | null
          order_id?: string
          order_reference_id?: string | null
          order_type?: string
          redirect_url?: string | null
          rrn?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      period_day_logs: {
        Row: {
          created_at: string
          flow_intensity: string | null
          id: string
          log_date: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          flow_intensity?: string | null
          id?: string
          log_date: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          flow_intensity?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      photoshoot_backgrounds: {
        Row: {
          category_id: string
          category_name: string
          category_name_ar: string | null
          category_name_az: string | null
          category_name_de: string | null
          category_name_en: string | null
          category_name_es: string | null
          category_name_fr: string | null
          category_name_hi: string | null
          category_name_id: string | null
          category_name_ja: string | null
          category_name_ka: string | null
          category_name_kk: string | null
          category_name_ko: string | null
          category_name_nl: string | null
          category_name_pl: string | null
          category_name_pt: string | null
          category_name_ru: string | null
          category_name_sv: string | null
          category_name_tr: string | null
          category_name_uz: string | null
          category_name_vi: string | null
          category_name_zh: string | null
          created_at: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          preview_url: string | null
          prompt_template: string | null
          sort_order: number | null
          theme_emoji: string | null
          theme_id: string
          theme_name: string
          theme_name_ar: string | null
          theme_name_az: string | null
          theme_name_de: string | null
          theme_name_en: string | null
          theme_name_es: string | null
          theme_name_fr: string | null
          theme_name_hi: string | null
          theme_name_id: string | null
          theme_name_ja: string | null
          theme_name_ka: string | null
          theme_name_kk: string | null
          theme_name_ko: string | null
          theme_name_nl: string | null
          theme_name_pl: string | null
          theme_name_pt: string | null
          theme_name_ru: string | null
          theme_name_sv: string | null
          theme_name_tr: string | null
          theme_name_uz: string | null
          theme_name_vi: string | null
          theme_name_zh: string | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          category_name: string
          category_name_ar?: string | null
          category_name_az?: string | null
          category_name_de?: string | null
          category_name_en?: string | null
          category_name_es?: string | null
          category_name_fr?: string | null
          category_name_hi?: string | null
          category_name_id?: string | null
          category_name_ja?: string | null
          category_name_ka?: string | null
          category_name_kk?: string | null
          category_name_ko?: string | null
          category_name_nl?: string | null
          category_name_pl?: string | null
          category_name_pt?: string | null
          category_name_ru?: string | null
          category_name_sv?: string | null
          category_name_tr?: string | null
          category_name_uz?: string | null
          category_name_vi?: string | null
          category_name_zh?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          preview_url?: string | null
          prompt_template?: string | null
          sort_order?: number | null
          theme_emoji?: string | null
          theme_id: string
          theme_name: string
          theme_name_ar?: string | null
          theme_name_az?: string | null
          theme_name_de?: string | null
          theme_name_en?: string | null
          theme_name_es?: string | null
          theme_name_fr?: string | null
          theme_name_hi?: string | null
          theme_name_id?: string | null
          theme_name_ja?: string | null
          theme_name_ka?: string | null
          theme_name_kk?: string | null
          theme_name_ko?: string | null
          theme_name_nl?: string | null
          theme_name_pl?: string | null
          theme_name_pt?: string | null
          theme_name_ru?: string | null
          theme_name_sv?: string | null
          theme_name_tr?: string | null
          theme_name_uz?: string | null
          theme_name_vi?: string | null
          theme_name_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          category_name?: string
          category_name_ar?: string | null
          category_name_az?: string | null
          category_name_de?: string | null
          category_name_en?: string | null
          category_name_es?: string | null
          category_name_fr?: string | null
          category_name_hi?: string | null
          category_name_id?: string | null
          category_name_ja?: string | null
          category_name_ka?: string | null
          category_name_kk?: string | null
          category_name_ko?: string | null
          category_name_nl?: string | null
          category_name_pl?: string | null
          category_name_pt?: string | null
          category_name_ru?: string | null
          category_name_sv?: string | null
          category_name_tr?: string | null
          category_name_uz?: string | null
          category_name_vi?: string | null
          category_name_zh?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          preview_url?: string | null
          prompt_template?: string | null
          sort_order?: number | null
          theme_emoji?: string | null
          theme_id?: string
          theme_name?: string
          theme_name_ar?: string | null
          theme_name_az?: string | null
          theme_name_de?: string | null
          theme_name_en?: string | null
          theme_name_es?: string | null
          theme_name_fr?: string | null
          theme_name_hi?: string | null
          theme_name_id?: string | null
          theme_name_ja?: string | null
          theme_name_ka?: string | null
          theme_name_kk?: string | null
          theme_name_ko?: string | null
          theme_name_nl?: string | null
          theme_name_pl?: string | null
          theme_name_pt?: string | null
          theme_name_ru?: string | null
          theme_name_sv?: string | null
          theme_name_tr?: string | null
          theme_name_uz?: string | null
          theme_name_vi?: string | null
          theme_name_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      photoshoot_eye_colors: {
        Row: {
          color_id: string
          color_name: string
          color_name_ar: string | null
          color_name_az: string | null
          color_name_de: string | null
          color_name_en: string | null
          color_name_es: string | null
          color_name_fr: string | null
          color_name_hi: string | null
          color_name_id: string | null
          color_name_ja: string | null
          color_name_ka: string | null
          color_name_kk: string | null
          color_name_ko: string | null
          color_name_nl: string | null
          color_name_pl: string | null
          color_name_pt: string | null
          color_name_ru: string | null
          color_name_sv: string | null
          color_name_tr: string | null
          color_name_uz: string | null
          color_name_vi: string | null
          color_name_zh: string | null
          created_at: string | null
          hex_value: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
        }
        Insert: {
          color_id: string
          color_name: string
          color_name_ar?: string | null
          color_name_az?: string | null
          color_name_de?: string | null
          color_name_en?: string | null
          color_name_es?: string | null
          color_name_fr?: string | null
          color_name_hi?: string | null
          color_name_id?: string | null
          color_name_ja?: string | null
          color_name_ka?: string | null
          color_name_kk?: string | null
          color_name_ko?: string | null
          color_name_nl?: string | null
          color_name_pl?: string | null
          color_name_pt?: string | null
          color_name_ru?: string | null
          color_name_sv?: string | null
          color_name_tr?: string | null
          color_name_uz?: string | null
          color_name_vi?: string | null
          color_name_zh?: string | null
          created_at?: string | null
          hex_value?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Update: {
          color_id?: string
          color_name?: string
          color_name_ar?: string | null
          color_name_az?: string | null
          color_name_de?: string | null
          color_name_en?: string | null
          color_name_es?: string | null
          color_name_fr?: string | null
          color_name_hi?: string | null
          color_name_id?: string | null
          color_name_ja?: string | null
          color_name_ka?: string | null
          color_name_kk?: string | null
          color_name_ko?: string | null
          color_name_nl?: string | null
          color_name_pl?: string | null
          color_name_pt?: string | null
          color_name_ru?: string | null
          color_name_sv?: string | null
          color_name_tr?: string | null
          color_name_uz?: string | null
          color_name_vi?: string | null
          color_name_zh?: string | null
          created_at?: string | null
          hex_value?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Relationships: []
      }
      photoshoot_hair_colors: {
        Row: {
          color_id: string
          color_name: string
          color_name_ar: string | null
          color_name_az: string | null
          color_name_de: string | null
          color_name_en: string | null
          color_name_es: string | null
          color_name_fr: string | null
          color_name_hi: string | null
          color_name_id: string | null
          color_name_ja: string | null
          color_name_ka: string | null
          color_name_kk: string | null
          color_name_ko: string | null
          color_name_nl: string | null
          color_name_pl: string | null
          color_name_pt: string | null
          color_name_ru: string | null
          color_name_sv: string | null
          color_name_tr: string | null
          color_name_uz: string | null
          color_name_vi: string | null
          color_name_zh: string | null
          created_at: string | null
          hex_value: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
        }
        Insert: {
          color_id: string
          color_name: string
          color_name_ar?: string | null
          color_name_az?: string | null
          color_name_de?: string | null
          color_name_en?: string | null
          color_name_es?: string | null
          color_name_fr?: string | null
          color_name_hi?: string | null
          color_name_id?: string | null
          color_name_ja?: string | null
          color_name_ka?: string | null
          color_name_kk?: string | null
          color_name_ko?: string | null
          color_name_nl?: string | null
          color_name_pl?: string | null
          color_name_pt?: string | null
          color_name_ru?: string | null
          color_name_sv?: string | null
          color_name_tr?: string | null
          color_name_uz?: string | null
          color_name_vi?: string | null
          color_name_zh?: string | null
          created_at?: string | null
          hex_value?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Update: {
          color_id?: string
          color_name?: string
          color_name_ar?: string | null
          color_name_az?: string | null
          color_name_de?: string | null
          color_name_en?: string | null
          color_name_es?: string | null
          color_name_fr?: string | null
          color_name_hi?: string | null
          color_name_id?: string | null
          color_name_ja?: string | null
          color_name_ka?: string | null
          color_name_kk?: string | null
          color_name_ko?: string | null
          color_name_nl?: string | null
          color_name_pl?: string | null
          color_name_pt?: string | null
          color_name_ru?: string | null
          color_name_sv?: string | null
          color_name_tr?: string | null
          color_name_uz?: string | null
          color_name_vi?: string | null
          color_name_zh?: string | null
          created_at?: string | null
          hex_value?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Relationships: []
      }
      photoshoot_hair_styles: {
        Row: {
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          style_id: string
          style_name: string
          style_name_ar: string | null
          style_name_az: string | null
          style_name_de: string | null
          style_name_en: string | null
          style_name_es: string | null
          style_name_fr: string | null
          style_name_hi: string | null
          style_name_id: string | null
          style_name_ja: string | null
          style_name_ka: string | null
          style_name_kk: string | null
          style_name_ko: string | null
          style_name_nl: string | null
          style_name_pl: string | null
          style_name_pt: string | null
          style_name_ru: string | null
          style_name_sv: string | null
          style_name_tr: string | null
          style_name_uz: string | null
          style_name_vi: string | null
          style_name_zh: string | null
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          style_id: string
          style_name: string
          style_name_ar?: string | null
          style_name_az?: string | null
          style_name_de?: string | null
          style_name_en?: string | null
          style_name_es?: string | null
          style_name_fr?: string | null
          style_name_hi?: string | null
          style_name_id?: string | null
          style_name_ja?: string | null
          style_name_ka?: string | null
          style_name_kk?: string | null
          style_name_ko?: string | null
          style_name_nl?: string | null
          style_name_pl?: string | null
          style_name_pt?: string | null
          style_name_ru?: string | null
          style_name_sv?: string | null
          style_name_tr?: string | null
          style_name_uz?: string | null
          style_name_vi?: string | null
          style_name_zh?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          style_id?: string
          style_name?: string
          style_name_ar?: string | null
          style_name_az?: string | null
          style_name_de?: string | null
          style_name_en?: string | null
          style_name_es?: string | null
          style_name_fr?: string | null
          style_name_hi?: string | null
          style_name_id?: string | null
          style_name_ja?: string | null
          style_name_ka?: string | null
          style_name_kk?: string | null
          style_name_ko?: string | null
          style_name_nl?: string | null
          style_name_pl?: string | null
          style_name_pt?: string | null
          style_name_ru?: string | null
          style_name_sv?: string | null
          style_name_tr?: string | null
          style_name_uz?: string | null
          style_name_vi?: string | null
          style_name_zh?: string | null
        }
        Relationships: []
      }
      photoshoot_image_styles: {
        Row: {
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          prompt_modifier: string | null
          sort_order: number | null
          style_id: string
          style_name: string
          style_name_ar: string | null
          style_name_az: string | null
          style_name_de: string | null
          style_name_en: string | null
          style_name_es: string | null
          style_name_fr: string | null
          style_name_hi: string | null
          style_name_id: string | null
          style_name_ja: string | null
          style_name_ka: string | null
          style_name_kk: string | null
          style_name_ko: string | null
          style_name_nl: string | null
          style_name_pl: string | null
          style_name_pt: string | null
          style_name_ru: string | null
          style_name_sv: string | null
          style_name_tr: string | null
          style_name_uz: string | null
          style_name_vi: string | null
          style_name_zh: string | null
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          prompt_modifier?: string | null
          sort_order?: number | null
          style_id: string
          style_name: string
          style_name_ar?: string | null
          style_name_az?: string | null
          style_name_de?: string | null
          style_name_en?: string | null
          style_name_es?: string | null
          style_name_fr?: string | null
          style_name_hi?: string | null
          style_name_id?: string | null
          style_name_ja?: string | null
          style_name_ka?: string | null
          style_name_kk?: string | null
          style_name_ko?: string | null
          style_name_nl?: string | null
          style_name_pl?: string | null
          style_name_pt?: string | null
          style_name_ru?: string | null
          style_name_sv?: string | null
          style_name_tr?: string | null
          style_name_uz?: string | null
          style_name_vi?: string | null
          style_name_zh?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          prompt_modifier?: string | null
          sort_order?: number | null
          style_id?: string
          style_name?: string
          style_name_ar?: string | null
          style_name_az?: string | null
          style_name_de?: string | null
          style_name_en?: string | null
          style_name_es?: string | null
          style_name_fr?: string | null
          style_name_hi?: string | null
          style_name_id?: string | null
          style_name_ja?: string | null
          style_name_ka?: string | null
          style_name_kk?: string | null
          style_name_ko?: string | null
          style_name_nl?: string | null
          style_name_pl?: string | null
          style_name_pt?: string | null
          style_name_ru?: string | null
          style_name_sv?: string | null
          style_name_tr?: string | null
          style_name_uz?: string | null
          style_name_vi?: string | null
          style_name_zh?: string | null
        }
        Relationships: []
      }
      photoshoot_outfits: {
        Row: {
          created_at: string | null
          emoji: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          outfit_id: string
          outfit_name: string
          outfit_name_ar: string | null
          outfit_name_az: string | null
          outfit_name_de: string | null
          outfit_name_en: string | null
          outfit_name_es: string | null
          outfit_name_fr: string | null
          outfit_name_hi: string | null
          outfit_name_id: string | null
          outfit_name_ja: string | null
          outfit_name_ka: string | null
          outfit_name_kk: string | null
          outfit_name_ko: string | null
          outfit_name_nl: string | null
          outfit_name_pl: string | null
          outfit_name_pt: string | null
          outfit_name_ru: string | null
          outfit_name_sv: string | null
          outfit_name_tr: string | null
          outfit_name_uz: string | null
          outfit_name_vi: string | null
          outfit_name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          outfit_id: string
          outfit_name: string
          outfit_name_ar?: string | null
          outfit_name_az?: string | null
          outfit_name_de?: string | null
          outfit_name_en?: string | null
          outfit_name_es?: string | null
          outfit_name_fr?: string | null
          outfit_name_hi?: string | null
          outfit_name_id?: string | null
          outfit_name_ja?: string | null
          outfit_name_ka?: string | null
          outfit_name_kk?: string | null
          outfit_name_ko?: string | null
          outfit_name_nl?: string | null
          outfit_name_pl?: string | null
          outfit_name_pt?: string | null
          outfit_name_ru?: string | null
          outfit_name_sv?: string | null
          outfit_name_tr?: string | null
          outfit_name_uz?: string | null
          outfit_name_vi?: string | null
          outfit_name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          outfit_id?: string
          outfit_name?: string
          outfit_name_ar?: string | null
          outfit_name_az?: string | null
          outfit_name_de?: string | null
          outfit_name_en?: string | null
          outfit_name_es?: string | null
          outfit_name_fr?: string | null
          outfit_name_hi?: string | null
          outfit_name_id?: string | null
          outfit_name_ja?: string | null
          outfit_name_ka?: string | null
          outfit_name_kk?: string | null
          outfit_name_ko?: string | null
          outfit_name_nl?: string | null
          outfit_name_pl?: string | null
          outfit_name_pt?: string | null
          outfit_name_ru?: string | null
          outfit_name_sv?: string | null
          outfit_name_tr?: string | null
          outfit_name_uz?: string | null
          outfit_name_vi?: string | null
          outfit_name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      photoshoot_themes: {
        Row: {
          category: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          name: string
          name_az: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_vi: string | null
          name_zh: string | null
          preview_url: string | null
          prompt_text: string | null
          sort_order: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          preview_url?: string | null
          prompt_text?: string | null
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name?: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          preview_url?: string | null
          prompt_text?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      place_amenities: {
        Row: {
          amenity_key: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
        }
        Insert: {
          amenity_key: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          amenity_key?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      place_categories: {
        Row: {
          category_key: string
          color_gradient: string | null
          created_at: string | null
          icon_name: string
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category_key: string
          color_gradient?: string | null
          created_at?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category_key?: string
          color_gradient?: string | null
          created_at?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      place_reviews: {
        Row: {
          accessibility_rating: number | null
          cleanliness_rating: number | null
          comment: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          place_id: string
          rating: number
          staff_rating: number | null
          user_id: string
        }
        Insert: {
          accessibility_rating?: number | null
          cleanliness_rating?: number | null
          comment?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          place_id: string
          rating: number
          staff_rating?: number | null
          user_id: string
        }
        Update: {
          accessibility_rating?: number | null
          cleanliness_rating?: number | null
          comment?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          place_id?: string
          rating?: number
          staff_rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mom_friendly_places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_verifications: {
        Row: {
          amenity_verified: string
          created_at: string | null
          id: string
          is_confirmed: boolean
          place_id: string
          user_id: string
        }
        Insert: {
          amenity_verified: string
          created_at?: string | null
          id?: string
          is_confirmed: boolean
          place_id: string
          user_id: string
        }
        Update: {
          amenity_verified?: string
          created_at?: string | null
          id?: string
          is_confirmed?: boolean
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_verifications_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mom_friendly_places"
            referencedColumns: ["id"]
          },
        ]
      }
      play_activities: {
        Row: {
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          difficulty_level: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          instructions: string | null
          instructions_ar: string | null
          instructions_az: string | null
          instructions_de: string | null
          instructions_en: string | null
          instructions_es: string | null
          instructions_fr: string | null
          instructions_hi: string | null
          instructions_id: string | null
          instructions_ja: string | null
          instructions_ka: string | null
          instructions_kk: string | null
          instructions_ko: string | null
          instructions_nl: string | null
          instructions_pl: string | null
          instructions_pt: string | null
          instructions_ru: string | null
          instructions_sv: string | null
          instructions_tr: string | null
          instructions_uz: string | null
          instructions_vi: string | null
          instructions_zh: string | null
          is_active: boolean | null
          max_age_days: number
          min_age_days: number
          required_items: string[] | null
          skill_tags: string[] | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          difficulty_level?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          instructions_ar?: string | null
          instructions_az?: string | null
          instructions_de?: string | null
          instructions_en?: string | null
          instructions_es?: string | null
          instructions_fr?: string | null
          instructions_hi?: string | null
          instructions_id?: string | null
          instructions_ja?: string | null
          instructions_ka?: string | null
          instructions_kk?: string | null
          instructions_ko?: string | null
          instructions_nl?: string | null
          instructions_pl?: string | null
          instructions_pt?: string | null
          instructions_ru?: string | null
          instructions_sv?: string | null
          instructions_tr?: string | null
          instructions_uz?: string | null
          instructions_vi?: string | null
          instructions_zh?: string | null
          is_active?: boolean | null
          max_age_days?: number
          min_age_days?: number
          required_items?: string[] | null
          skill_tags?: string[] | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          difficulty_level?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          instructions_ar?: string | null
          instructions_az?: string | null
          instructions_de?: string | null
          instructions_en?: string | null
          instructions_es?: string | null
          instructions_fr?: string | null
          instructions_hi?: string | null
          instructions_id?: string | null
          instructions_ja?: string | null
          instructions_ka?: string | null
          instructions_kk?: string | null
          instructions_ko?: string | null
          instructions_nl?: string | null
          instructions_pl?: string | null
          instructions_pt?: string | null
          instructions_ru?: string | null
          instructions_sv?: string | null
          instructions_tr?: string | null
          instructions_uz?: string | null
          instructions_vi?: string | null
          instructions_zh?: string | null
          is_active?: boolean | null
          max_age_days?: number
          min_age_days?: number
          required_items?: string[] | null
          skill_tags?: string[] | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      play_activity_logs: {
        Row: {
          activity_id: string
          completed_at: string | null
          id: string
          notes: string | null
          rating: number | null
          user_id: string
        }
        Insert: {
          activity_id: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          user_id: string
        }
        Update: {
          activity_id?: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_activity_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "play_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      play_inventory_items: {
        Row: {
          category: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      poop_analyses: {
        Row: {
          analysis_result: Json
          color_detected: string | null
          concern_level: string | null
          created_at: string
          id: string
          image_url: string | null
          is_normal: boolean | null
          user_id: string
        }
        Insert: {
          analysis_result: Json
          color_detected?: string | null
          concern_level?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_normal?: boolean | null
          user_id: string
        }
        Update: {
          analysis_result?: Json
          color_detected?: string | null
          concern_level?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_normal?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      poop_color_labels: {
        Row: {
          color_key: string
          created_at: string | null
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          hex_color: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
          status: string | null
        }
        Insert: {
          color_key: string
          created_at?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          hex_color?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          status?: string | null
        }
        Update: {
          color_key?: string
          created_at?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          hex_color?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          status?: string | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          is_anonymous: boolean
          is_pinned: boolean | null
          likes_count: number | null
          moderation_action_id: string | null
          moderation_edited_at: string | null
          moderation_edited_by: string | null
          moderation_reason: string | null
          moderation_removed_at: string | null
          moderation_version: number | null
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_anonymous?: boolean
          is_pinned?: boolean | null
          likes_count?: number | null
          moderation_action_id?: string | null
          moderation_edited_at?: string | null
          moderation_edited_by?: string | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_version?: number | null
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_anonymous?: boolean
          is_pinned?: boolean | null
          likes_count?: number | null
          moderation_action_id?: string | null
          moderation_edited_at?: string | null
          moderation_edited_by?: string | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_version?: number | null
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      pregnancy_album_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          month_number: number
          photo_date: string | null
          photo_url: string
          updated_at: string | null
          user_id: string
          week_number: number
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          month_number: number
          photo_date?: string | null
          photo_url: string
          updated_at?: string | null
          user_id: string
          week_number: number
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          month_number?: number
          photo_date?: string | null
          photo_url?: string
          updated_at?: string | null
          user_id?: string
          week_number?: number
        }
        Relationships: []
      }
      pregnancy_daily_content: {
        Row: {
          baby_development: string | null
          baby_development_ar: string | null
          baby_development_de: string | null
          baby_development_en: string | null
          baby_development_es: string | null
          baby_development_fr: string | null
          baby_development_hi: string | null
          baby_development_id: string | null
          baby_development_ja: string | null
          baby_development_ka: string | null
          baby_development_kk: string | null
          baby_development_ko: string | null
          baby_development_nl: string | null
          baby_development_pl: string | null
          baby_development_pt: string | null
          baby_development_ru: string | null
          baby_development_sv: string | null
          baby_development_tr: string | null
          baby_development_uz: string | null
          baby_development_vi: string | null
          baby_development_zh: string | null
          baby_message: string | null
          baby_message_ar: string | null
          baby_message_de: string | null
          baby_message_en: string | null
          baby_message_es: string | null
          baby_message_fr: string | null
          baby_message_hi: string | null
          baby_message_id: string | null
          baby_message_ja: string | null
          baby_message_ka: string | null
          baby_message_kk: string | null
          baby_message_ko: string | null
          baby_message_nl: string | null
          baby_message_pl: string | null
          baby_message_pt: string | null
          baby_message_ru: string | null
          baby_message_sv: string | null
          baby_message_tr: string | null
          baby_message_uz: string | null
          baby_message_vi: string | null
          baby_message_zh: string | null
          baby_size_cm: number | null
          baby_size_fruit: string | null
          baby_size_fruit_ar: string | null
          baby_size_fruit_de: string | null
          baby_size_fruit_en: string | null
          baby_size_fruit_es: string | null
          baby_size_fruit_fr: string | null
          baby_size_fruit_hi: string | null
          baby_size_fruit_id: string | null
          baby_size_fruit_ja: string | null
          baby_size_fruit_ka: string | null
          baby_size_fruit_kk: string | null
          baby_size_fruit_ko: string | null
          baby_size_fruit_nl: string | null
          baby_size_fruit_pl: string | null
          baby_size_fruit_pt: string | null
          baby_size_fruit_ru: string | null
          baby_size_fruit_sv: string | null
          baby_size_fruit_tr: string | null
          baby_size_fruit_uz: string | null
          baby_size_fruit_vi: string | null
          baby_size_fruit_zh: string | null
          baby_weight_gram: number | null
          body_changes: string | null
          body_changes_ar: string | null
          body_changes_de: string | null
          body_changes_en: string | null
          body_changes_es: string | null
          body_changes_fr: string | null
          body_changes_hi: string | null
          body_changes_id: string | null
          body_changes_ja: string | null
          body_changes_ka: string | null
          body_changes_kk: string | null
          body_changes_ko: string | null
          body_changes_nl: string | null
          body_changes_pl: string | null
          body_changes_pt: string | null
          body_changes_ru: string | null
          body_changes_sv: string | null
          body_changes_tr: string | null
          body_changes_uz: string | null
          body_changes_vi: string | null
          body_changes_zh: string | null
          created_at: string
          daily_tip: string | null
          daily_tip_ar: string | null
          daily_tip_de: string | null
          daily_tip_en: string | null
          daily_tip_es: string | null
          daily_tip_fr: string | null
          daily_tip_hi: string | null
          daily_tip_id: string | null
          daily_tip_ja: string | null
          daily_tip_ka: string | null
          daily_tip_kk: string | null
          daily_tip_ko: string | null
          daily_tip_nl: string | null
          daily_tip_pl: string | null
          daily_tip_pt: string | null
          daily_tip_ru: string | null
          daily_tip_sv: string | null
          daily_tip_tr: string | null
          daily_tip_uz: string | null
          daily_tip_vi: string | null
          daily_tip_zh: string | null
          day_number: number | null
          days_until_birth: number | null
          doctor_visit_tip: string | null
          doctor_visit_tip_ar: string | null
          doctor_visit_tip_de: string | null
          doctor_visit_tip_en: string | null
          doctor_visit_tip_es: string | null
          doctor_visit_tip_fr: string | null
          doctor_visit_tip_hi: string | null
          doctor_visit_tip_id: string | null
          doctor_visit_tip_ja: string | null
          doctor_visit_tip_ka: string | null
          doctor_visit_tip_kk: string | null
          doctor_visit_tip_ko: string | null
          doctor_visit_tip_nl: string | null
          doctor_visit_tip_pl: string | null
          doctor_visit_tip_pt: string | null
          doctor_visit_tip_ru: string | null
          doctor_visit_tip_sv: string | null
          doctor_visit_tip_tr: string | null
          doctor_visit_tip_uz: string | null
          doctor_visit_tip_vi: string | null
          doctor_visit_tip_zh: string | null
          emotional_tip: string | null
          emotional_tip_ar: string | null
          emotional_tip_de: string | null
          emotional_tip_en: string | null
          emotional_tip_es: string | null
          emotional_tip_fr: string | null
          emotional_tip_hi: string | null
          emotional_tip_id: string | null
          emotional_tip_ja: string | null
          emotional_tip_ka: string | null
          emotional_tip_kk: string | null
          emotional_tip_ko: string | null
          emotional_tip_nl: string | null
          emotional_tip_pl: string | null
          emotional_tip_pt: string | null
          emotional_tip_ru: string | null
          emotional_tip_sv: string | null
          emotional_tip_tr: string | null
          emotional_tip_uz: string | null
          emotional_tip_vi: string | null
          emotional_tip_zh: string | null
          exercise_tip: string | null
          exercise_tip_ar: string | null
          exercise_tip_de: string | null
          exercise_tip_en: string | null
          exercise_tip_es: string | null
          exercise_tip_fr: string | null
          exercise_tip_hi: string | null
          exercise_tip_id: string | null
          exercise_tip_ja: string | null
          exercise_tip_ka: string | null
          exercise_tip_kk: string | null
          exercise_tip_ko: string | null
          exercise_tip_nl: string | null
          exercise_tip_pl: string | null
          exercise_tip_pt: string | null
          exercise_tip_ru: string | null
          exercise_tip_sv: string | null
          exercise_tip_tr: string | null
          exercise_tip_uz: string | null
          exercise_tip_vi: string | null
          exercise_tip_zh: string | null
          foods_to_avoid: string[] | null
          foods_to_avoid_ar: string[] | null
          foods_to_avoid_de: string[] | null
          foods_to_avoid_en: string[] | null
          foods_to_avoid_es: string[] | null
          foods_to_avoid_fr: string[] | null
          foods_to_avoid_hi: string[] | null
          foods_to_avoid_id: string[] | null
          foods_to_avoid_ja: string[] | null
          foods_to_avoid_ka: string[] | null
          foods_to_avoid_kk: string[] | null
          foods_to_avoid_ko: string[] | null
          foods_to_avoid_nl: string[] | null
          foods_to_avoid_pl: string[] | null
          foods_to_avoid_pt: string[] | null
          foods_to_avoid_ru: string[] | null
          foods_to_avoid_sv: string[] | null
          foods_to_avoid_tr: string[] | null
          foods_to_avoid_uz: string[] | null
          foods_to_avoid_vi: string[] | null
          foods_to_avoid_zh: string[] | null
          id: string
          image_url: string | null
          is_active: boolean | null
          mother_symptoms: string[] | null
          mother_symptoms_ar: string[] | null
          mother_symptoms_de: string[] | null
          mother_symptoms_en: string[] | null
          mother_symptoms_es: string[] | null
          mother_symptoms_fr: string[] | null
          mother_symptoms_hi: string[] | null
          mother_symptoms_id: string[] | null
          mother_symptoms_ja: string[] | null
          mother_symptoms_ka: string[] | null
          mother_symptoms_kk: string[] | null
          mother_symptoms_ko: string[] | null
          mother_symptoms_nl: string[] | null
          mother_symptoms_pl: string[] | null
          mother_symptoms_pt: string[] | null
          mother_symptoms_ru: string[] | null
          mother_symptoms_sv: string[] | null
          mother_symptoms_tr: string[] | null
          mother_symptoms_uz: string[] | null
          mother_symptoms_vi: string[] | null
          mother_symptoms_zh: string[] | null
          mother_tips: string | null
          mother_tips_ar: string | null
          mother_tips_de: string | null
          mother_tips_en: string | null
          mother_tips_es: string | null
          mother_tips_fr: string | null
          mother_tips_hi: string | null
          mother_tips_id: string | null
          mother_tips_ja: string | null
          mother_tips_ka: string | null
          mother_tips_kk: string | null
          mother_tips_ko: string | null
          mother_tips_nl: string | null
          mother_tips_pl: string | null
          mother_tips_pt: string | null
          mother_tips_ru: string | null
          mother_tips_sv: string | null
          mother_tips_tr: string | null
          mother_tips_uz: string | null
          mother_tips_vi: string | null
          mother_tips_zh: string | null
          mother_warnings: string | null
          mother_warnings_ar: string | null
          mother_warnings_de: string | null
          mother_warnings_en: string | null
          mother_warnings_es: string | null
          mother_warnings_fr: string | null
          mother_warnings_hi: string | null
          mother_warnings_id: string | null
          mother_warnings_ja: string | null
          mother_warnings_ka: string | null
          mother_warnings_kk: string | null
          mother_warnings_ko: string | null
          mother_warnings_nl: string | null
          mother_warnings_pl: string | null
          mother_warnings_pt: string | null
          mother_warnings_ru: string | null
          mother_warnings_sv: string | null
          mother_warnings_tr: string | null
          mother_warnings_uz: string | null
          mother_warnings_vi: string | null
          mother_warnings_zh: string | null
          multiples_tip_az: string | null
          multiples_tip_es: string | null
          multiples_tip_fr: string | null
          multiples_tip_hi: string | null
          multiples_tip_id: string | null
          multiples_tip_ja: string | null
          multiples_tip_ko: string | null
          multiples_tip_nl: string | null
          multiples_tip_pl: string | null
          multiples_tip_pt: string | null
          multiples_tip_sv: string | null
          multiples_tip_vi: string | null
          multiples_tip_zh: string | null
          nutrition_tip: string | null
          nutrition_tip_ar: string | null
          nutrition_tip_de: string | null
          nutrition_tip_en: string | null
          nutrition_tip_es: string | null
          nutrition_tip_fr: string | null
          nutrition_tip_hi: string | null
          nutrition_tip_id: string | null
          nutrition_tip_ja: string | null
          nutrition_tip_ka: string | null
          nutrition_tip_kk: string | null
          nutrition_tip_ko: string | null
          nutrition_tip_nl: string | null
          nutrition_tip_pl: string | null
          nutrition_tip_pt: string | null
          nutrition_tip_ru: string | null
          nutrition_tip_sv: string | null
          nutrition_tip_tr: string | null
          nutrition_tip_uz: string | null
          nutrition_tip_vi: string | null
          nutrition_tip_zh: string | null
          partner_tip: string | null
          partner_tip_ar: string | null
          partner_tip_de: string | null
          partner_tip_en: string | null
          partner_tip_es: string | null
          partner_tip_fr: string | null
          partner_tip_hi: string | null
          partner_tip_id: string | null
          partner_tip_ja: string | null
          partner_tip_ka: string | null
          partner_tip_kk: string | null
          partner_tip_ko: string | null
          partner_tip_nl: string | null
          partner_tip_pl: string | null
          partner_tip_pt: string | null
          partner_tip_ru: string | null
          partner_tip_sv: string | null
          partner_tip_tr: string | null
          partner_tip_uz: string | null
          partner_tip_vi: string | null
          partner_tip_zh: string | null
          pregnancy_day: number | null
          recommended_exercises: string[] | null
          recommended_exercises_ar: string[] | null
          recommended_exercises_de: string[] | null
          recommended_exercises_en: string[] | null
          recommended_exercises_es: string[] | null
          recommended_exercises_fr: string[] | null
          recommended_exercises_hi: string[] | null
          recommended_exercises_id: string[] | null
          recommended_exercises_ja: string[] | null
          recommended_exercises_ka: string[] | null
          recommended_exercises_kk: string[] | null
          recommended_exercises_ko: string[] | null
          recommended_exercises_nl: string[] | null
          recommended_exercises_pl: string[] | null
          recommended_exercises_pt: string[] | null
          recommended_exercises_ru: string[] | null
          recommended_exercises_sv: string[] | null
          recommended_exercises_tr: string[] | null
          recommended_exercises_uz: string[] | null
          recommended_exercises_vi: string[] | null
          recommended_exercises_zh: string[] | null
          recommended_foods: string[] | null
          recommended_foods_ar: string[] | null
          recommended_foods_de: string[] | null
          recommended_foods_en: string[] | null
          recommended_foods_es: string[] | null
          recommended_foods_fr: string[] | null
          recommended_foods_hi: string[] | null
          recommended_foods_id: string[] | null
          recommended_foods_ja: string[] | null
          recommended_foods_ka: string[] | null
          recommended_foods_kk: string[] | null
          recommended_foods_ko: string[] | null
          recommended_foods_nl: string[] | null
          recommended_foods_pl: string[] | null
          recommended_foods_pt: string[] | null
          recommended_foods_ru: string[] | null
          recommended_foods_sv: string[] | null
          recommended_foods_tr: string[] | null
          recommended_foods_uz: string[] | null
          recommended_foods_vi: string[] | null
          recommended_foods_zh: string[] | null
          tests_to_do: string[] | null
          tests_to_do_ar: string[] | null
          tests_to_do_de: string[] | null
          tests_to_do_en: string[] | null
          tests_to_do_es: string[] | null
          tests_to_do_fr: string[] | null
          tests_to_do_hi: string[] | null
          tests_to_do_id: string[] | null
          tests_to_do_ja: string[] | null
          tests_to_do_ka: string[] | null
          tests_to_do_kk: string[] | null
          tests_to_do_ko: string[] | null
          tests_to_do_nl: string[] | null
          tests_to_do_pl: string[] | null
          tests_to_do_pt: string[] | null
          tests_to_do_ru: string[] | null
          tests_to_do_sv: string[] | null
          tests_to_do_tr: string[] | null
          tests_to_do_uz: string[] | null
          tests_to_do_vi: string[] | null
          tests_to_do_zh: string[] | null
          updated_at: string
          video_url: string | null
          week_number: number
        }
        Insert: {
          baby_development?: string | null
          baby_development_ar?: string | null
          baby_development_de?: string | null
          baby_development_en?: string | null
          baby_development_es?: string | null
          baby_development_fr?: string | null
          baby_development_hi?: string | null
          baby_development_id?: string | null
          baby_development_ja?: string | null
          baby_development_ka?: string | null
          baby_development_kk?: string | null
          baby_development_ko?: string | null
          baby_development_nl?: string | null
          baby_development_pl?: string | null
          baby_development_pt?: string | null
          baby_development_ru?: string | null
          baby_development_sv?: string | null
          baby_development_tr?: string | null
          baby_development_uz?: string | null
          baby_development_vi?: string | null
          baby_development_zh?: string | null
          baby_message?: string | null
          baby_message_ar?: string | null
          baby_message_de?: string | null
          baby_message_en?: string | null
          baby_message_es?: string | null
          baby_message_fr?: string | null
          baby_message_hi?: string | null
          baby_message_id?: string | null
          baby_message_ja?: string | null
          baby_message_ka?: string | null
          baby_message_kk?: string | null
          baby_message_ko?: string | null
          baby_message_nl?: string | null
          baby_message_pl?: string | null
          baby_message_pt?: string | null
          baby_message_ru?: string | null
          baby_message_sv?: string | null
          baby_message_tr?: string | null
          baby_message_uz?: string | null
          baby_message_vi?: string | null
          baby_message_zh?: string | null
          baby_size_cm?: number | null
          baby_size_fruit?: string | null
          baby_size_fruit_ar?: string | null
          baby_size_fruit_de?: string | null
          baby_size_fruit_en?: string | null
          baby_size_fruit_es?: string | null
          baby_size_fruit_fr?: string | null
          baby_size_fruit_hi?: string | null
          baby_size_fruit_id?: string | null
          baby_size_fruit_ja?: string | null
          baby_size_fruit_ka?: string | null
          baby_size_fruit_kk?: string | null
          baby_size_fruit_ko?: string | null
          baby_size_fruit_nl?: string | null
          baby_size_fruit_pl?: string | null
          baby_size_fruit_pt?: string | null
          baby_size_fruit_ru?: string | null
          baby_size_fruit_sv?: string | null
          baby_size_fruit_tr?: string | null
          baby_size_fruit_uz?: string | null
          baby_size_fruit_vi?: string | null
          baby_size_fruit_zh?: string | null
          baby_weight_gram?: number | null
          body_changes?: string | null
          body_changes_ar?: string | null
          body_changes_de?: string | null
          body_changes_en?: string | null
          body_changes_es?: string | null
          body_changes_fr?: string | null
          body_changes_hi?: string | null
          body_changes_id?: string | null
          body_changes_ja?: string | null
          body_changes_ka?: string | null
          body_changes_kk?: string | null
          body_changes_ko?: string | null
          body_changes_nl?: string | null
          body_changes_pl?: string | null
          body_changes_pt?: string | null
          body_changes_ru?: string | null
          body_changes_sv?: string | null
          body_changes_tr?: string | null
          body_changes_uz?: string | null
          body_changes_vi?: string | null
          body_changes_zh?: string | null
          created_at?: string
          daily_tip?: string | null
          daily_tip_ar?: string | null
          daily_tip_de?: string | null
          daily_tip_en?: string | null
          daily_tip_es?: string | null
          daily_tip_fr?: string | null
          daily_tip_hi?: string | null
          daily_tip_id?: string | null
          daily_tip_ja?: string | null
          daily_tip_ka?: string | null
          daily_tip_kk?: string | null
          daily_tip_ko?: string | null
          daily_tip_nl?: string | null
          daily_tip_pl?: string | null
          daily_tip_pt?: string | null
          daily_tip_ru?: string | null
          daily_tip_sv?: string | null
          daily_tip_tr?: string | null
          daily_tip_uz?: string | null
          daily_tip_vi?: string | null
          daily_tip_zh?: string | null
          day_number?: number | null
          days_until_birth?: number | null
          doctor_visit_tip?: string | null
          doctor_visit_tip_ar?: string | null
          doctor_visit_tip_de?: string | null
          doctor_visit_tip_en?: string | null
          doctor_visit_tip_es?: string | null
          doctor_visit_tip_fr?: string | null
          doctor_visit_tip_hi?: string | null
          doctor_visit_tip_id?: string | null
          doctor_visit_tip_ja?: string | null
          doctor_visit_tip_ka?: string | null
          doctor_visit_tip_kk?: string | null
          doctor_visit_tip_ko?: string | null
          doctor_visit_tip_nl?: string | null
          doctor_visit_tip_pl?: string | null
          doctor_visit_tip_pt?: string | null
          doctor_visit_tip_ru?: string | null
          doctor_visit_tip_sv?: string | null
          doctor_visit_tip_tr?: string | null
          doctor_visit_tip_uz?: string | null
          doctor_visit_tip_vi?: string | null
          doctor_visit_tip_zh?: string | null
          emotional_tip?: string | null
          emotional_tip_ar?: string | null
          emotional_tip_de?: string | null
          emotional_tip_en?: string | null
          emotional_tip_es?: string | null
          emotional_tip_fr?: string | null
          emotional_tip_hi?: string | null
          emotional_tip_id?: string | null
          emotional_tip_ja?: string | null
          emotional_tip_ka?: string | null
          emotional_tip_kk?: string | null
          emotional_tip_ko?: string | null
          emotional_tip_nl?: string | null
          emotional_tip_pl?: string | null
          emotional_tip_pt?: string | null
          emotional_tip_ru?: string | null
          emotional_tip_sv?: string | null
          emotional_tip_tr?: string | null
          emotional_tip_uz?: string | null
          emotional_tip_vi?: string | null
          emotional_tip_zh?: string | null
          exercise_tip?: string | null
          exercise_tip_ar?: string | null
          exercise_tip_de?: string | null
          exercise_tip_en?: string | null
          exercise_tip_es?: string | null
          exercise_tip_fr?: string | null
          exercise_tip_hi?: string | null
          exercise_tip_id?: string | null
          exercise_tip_ja?: string | null
          exercise_tip_ka?: string | null
          exercise_tip_kk?: string | null
          exercise_tip_ko?: string | null
          exercise_tip_nl?: string | null
          exercise_tip_pl?: string | null
          exercise_tip_pt?: string | null
          exercise_tip_ru?: string | null
          exercise_tip_sv?: string | null
          exercise_tip_tr?: string | null
          exercise_tip_uz?: string | null
          exercise_tip_vi?: string | null
          exercise_tip_zh?: string | null
          foods_to_avoid?: string[] | null
          foods_to_avoid_ar?: string[] | null
          foods_to_avoid_de?: string[] | null
          foods_to_avoid_en?: string[] | null
          foods_to_avoid_es?: string[] | null
          foods_to_avoid_fr?: string[] | null
          foods_to_avoid_hi?: string[] | null
          foods_to_avoid_id?: string[] | null
          foods_to_avoid_ja?: string[] | null
          foods_to_avoid_ka?: string[] | null
          foods_to_avoid_kk?: string[] | null
          foods_to_avoid_ko?: string[] | null
          foods_to_avoid_nl?: string[] | null
          foods_to_avoid_pl?: string[] | null
          foods_to_avoid_pt?: string[] | null
          foods_to_avoid_ru?: string[] | null
          foods_to_avoid_sv?: string[] | null
          foods_to_avoid_tr?: string[] | null
          foods_to_avoid_uz?: string[] | null
          foods_to_avoid_vi?: string[] | null
          foods_to_avoid_zh?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          mother_symptoms?: string[] | null
          mother_symptoms_ar?: string[] | null
          mother_symptoms_de?: string[] | null
          mother_symptoms_en?: string[] | null
          mother_symptoms_es?: string[] | null
          mother_symptoms_fr?: string[] | null
          mother_symptoms_hi?: string[] | null
          mother_symptoms_id?: string[] | null
          mother_symptoms_ja?: string[] | null
          mother_symptoms_ka?: string[] | null
          mother_symptoms_kk?: string[] | null
          mother_symptoms_ko?: string[] | null
          mother_symptoms_nl?: string[] | null
          mother_symptoms_pl?: string[] | null
          mother_symptoms_pt?: string[] | null
          mother_symptoms_ru?: string[] | null
          mother_symptoms_sv?: string[] | null
          mother_symptoms_tr?: string[] | null
          mother_symptoms_uz?: string[] | null
          mother_symptoms_vi?: string[] | null
          mother_symptoms_zh?: string[] | null
          mother_tips?: string | null
          mother_tips_ar?: string | null
          mother_tips_de?: string | null
          mother_tips_en?: string | null
          mother_tips_es?: string | null
          mother_tips_fr?: string | null
          mother_tips_hi?: string | null
          mother_tips_id?: string | null
          mother_tips_ja?: string | null
          mother_tips_ka?: string | null
          mother_tips_kk?: string | null
          mother_tips_ko?: string | null
          mother_tips_nl?: string | null
          mother_tips_pl?: string | null
          mother_tips_pt?: string | null
          mother_tips_ru?: string | null
          mother_tips_sv?: string | null
          mother_tips_tr?: string | null
          mother_tips_uz?: string | null
          mother_tips_vi?: string | null
          mother_tips_zh?: string | null
          mother_warnings?: string | null
          mother_warnings_ar?: string | null
          mother_warnings_de?: string | null
          mother_warnings_en?: string | null
          mother_warnings_es?: string | null
          mother_warnings_fr?: string | null
          mother_warnings_hi?: string | null
          mother_warnings_id?: string | null
          mother_warnings_ja?: string | null
          mother_warnings_ka?: string | null
          mother_warnings_kk?: string | null
          mother_warnings_ko?: string | null
          mother_warnings_nl?: string | null
          mother_warnings_pl?: string | null
          mother_warnings_pt?: string | null
          mother_warnings_ru?: string | null
          mother_warnings_sv?: string | null
          mother_warnings_tr?: string | null
          mother_warnings_uz?: string | null
          mother_warnings_vi?: string | null
          mother_warnings_zh?: string | null
          multiples_tip_az?: string | null
          multiples_tip_es?: string | null
          multiples_tip_fr?: string | null
          multiples_tip_hi?: string | null
          multiples_tip_id?: string | null
          multiples_tip_ja?: string | null
          multiples_tip_ko?: string | null
          multiples_tip_nl?: string | null
          multiples_tip_pl?: string | null
          multiples_tip_pt?: string | null
          multiples_tip_sv?: string | null
          multiples_tip_vi?: string | null
          multiples_tip_zh?: string | null
          nutrition_tip?: string | null
          nutrition_tip_ar?: string | null
          nutrition_tip_de?: string | null
          nutrition_tip_en?: string | null
          nutrition_tip_es?: string | null
          nutrition_tip_fr?: string | null
          nutrition_tip_hi?: string | null
          nutrition_tip_id?: string | null
          nutrition_tip_ja?: string | null
          nutrition_tip_ka?: string | null
          nutrition_tip_kk?: string | null
          nutrition_tip_ko?: string | null
          nutrition_tip_nl?: string | null
          nutrition_tip_pl?: string | null
          nutrition_tip_pt?: string | null
          nutrition_tip_ru?: string | null
          nutrition_tip_sv?: string | null
          nutrition_tip_tr?: string | null
          nutrition_tip_uz?: string | null
          nutrition_tip_vi?: string | null
          nutrition_tip_zh?: string | null
          partner_tip?: string | null
          partner_tip_ar?: string | null
          partner_tip_de?: string | null
          partner_tip_en?: string | null
          partner_tip_es?: string | null
          partner_tip_fr?: string | null
          partner_tip_hi?: string | null
          partner_tip_id?: string | null
          partner_tip_ja?: string | null
          partner_tip_ka?: string | null
          partner_tip_kk?: string | null
          partner_tip_ko?: string | null
          partner_tip_nl?: string | null
          partner_tip_pl?: string | null
          partner_tip_pt?: string | null
          partner_tip_ru?: string | null
          partner_tip_sv?: string | null
          partner_tip_tr?: string | null
          partner_tip_uz?: string | null
          partner_tip_vi?: string | null
          partner_tip_zh?: string | null
          pregnancy_day?: number | null
          recommended_exercises?: string[] | null
          recommended_exercises_ar?: string[] | null
          recommended_exercises_de?: string[] | null
          recommended_exercises_en?: string[] | null
          recommended_exercises_es?: string[] | null
          recommended_exercises_fr?: string[] | null
          recommended_exercises_hi?: string[] | null
          recommended_exercises_id?: string[] | null
          recommended_exercises_ja?: string[] | null
          recommended_exercises_ka?: string[] | null
          recommended_exercises_kk?: string[] | null
          recommended_exercises_ko?: string[] | null
          recommended_exercises_nl?: string[] | null
          recommended_exercises_pl?: string[] | null
          recommended_exercises_pt?: string[] | null
          recommended_exercises_ru?: string[] | null
          recommended_exercises_sv?: string[] | null
          recommended_exercises_tr?: string[] | null
          recommended_exercises_uz?: string[] | null
          recommended_exercises_vi?: string[] | null
          recommended_exercises_zh?: string[] | null
          recommended_foods?: string[] | null
          recommended_foods_ar?: string[] | null
          recommended_foods_de?: string[] | null
          recommended_foods_en?: string[] | null
          recommended_foods_es?: string[] | null
          recommended_foods_fr?: string[] | null
          recommended_foods_hi?: string[] | null
          recommended_foods_id?: string[] | null
          recommended_foods_ja?: string[] | null
          recommended_foods_ka?: string[] | null
          recommended_foods_kk?: string[] | null
          recommended_foods_ko?: string[] | null
          recommended_foods_nl?: string[] | null
          recommended_foods_pl?: string[] | null
          recommended_foods_pt?: string[] | null
          recommended_foods_ru?: string[] | null
          recommended_foods_sv?: string[] | null
          recommended_foods_tr?: string[] | null
          recommended_foods_uz?: string[] | null
          recommended_foods_vi?: string[] | null
          recommended_foods_zh?: string[] | null
          tests_to_do?: string[] | null
          tests_to_do_ar?: string[] | null
          tests_to_do_de?: string[] | null
          tests_to_do_en?: string[] | null
          tests_to_do_es?: string[] | null
          tests_to_do_fr?: string[] | null
          tests_to_do_hi?: string[] | null
          tests_to_do_id?: string[] | null
          tests_to_do_ja?: string[] | null
          tests_to_do_ka?: string[] | null
          tests_to_do_kk?: string[] | null
          tests_to_do_ko?: string[] | null
          tests_to_do_nl?: string[] | null
          tests_to_do_pl?: string[] | null
          tests_to_do_pt?: string[] | null
          tests_to_do_ru?: string[] | null
          tests_to_do_sv?: string[] | null
          tests_to_do_tr?: string[] | null
          tests_to_do_uz?: string[] | null
          tests_to_do_vi?: string[] | null
          tests_to_do_zh?: string[] | null
          updated_at?: string
          video_url?: string | null
          week_number: number
        }
        Update: {
          baby_development?: string | null
          baby_development_ar?: string | null
          baby_development_de?: string | null
          baby_development_en?: string | null
          baby_development_es?: string | null
          baby_development_fr?: string | null
          baby_development_hi?: string | null
          baby_development_id?: string | null
          baby_development_ja?: string | null
          baby_development_ka?: string | null
          baby_development_kk?: string | null
          baby_development_ko?: string | null
          baby_development_nl?: string | null
          baby_development_pl?: string | null
          baby_development_pt?: string | null
          baby_development_ru?: string | null
          baby_development_sv?: string | null
          baby_development_tr?: string | null
          baby_development_uz?: string | null
          baby_development_vi?: string | null
          baby_development_zh?: string | null
          baby_message?: string | null
          baby_message_ar?: string | null
          baby_message_de?: string | null
          baby_message_en?: string | null
          baby_message_es?: string | null
          baby_message_fr?: string | null
          baby_message_hi?: string | null
          baby_message_id?: string | null
          baby_message_ja?: string | null
          baby_message_ka?: string | null
          baby_message_kk?: string | null
          baby_message_ko?: string | null
          baby_message_nl?: string | null
          baby_message_pl?: string | null
          baby_message_pt?: string | null
          baby_message_ru?: string | null
          baby_message_sv?: string | null
          baby_message_tr?: string | null
          baby_message_uz?: string | null
          baby_message_vi?: string | null
          baby_message_zh?: string | null
          baby_size_cm?: number | null
          baby_size_fruit?: string | null
          baby_size_fruit_ar?: string | null
          baby_size_fruit_de?: string | null
          baby_size_fruit_en?: string | null
          baby_size_fruit_es?: string | null
          baby_size_fruit_fr?: string | null
          baby_size_fruit_hi?: string | null
          baby_size_fruit_id?: string | null
          baby_size_fruit_ja?: string | null
          baby_size_fruit_ka?: string | null
          baby_size_fruit_kk?: string | null
          baby_size_fruit_ko?: string | null
          baby_size_fruit_nl?: string | null
          baby_size_fruit_pl?: string | null
          baby_size_fruit_pt?: string | null
          baby_size_fruit_ru?: string | null
          baby_size_fruit_sv?: string | null
          baby_size_fruit_tr?: string | null
          baby_size_fruit_uz?: string | null
          baby_size_fruit_vi?: string | null
          baby_size_fruit_zh?: string | null
          baby_weight_gram?: number | null
          body_changes?: string | null
          body_changes_ar?: string | null
          body_changes_de?: string | null
          body_changes_en?: string | null
          body_changes_es?: string | null
          body_changes_fr?: string | null
          body_changes_hi?: string | null
          body_changes_id?: string | null
          body_changes_ja?: string | null
          body_changes_ka?: string | null
          body_changes_kk?: string | null
          body_changes_ko?: string | null
          body_changes_nl?: string | null
          body_changes_pl?: string | null
          body_changes_pt?: string | null
          body_changes_ru?: string | null
          body_changes_sv?: string | null
          body_changes_tr?: string | null
          body_changes_uz?: string | null
          body_changes_vi?: string | null
          body_changes_zh?: string | null
          created_at?: string
          daily_tip?: string | null
          daily_tip_ar?: string | null
          daily_tip_de?: string | null
          daily_tip_en?: string | null
          daily_tip_es?: string | null
          daily_tip_fr?: string | null
          daily_tip_hi?: string | null
          daily_tip_id?: string | null
          daily_tip_ja?: string | null
          daily_tip_ka?: string | null
          daily_tip_kk?: string | null
          daily_tip_ko?: string | null
          daily_tip_nl?: string | null
          daily_tip_pl?: string | null
          daily_tip_pt?: string | null
          daily_tip_ru?: string | null
          daily_tip_sv?: string | null
          daily_tip_tr?: string | null
          daily_tip_uz?: string | null
          daily_tip_vi?: string | null
          daily_tip_zh?: string | null
          day_number?: number | null
          days_until_birth?: number | null
          doctor_visit_tip?: string | null
          doctor_visit_tip_ar?: string | null
          doctor_visit_tip_de?: string | null
          doctor_visit_tip_en?: string | null
          doctor_visit_tip_es?: string | null
          doctor_visit_tip_fr?: string | null
          doctor_visit_tip_hi?: string | null
          doctor_visit_tip_id?: string | null
          doctor_visit_tip_ja?: string | null
          doctor_visit_tip_ka?: string | null
          doctor_visit_tip_kk?: string | null
          doctor_visit_tip_ko?: string | null
          doctor_visit_tip_nl?: string | null
          doctor_visit_tip_pl?: string | null
          doctor_visit_tip_pt?: string | null
          doctor_visit_tip_ru?: string | null
          doctor_visit_tip_sv?: string | null
          doctor_visit_tip_tr?: string | null
          doctor_visit_tip_uz?: string | null
          doctor_visit_tip_vi?: string | null
          doctor_visit_tip_zh?: string | null
          emotional_tip?: string | null
          emotional_tip_ar?: string | null
          emotional_tip_de?: string | null
          emotional_tip_en?: string | null
          emotional_tip_es?: string | null
          emotional_tip_fr?: string | null
          emotional_tip_hi?: string | null
          emotional_tip_id?: string | null
          emotional_tip_ja?: string | null
          emotional_tip_ka?: string | null
          emotional_tip_kk?: string | null
          emotional_tip_ko?: string | null
          emotional_tip_nl?: string | null
          emotional_tip_pl?: string | null
          emotional_tip_pt?: string | null
          emotional_tip_ru?: string | null
          emotional_tip_sv?: string | null
          emotional_tip_tr?: string | null
          emotional_tip_uz?: string | null
          emotional_tip_vi?: string | null
          emotional_tip_zh?: string | null
          exercise_tip?: string | null
          exercise_tip_ar?: string | null
          exercise_tip_de?: string | null
          exercise_tip_en?: string | null
          exercise_tip_es?: string | null
          exercise_tip_fr?: string | null
          exercise_tip_hi?: string | null
          exercise_tip_id?: string | null
          exercise_tip_ja?: string | null
          exercise_tip_ka?: string | null
          exercise_tip_kk?: string | null
          exercise_tip_ko?: string | null
          exercise_tip_nl?: string | null
          exercise_tip_pl?: string | null
          exercise_tip_pt?: string | null
          exercise_tip_ru?: string | null
          exercise_tip_sv?: string | null
          exercise_tip_tr?: string | null
          exercise_tip_uz?: string | null
          exercise_tip_vi?: string | null
          exercise_tip_zh?: string | null
          foods_to_avoid?: string[] | null
          foods_to_avoid_ar?: string[] | null
          foods_to_avoid_de?: string[] | null
          foods_to_avoid_en?: string[] | null
          foods_to_avoid_es?: string[] | null
          foods_to_avoid_fr?: string[] | null
          foods_to_avoid_hi?: string[] | null
          foods_to_avoid_id?: string[] | null
          foods_to_avoid_ja?: string[] | null
          foods_to_avoid_ka?: string[] | null
          foods_to_avoid_kk?: string[] | null
          foods_to_avoid_ko?: string[] | null
          foods_to_avoid_nl?: string[] | null
          foods_to_avoid_pl?: string[] | null
          foods_to_avoid_pt?: string[] | null
          foods_to_avoid_ru?: string[] | null
          foods_to_avoid_sv?: string[] | null
          foods_to_avoid_tr?: string[] | null
          foods_to_avoid_uz?: string[] | null
          foods_to_avoid_vi?: string[] | null
          foods_to_avoid_zh?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          mother_symptoms?: string[] | null
          mother_symptoms_ar?: string[] | null
          mother_symptoms_de?: string[] | null
          mother_symptoms_en?: string[] | null
          mother_symptoms_es?: string[] | null
          mother_symptoms_fr?: string[] | null
          mother_symptoms_hi?: string[] | null
          mother_symptoms_id?: string[] | null
          mother_symptoms_ja?: string[] | null
          mother_symptoms_ka?: string[] | null
          mother_symptoms_kk?: string[] | null
          mother_symptoms_ko?: string[] | null
          mother_symptoms_nl?: string[] | null
          mother_symptoms_pl?: string[] | null
          mother_symptoms_pt?: string[] | null
          mother_symptoms_ru?: string[] | null
          mother_symptoms_sv?: string[] | null
          mother_symptoms_tr?: string[] | null
          mother_symptoms_uz?: string[] | null
          mother_symptoms_vi?: string[] | null
          mother_symptoms_zh?: string[] | null
          mother_tips?: string | null
          mother_tips_ar?: string | null
          mother_tips_de?: string | null
          mother_tips_en?: string | null
          mother_tips_es?: string | null
          mother_tips_fr?: string | null
          mother_tips_hi?: string | null
          mother_tips_id?: string | null
          mother_tips_ja?: string | null
          mother_tips_ka?: string | null
          mother_tips_kk?: string | null
          mother_tips_ko?: string | null
          mother_tips_nl?: string | null
          mother_tips_pl?: string | null
          mother_tips_pt?: string | null
          mother_tips_ru?: string | null
          mother_tips_sv?: string | null
          mother_tips_tr?: string | null
          mother_tips_uz?: string | null
          mother_tips_vi?: string | null
          mother_tips_zh?: string | null
          mother_warnings?: string | null
          mother_warnings_ar?: string | null
          mother_warnings_de?: string | null
          mother_warnings_en?: string | null
          mother_warnings_es?: string | null
          mother_warnings_fr?: string | null
          mother_warnings_hi?: string | null
          mother_warnings_id?: string | null
          mother_warnings_ja?: string | null
          mother_warnings_ka?: string | null
          mother_warnings_kk?: string | null
          mother_warnings_ko?: string | null
          mother_warnings_nl?: string | null
          mother_warnings_pl?: string | null
          mother_warnings_pt?: string | null
          mother_warnings_ru?: string | null
          mother_warnings_sv?: string | null
          mother_warnings_tr?: string | null
          mother_warnings_uz?: string | null
          mother_warnings_vi?: string | null
          mother_warnings_zh?: string | null
          multiples_tip_az?: string | null
          multiples_tip_es?: string | null
          multiples_tip_fr?: string | null
          multiples_tip_hi?: string | null
          multiples_tip_id?: string | null
          multiples_tip_ja?: string | null
          multiples_tip_ko?: string | null
          multiples_tip_nl?: string | null
          multiples_tip_pl?: string | null
          multiples_tip_pt?: string | null
          multiples_tip_sv?: string | null
          multiples_tip_vi?: string | null
          multiples_tip_zh?: string | null
          nutrition_tip?: string | null
          nutrition_tip_ar?: string | null
          nutrition_tip_de?: string | null
          nutrition_tip_en?: string | null
          nutrition_tip_es?: string | null
          nutrition_tip_fr?: string | null
          nutrition_tip_hi?: string | null
          nutrition_tip_id?: string | null
          nutrition_tip_ja?: string | null
          nutrition_tip_ka?: string | null
          nutrition_tip_kk?: string | null
          nutrition_tip_ko?: string | null
          nutrition_tip_nl?: string | null
          nutrition_tip_pl?: string | null
          nutrition_tip_pt?: string | null
          nutrition_tip_ru?: string | null
          nutrition_tip_sv?: string | null
          nutrition_tip_tr?: string | null
          nutrition_tip_uz?: string | null
          nutrition_tip_vi?: string | null
          nutrition_tip_zh?: string | null
          partner_tip?: string | null
          partner_tip_ar?: string | null
          partner_tip_de?: string | null
          partner_tip_en?: string | null
          partner_tip_es?: string | null
          partner_tip_fr?: string | null
          partner_tip_hi?: string | null
          partner_tip_id?: string | null
          partner_tip_ja?: string | null
          partner_tip_ka?: string | null
          partner_tip_kk?: string | null
          partner_tip_ko?: string | null
          partner_tip_nl?: string | null
          partner_tip_pl?: string | null
          partner_tip_pt?: string | null
          partner_tip_ru?: string | null
          partner_tip_sv?: string | null
          partner_tip_tr?: string | null
          partner_tip_uz?: string | null
          partner_tip_vi?: string | null
          partner_tip_zh?: string | null
          pregnancy_day?: number | null
          recommended_exercises?: string[] | null
          recommended_exercises_ar?: string[] | null
          recommended_exercises_de?: string[] | null
          recommended_exercises_en?: string[] | null
          recommended_exercises_es?: string[] | null
          recommended_exercises_fr?: string[] | null
          recommended_exercises_hi?: string[] | null
          recommended_exercises_id?: string[] | null
          recommended_exercises_ja?: string[] | null
          recommended_exercises_ka?: string[] | null
          recommended_exercises_kk?: string[] | null
          recommended_exercises_ko?: string[] | null
          recommended_exercises_nl?: string[] | null
          recommended_exercises_pl?: string[] | null
          recommended_exercises_pt?: string[] | null
          recommended_exercises_ru?: string[] | null
          recommended_exercises_sv?: string[] | null
          recommended_exercises_tr?: string[] | null
          recommended_exercises_uz?: string[] | null
          recommended_exercises_vi?: string[] | null
          recommended_exercises_zh?: string[] | null
          recommended_foods?: string[] | null
          recommended_foods_ar?: string[] | null
          recommended_foods_de?: string[] | null
          recommended_foods_en?: string[] | null
          recommended_foods_es?: string[] | null
          recommended_foods_fr?: string[] | null
          recommended_foods_hi?: string[] | null
          recommended_foods_id?: string[] | null
          recommended_foods_ja?: string[] | null
          recommended_foods_ka?: string[] | null
          recommended_foods_kk?: string[] | null
          recommended_foods_ko?: string[] | null
          recommended_foods_nl?: string[] | null
          recommended_foods_pl?: string[] | null
          recommended_foods_pt?: string[] | null
          recommended_foods_ru?: string[] | null
          recommended_foods_sv?: string[] | null
          recommended_foods_tr?: string[] | null
          recommended_foods_uz?: string[] | null
          recommended_foods_vi?: string[] | null
          recommended_foods_zh?: string[] | null
          tests_to_do?: string[] | null
          tests_to_do_ar?: string[] | null
          tests_to_do_de?: string[] | null
          tests_to_do_en?: string[] | null
          tests_to_do_es?: string[] | null
          tests_to_do_fr?: string[] | null
          tests_to_do_hi?: string[] | null
          tests_to_do_id?: string[] | null
          tests_to_do_ja?: string[] | null
          tests_to_do_ka?: string[] | null
          tests_to_do_kk?: string[] | null
          tests_to_do_ko?: string[] | null
          tests_to_do_nl?: string[] | null
          tests_to_do_pl?: string[] | null
          tests_to_do_pt?: string[] | null
          tests_to_do_ru?: string[] | null
          tests_to_do_sv?: string[] | null
          tests_to_do_tr?: string[] | null
          tests_to_do_uz?: string[] | null
          tests_to_do_vi?: string[] | null
          tests_to_do_zh?: string[] | null
          updated_at?: string
          video_url?: string | null
          week_number?: number
        }
        Relationships: []
      }
      pregnancy_day_notifications: {
        Row: {
          body: string
          body_ar: string | null
          body_de: string | null
          body_en: string | null
          body_es: string | null
          body_fr: string | null
          body_hi: string | null
          body_id: string | null
          body_ja: string | null
          body_ka: string | null
          body_kk: string | null
          body_ko: string | null
          body_nl: string | null
          body_pl: string | null
          body_pt: string | null
          body_ru: string | null
          body_sv: string | null
          body_tr: string | null
          body_uz: string | null
          body_vi: string | null
          body_zh: string | null
          created_at: string | null
          day_number: number
          emoji: string | null
          id: string
          is_active: boolean | null
          send_time: string
          title: string
          title_ar: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          body_ar?: string | null
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          body_hi?: string | null
          body_id?: string | null
          body_ja?: string | null
          body_ka?: string | null
          body_kk?: string | null
          body_ko?: string | null
          body_nl?: string | null
          body_pl?: string | null
          body_pt?: string | null
          body_ru?: string | null
          body_sv?: string | null
          body_tr?: string | null
          body_uz?: string | null
          body_vi?: string | null
          body_zh?: string | null
          created_at?: string | null
          day_number: number
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          send_time?: string
          title: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          body_ar?: string | null
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          body_hi?: string | null
          body_id?: string | null
          body_ja?: string | null
          body_ka?: string | null
          body_kk?: string | null
          body_ko?: string | null
          body_nl?: string | null
          body_pl?: string | null
          body_pt?: string | null
          body_ru?: string | null
          body_sv?: string | null
          body_tr?: string | null
          body_uz?: string | null
          body_vi?: string | null
          body_zh?: string | null
          created_at?: string | null
          day_number?: number
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          send_time?: string
          title?: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pregnancy_fetus_illustrations: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          image_url: string
          is_active: boolean
          month_number: number
          title: string | null
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          month_number: number
          title?: string | null
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          month_number?: number
          title?: string | null
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      premium_features: {
        Row: {
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_included_free: boolean | null
          is_included_premium: boolean | null
          is_included_premium_plus: boolean | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_included_free?: boolean | null
          is_included_premium?: boolean | null
          is_included_premium_plus?: boolean | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_included_free?: boolean | null
          is_included_premium?: boolean | null
          is_included_premium_plus?: boolean | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      premium_plans: {
        Row: {
          badge_text: string | null
          badge_text_ar: string | null
          badge_text_az: string | null
          badge_text_de: string | null
          badge_text_en: string | null
          badge_text_es: string | null
          badge_text_fr: string | null
          badge_text_hi: string | null
          badge_text_id: string | null
          badge_text_ja: string | null
          badge_text_ka: string | null
          badge_text_kk: string | null
          badge_text_ko: string | null
          badge_text_nl: string | null
          badge_text_pl: string | null
          badge_text_pt: string | null
          badge_text_ru: string | null
          badge_text_sv: string | null
          badge_text_tr: string | null
          badge_text_uz: string | null
          badge_text_vi: string | null
          badge_text_zh: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          plan_key: string
          price_monthly: number | null
          price_yearly: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          badge_text?: string | null
          badge_text_ar?: string | null
          badge_text_az?: string | null
          badge_text_de?: string | null
          badge_text_en?: string | null
          badge_text_es?: string | null
          badge_text_fr?: string | null
          badge_text_hi?: string | null
          badge_text_id?: string | null
          badge_text_ja?: string | null
          badge_text_ka?: string | null
          badge_text_kk?: string | null
          badge_text_ko?: string | null
          badge_text_nl?: string | null
          badge_text_pl?: string | null
          badge_text_pt?: string | null
          badge_text_ru?: string | null
          badge_text_sv?: string | null
          badge_text_tr?: string | null
          badge_text_uz?: string | null
          badge_text_vi?: string | null
          badge_text_zh?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          plan_key: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          badge_text?: string | null
          badge_text_ar?: string | null
          badge_text_az?: string | null
          badge_text_de?: string | null
          badge_text_en?: string | null
          badge_text_es?: string | null
          badge_text_fr?: string | null
          badge_text_hi?: string | null
          badge_text_id?: string | null
          badge_text_ja?: string | null
          badge_text_ka?: string | null
          badge_text_kk?: string | null
          badge_text_ko?: string | null
          badge_text_nl?: string | null
          badge_text_pl?: string | null
          badge_text_pt?: string | null
          badge_text_ru?: string | null
          badge_text_sv?: string | null
          badge_text_tr?: string | null
          badge_text_uz?: string | null
          badge_text_vi?: string | null
          badge_text_zh?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          plan_key?: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_conditions: {
        Row: {
          color: string | null
          condition_key: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          condition_key: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          condition_key?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          category_ar: string | null
          category_de: string | null
          category_en: string | null
          category_es: string | null
          category_fr: string | null
          category_hi: string | null
          category_id: string | null
          category_ja: string | null
          category_ka: string | null
          category_kk: string | null
          category_ko: string | null
          category_nl: string | null
          category_pl: string | null
          category_pt: string | null
          category_ru: string | null
          category_sv: string | null
          category_tr: string | null
          category_uz: string | null
          category_vi: string | null
          category_zh: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          original_price: number | null
          price: number
          rating: number | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          category: string
          category_ar?: string | null
          category_de?: string | null
          category_en?: string | null
          category_es?: string | null
          category_fr?: string | null
          category_hi?: string | null
          category_id?: string | null
          category_ja?: string | null
          category_ka?: string | null
          category_kk?: string | null
          category_ko?: string | null
          category_nl?: string | null
          category_pl?: string | null
          category_pt?: string | null
          category_ru?: string | null
          category_sv?: string | null
          category_tr?: string | null
          category_uz?: string | null
          category_vi?: string | null
          category_zh?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          original_price?: number | null
          price?: number
          rating?: number | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          category_ar?: string | null
          category_de?: string | null
          category_en?: string | null
          category_es?: string | null
          category_fr?: string | null
          category_hi?: string | null
          category_id?: string | null
          category_ja?: string | null
          category_ka?: string | null
          category_kk?: string | null
          category_ko?: string | null
          category_nl?: string | null
          category_pl?: string | null
          category_pt?: string | null
          category_ru?: string | null
          category_sv?: string | null
          category_tr?: string | null
          category_uz?: string | null
          category_vi?: string | null
          category_zh?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          original_price?: number | null
          price?: number
          rating?: number | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apple_email_enabled: boolean | null
          apple_user_id: string | null
          avatar_url: string | null
          baby_birth_date: string | null
          baby_count: number | null
          baby_gender: string | null
          baby_name: string | null
          badge_type: string | null
          bio: string | null
          birth_height_cm: number | null
          birth_weight_kg: number | null
          chorionicity: string | null
          country_code: string | null
          created_at: string
          cycle_length: number | null
          delivery_type: string | null
          due_date: string | null
          email: string | null
          id: string
          is_premium: boolean | null
          is_verified: boolean
          last_period_date: string | null
          life_stage: string | null
          linked_partner_id: string | null
          multiples_type: string | null
          name: string
          onboarding_answers: Json | null
          partner_code: string | null
          period_length: number | null
          pregnancy_day: number | null
          premium_until: string | null
          role: Database["public"]["Enums"]["app_role"]
          start_weight: number | null
          updated_at: string
          user_id: string
          verified_until: string | null
        }
        Insert: {
          apple_email_enabled?: boolean | null
          apple_user_id?: string | null
          avatar_url?: string | null
          baby_birth_date?: string | null
          baby_count?: number | null
          baby_gender?: string | null
          baby_name?: string | null
          badge_type?: string | null
          bio?: string | null
          birth_height_cm?: number | null
          birth_weight_kg?: number | null
          chorionicity?: string | null
          country_code?: string | null
          created_at?: string
          cycle_length?: number | null
          delivery_type?: string | null
          due_date?: string | null
          email?: string | null
          id?: string
          is_premium?: boolean | null
          is_verified?: boolean
          last_period_date?: string | null
          life_stage?: string | null
          linked_partner_id?: string | null
          multiples_type?: string | null
          name: string
          onboarding_answers?: Json | null
          partner_code?: string | null
          period_length?: number | null
          pregnancy_day?: number | null
          premium_until?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          start_weight?: number | null
          updated_at?: string
          user_id: string
          verified_until?: string | null
        }
        Update: {
          apple_email_enabled?: boolean | null
          apple_user_id?: string | null
          avatar_url?: string | null
          baby_birth_date?: string | null
          baby_count?: number | null
          baby_gender?: string | null
          baby_name?: string | null
          badge_type?: string | null
          bio?: string | null
          birth_height_cm?: number | null
          birth_weight_kg?: number | null
          chorionicity?: string | null
          country_code?: string | null
          created_at?: string
          cycle_length?: number | null
          delivery_type?: string | null
          due_date?: string | null
          email?: string | null
          id?: string
          is_premium?: boolean | null
          is_verified?: boolean
          last_period_date?: string | null
          life_stage?: string | null
          linked_partner_id?: string | null
          multiples_type?: string | null
          name?: string
          onboarding_answers?: Json | null
          partner_code?: string | null
          period_length?: number | null
          pregnancy_day?: number | null
          premium_until?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          start_weight?: number | null
          updated_at?: string
          user_id?: string
          verified_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_partner_id_fkey"
            columns: ["linked_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_types: {
        Row: {
          color: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
          type_key: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          type_key: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
          type_key?: string
        }
        Relationships: []
      }
      public_profile_cards: {
        Row: {
          avatar_url: string | null
          badge_type: string | null
          created_at: string
          is_premium: boolean
          is_verified: boolean
          life_stage: string | null
          name: string | null
          updated_at: string
          user_id: string
          verified_until: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_type?: string | null
          created_at?: string
          is_premium?: boolean
          is_verified?: boolean
          life_stage?: string | null
          name?: string | null
          updated_at?: string
          user_id: string
          verified_until?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_type?: string | null
          created_at?: string
          is_premium?: boolean
          is_verified?: boolean
          life_stage?: string | null
          name?: string | null
          updated_at?: string
          user_id?: string
          verified_until?: string | null
        }
        Relationships: []
      }
      quick_actions: {
        Row: {
          age_group: string
          color_from: string
          color_to: string
          created_at: string | null
          icon: string
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          life_stage: string
          sort_order: number | null
          tool_key: string
        }
        Insert: {
          age_group?: string
          color_from?: string
          color_to?: string
          created_at?: string | null
          icon: string
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          life_stage?: string
          sort_order?: number | null
          tool_key: string
        }
        Update: {
          age_group?: string
          color_from?: string
          color_to?: string
          created_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          life_stage?: string
          sort_order?: number | null
          tool_key?: string
        }
        Relationships: []
      }
      recipe_categories: {
        Row: {
          category_id: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          life_stage: string | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          life_stage?: string | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      recipe_tags: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_az: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
          tag_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          tag_id: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_az?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          tag_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          converted_at: string | null
          created_at: string
          id: string
          referred_user_id: string
          referrer_rewarded_at: string | null
          referrer_user_id: string
          reward_days: number
          status: string
          trial_started_at: string | null
        }
        Insert: {
          code: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_rewarded_at?: string | null
          referrer_user_id: string
          reward_days?: number
          status?: string
          trial_started_at?: string | null
        }
        Update: {
          code?: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_rewarded_at?: string | null
          referrer_user_id?: string
          reward_days?: number
          status?: string
          trial_started_at?: string | null
        }
        Relationships: []
      }
      safety_categories: {
        Row: {
          category_id: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      safety_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          is_active: boolean | null
          item_name_az: string | null
          item_name_en: string | null
          item_name_ru: string | null
          item_name_tr: string | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          notes: string | null
          notes_en: string | null
          safety_level: string
          trimester_notes: Json | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          item_name_az?: string | null
          item_name_en?: string | null
          item_name_ru?: string | null
          item_name_tr?: string | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          notes?: string | null
          notes_en?: string | null
          safety_level?: string
          trimester_notes?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          item_name_az?: string | null
          item_name_en?: string | null
          item_name_ru?: string | null
          item_name_tr?: string | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          notes?: string | null
          notes_en?: string | null
          safety_level?: string
          trimester_notes?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_affiliate_products: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_affiliate_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "affiliate_products"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          body: string
          body_ar: string | null
          body_de: string | null
          body_en: string | null
          body_es: string | null
          body_fr: string | null
          body_hi: string | null
          body_id: string | null
          body_ja: string | null
          body_ka: string | null
          body_kk: string | null
          body_ko: string | null
          body_nl: string | null
          body_pl: string | null
          body_pt: string | null
          body_ru: string | null
          body_sv: string | null
          body_tr: string | null
          body_uz: string | null
          body_vi: string | null
          body_zh: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          notification_type: string | null
          priority: number | null
          target_audience: string
          title: string
          title_ar: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          body_ar?: string | null
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          body_hi?: string | null
          body_id?: string | null
          body_ja?: string | null
          body_ka?: string | null
          body_kk?: string | null
          body_ko?: string | null
          body_nl?: string | null
          body_pl?: string | null
          body_pt?: string | null
          body_ru?: string | null
          body_sv?: string | null
          body_tr?: string | null
          body_uz?: string | null
          body_vi?: string | null
          body_zh?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notification_type?: string | null
          priority?: number | null
          target_audience?: string
          title: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          body_ar?: string | null
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          body_hi?: string | null
          body_id?: string | null
          body_ja?: string | null
          body_ka?: string | null
          body_kk?: string | null
          body_ko?: string | null
          body_nl?: string | null
          body_pl?: string | null
          body_pt?: string | null
          body_ru?: string | null
          body_sv?: string | null
          body_tr?: string | null
          body_uz?: string | null
          body_vi?: string | null
          body_zh?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notification_type?: string | null
          priority?: number | null
          target_audience?: string
          title?: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shop_categories: {
        Row: {
          category_key: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category_key: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category_key?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      shopping_items: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          is_checked: boolean | null
          name: string
          partner_id: string | null
          priority: string | null
          quantity: number | null
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean | null
          name: string
          partner_id?: string | null
          priority?: string | null
          quantity?: number | null
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean | null
          name?: string
          partner_id?: string | null
          priority?: string | null
          quantity?: number | null
          user_id?: string
        }
        Relationships: []
      }
      skill_categories: {
        Row: {
          color: string | null
          created_at: string | null
          emoji: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          skill_key: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          skill_key: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          skill_key?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      sos_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          id: string
          is_acknowledged: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          message: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          message?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          message?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      source_community_worker_control: {
        Row: {
          enabled: boolean
          singleton: boolean
          token_sha256: string | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          singleton?: boolean
          token_sha256?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          singleton?: boolean
          token_sha256?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "community_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_replies_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "community_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          story_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "community_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_cancellations: {
        Row: {
          cancel_flow: string
          created_at: string
          id: string
          plan_type: string | null
          reason_code: string
          reason_text: string | null
          user_id: string
          was_trial: boolean
        }
        Insert: {
          cancel_flow?: string
          created_at?: string
          id?: string
          plan_type?: string | null
          reason_code: string
          reason_text?: string | null
          user_id: string
          was_trial?: boolean
        }
        Update: {
          cancel_flow?: string
          created_at?: string
          id?: string
          plan_type?: string | null
          reason_code?: string
          reason_text?: string | null
          user_id?: string
          was_trial?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_trial: boolean
          plan_type: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          plan_type?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          plan_type?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_categories: {
        Row: {
          category_key: string
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category_key: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category_key?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          category: string | null
          created_at: string
          id: string
          message: string
          priority: string | null
          responded_at: string | null
          status: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string | null
          responded_at?: string | null
          status?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string | null
          responded_at?: string | null
          status?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      surprise_categories: {
        Row: {
          category_key: string
          color_gradient: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          sort_order: number | null
        }
        Insert: {
          category_key: string
          color_gradient?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Update: {
          category_key?: string
          color_gradient?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      surprise_ideas: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          difficulty: string | null
          difficulty_en: string | null
          emoji: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          points: number | null
          sort_order: number | null
          surprise_key: string | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          difficulty?: string | null
          difficulty_en?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          points?: number | null
          sort_order?: number | null
          surprise_key?: string | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          difficulty?: string | null
          difficulty_en?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          points?: number | null
          sort_order?: number | null
          surprise_key?: string | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
        }
        Relationships: []
      }
      symptoms: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          label: string
          label_ar: string | null
          label_az: string | null
          label_de: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ka: string | null
          label_kk: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_uz: string | null
          label_vi: string | null
          label_zh: string | null
          life_stages: string[] | null
          sort_order: number | null
          symptom_key: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          life_stages?: string[] | null
          sort_order?: number | null
          symptom_key: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_ar?: string | null
          label_az?: string | null
          label_de?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ka?: string | null
          label_kk?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_uz?: string | null
          label_vi?: string | null
          label_zh?: string | null
          life_stages?: string[] | null
          sort_order?: number | null
          symptom_key?: string
        }
        Relationships: []
      }
      teething_care_tips: {
        Row: {
          category: string | null
          content: string
          content_ar: string | null
          content_az: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          content_ar?: string | null
          content_az?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_az?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      teething_symptoms: {
        Row: {
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          relief_tips: string[] | null
          relief_tips_ar: string | null
          relief_tips_az: string[] | null
          relief_tips_de: string | null
          relief_tips_en: string | null
          relief_tips_es: string | null
          relief_tips_fr: string | null
          relief_tips_hi: string | null
          relief_tips_id: string | null
          relief_tips_ja: string | null
          relief_tips_ka: string | null
          relief_tips_kk: string | null
          relief_tips_ko: string | null
          relief_tips_nl: string | null
          relief_tips_pl: string | null
          relief_tips_pt: string | null
          relief_tips_ru: string | null
          relief_tips_sv: string | null
          relief_tips_tr: string | null
          relief_tips_uz: string | null
          relief_tips_vi: string | null
          relief_tips_zh: string | null
          severity: string | null
          severity_en: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          relief_tips?: string[] | null
          relief_tips_ar?: string | null
          relief_tips_az?: string[] | null
          relief_tips_de?: string | null
          relief_tips_en?: string | null
          relief_tips_es?: string | null
          relief_tips_fr?: string | null
          relief_tips_hi?: string | null
          relief_tips_id?: string | null
          relief_tips_ja?: string | null
          relief_tips_ka?: string | null
          relief_tips_kk?: string | null
          relief_tips_ko?: string | null
          relief_tips_nl?: string | null
          relief_tips_pl?: string | null
          relief_tips_pt?: string | null
          relief_tips_ru?: string | null
          relief_tips_sv?: string | null
          relief_tips_tr?: string | null
          relief_tips_uz?: string | null
          relief_tips_vi?: string | null
          relief_tips_zh?: string | null
          severity?: string | null
          severity_en?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          relief_tips?: string[] | null
          relief_tips_ar?: string | null
          relief_tips_az?: string[] | null
          relief_tips_de?: string | null
          relief_tips_en?: string | null
          relief_tips_es?: string | null
          relief_tips_fr?: string | null
          relief_tips_hi?: string | null
          relief_tips_id?: string | null
          relief_tips_ja?: string | null
          relief_tips_ka?: string | null
          relief_tips_kk?: string | null
          relief_tips_ko?: string | null
          relief_tips_nl?: string | null
          relief_tips_pl?: string | null
          relief_tips_pt?: string | null
          relief_tips_ru?: string | null
          relief_tips_sv?: string | null
          relief_tips_tr?: string | null
          relief_tips_uz?: string | null
          relief_tips_vi?: string | null
          relief_tips_zh?: string | null
          severity?: string | null
          severity_en?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      temperature_emojis: {
        Row: {
          clothing_tip_az: string | null
          clothing_tip_en: string | null
          clothing_tip_es: string | null
          clothing_tip_fr: string | null
          clothing_tip_hi: string | null
          clothing_tip_id: string | null
          clothing_tip_ja: string | null
          clothing_tip_ko: string | null
          clothing_tip_nl: string | null
          clothing_tip_pl: string | null
          clothing_tip_pt: string | null
          clothing_tip_ru: string | null
          clothing_tip_sv: string | null
          clothing_tip_tr: string | null
          clothing_tip_vi: string | null
          clothing_tip_zh: string | null
          created_at: string | null
          emoji: string
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          max_temp: number
          min_temp: number
          sort_order: number | null
        }
        Insert: {
          clothing_tip_az?: string | null
          clothing_tip_en?: string | null
          clothing_tip_es?: string | null
          clothing_tip_fr?: string | null
          clothing_tip_hi?: string | null
          clothing_tip_id?: string | null
          clothing_tip_ja?: string | null
          clothing_tip_ko?: string | null
          clothing_tip_nl?: string | null
          clothing_tip_pl?: string | null
          clothing_tip_pt?: string | null
          clothing_tip_ru?: string | null
          clothing_tip_sv?: string | null
          clothing_tip_tr?: string | null
          clothing_tip_vi?: string | null
          clothing_tip_zh?: string | null
          created_at?: string | null
          emoji: string
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          max_temp: number
          min_temp: number
          sort_order?: number | null
        }
        Update: {
          clothing_tip_az?: string | null
          clothing_tip_en?: string | null
          clothing_tip_es?: string | null
          clothing_tip_fr?: string | null
          clothing_tip_hi?: string | null
          clothing_tip_id?: string | null
          clothing_tip_ja?: string | null
          clothing_tip_ko?: string | null
          clothing_tip_nl?: string | null
          clothing_tip_pl?: string | null
          clothing_tip_pt?: string | null
          clothing_tip_ru?: string | null
          clothing_tip_sv?: string | null
          clothing_tip_tr?: string | null
          clothing_tip_vi?: string | null
          clothing_tip_zh?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          max_temp?: number
          min_temp?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      time_options: {
        Row: {
          created_at: string | null
          hour_value: number | null
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          option_key: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          hour_value?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          option_key: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          hour_value?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          option_key?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      tool_configs: {
        Row: {
          bg_color: string | null
          bump_active: boolean | null
          bump_locked: boolean | null
          bump_order: number | null
          color: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          display_name: string | null
          display_name_az: string | null
          display_name_en: string | null
          display_name_ru: string | null
          display_name_tr: string | null
          flow_active: boolean | null
          flow_locked: boolean | null
          flow_order: number | null
          hero_badge: string | null
          hero_badge_en: string | null
          hero_gradient: string | null
          hero_order: number | null
          hero_subtitle: string | null
          hero_subtitle_en: string | null
          icon: string
          id: string
          is_active: boolean | null
          is_hero: boolean | null
          is_premium: boolean | null
          is_quick_access: boolean | null
          life_stages: string[] | null
          min_week: number | null
          mommy_active: boolean | null
          mommy_locked: boolean | null
          mommy_order: number | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          partner_description: string | null
          partner_description_ar: string | null
          partner_description_az: string | null
          partner_description_de: string | null
          partner_description_en: string | null
          partner_description_es: string | null
          partner_description_fr: string | null
          partner_description_hi: string | null
          partner_description_id: string | null
          partner_description_ja: string | null
          partner_description_ka: string | null
          partner_description_kk: string | null
          partner_description_ko: string | null
          partner_description_nl: string | null
          partner_description_pl: string | null
          partner_description_pt: string | null
          partner_description_ru: string | null
          partner_description_sv: string | null
          partner_description_tr: string | null
          partner_description_uz: string | null
          partner_description_vi: string | null
          partner_description_zh: string | null
          partner_name: string | null
          partner_name_ar: string | null
          partner_name_az: string | null
          partner_name_de: string | null
          partner_name_en: string | null
          partner_name_es: string | null
          partner_name_fr: string | null
          partner_name_hi: string | null
          partner_name_id: string | null
          partner_name_ja: string | null
          partner_name_ka: string | null
          partner_name_kk: string | null
          partner_name_ko: string | null
          partner_name_nl: string | null
          partner_name_pl: string | null
          partner_name_pt: string | null
          partner_name_ru: string | null
          partner_name_sv: string | null
          partner_name_tr: string | null
          partner_name_uz: string | null
          partner_name_vi: string | null
          partner_name_zh: string | null
          premium_limit: number | null
          premium_type: string | null
          quick_access_gradient: string | null
          quick_access_order: number | null
          requires_partner: boolean | null
          sort_order: number | null
          tool_id: string
          updated_at: string | null
        }
        Insert: {
          bg_color?: string | null
          bump_active?: boolean | null
          bump_locked?: boolean | null
          bump_order?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          display_name?: string | null
          display_name_az?: string | null
          display_name_en?: string | null
          display_name_ru?: string | null
          display_name_tr?: string | null
          flow_active?: boolean | null
          flow_locked?: boolean | null
          flow_order?: number | null
          hero_badge?: string | null
          hero_badge_en?: string | null
          hero_gradient?: string | null
          hero_order?: number | null
          hero_subtitle?: string | null
          hero_subtitle_en?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          is_hero?: boolean | null
          is_premium?: boolean | null
          is_quick_access?: boolean | null
          life_stages?: string[] | null
          min_week?: number | null
          mommy_active?: boolean | null
          mommy_locked?: boolean | null
          mommy_order?: number | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          partner_description?: string | null
          partner_description_ar?: string | null
          partner_description_az?: string | null
          partner_description_de?: string | null
          partner_description_en?: string | null
          partner_description_es?: string | null
          partner_description_fr?: string | null
          partner_description_hi?: string | null
          partner_description_id?: string | null
          partner_description_ja?: string | null
          partner_description_ka?: string | null
          partner_description_kk?: string | null
          partner_description_ko?: string | null
          partner_description_nl?: string | null
          partner_description_pl?: string | null
          partner_description_pt?: string | null
          partner_description_ru?: string | null
          partner_description_sv?: string | null
          partner_description_tr?: string | null
          partner_description_uz?: string | null
          partner_description_vi?: string | null
          partner_description_zh?: string | null
          partner_name?: string | null
          partner_name_ar?: string | null
          partner_name_az?: string | null
          partner_name_de?: string | null
          partner_name_en?: string | null
          partner_name_es?: string | null
          partner_name_fr?: string | null
          partner_name_hi?: string | null
          partner_name_id?: string | null
          partner_name_ja?: string | null
          partner_name_ka?: string | null
          partner_name_kk?: string | null
          partner_name_ko?: string | null
          partner_name_nl?: string | null
          partner_name_pl?: string | null
          partner_name_pt?: string | null
          partner_name_ru?: string | null
          partner_name_sv?: string | null
          partner_name_tr?: string | null
          partner_name_uz?: string | null
          partner_name_vi?: string | null
          partner_name_zh?: string | null
          premium_limit?: number | null
          premium_type?: string | null
          quick_access_gradient?: string | null
          quick_access_order?: number | null
          requires_partner?: boolean | null
          sort_order?: number | null
          tool_id: string
          updated_at?: string | null
        }
        Update: {
          bg_color?: string | null
          bump_active?: boolean | null
          bump_locked?: boolean | null
          bump_order?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          display_name?: string | null
          display_name_az?: string | null
          display_name_en?: string | null
          display_name_ru?: string | null
          display_name_tr?: string | null
          flow_active?: boolean | null
          flow_locked?: boolean | null
          flow_order?: number | null
          hero_badge?: string | null
          hero_badge_en?: string | null
          hero_gradient?: string | null
          hero_order?: number | null
          hero_subtitle?: string | null
          hero_subtitle_en?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          is_hero?: boolean | null
          is_premium?: boolean | null
          is_quick_access?: boolean | null
          life_stages?: string[] | null
          min_week?: number | null
          mommy_active?: boolean | null
          mommy_locked?: boolean | null
          mommy_order?: number | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          partner_description?: string | null
          partner_description_ar?: string | null
          partner_description_az?: string | null
          partner_description_de?: string | null
          partner_description_en?: string | null
          partner_description_es?: string | null
          partner_description_fr?: string | null
          partner_description_hi?: string | null
          partner_description_id?: string | null
          partner_description_ja?: string | null
          partner_description_ka?: string | null
          partner_description_kk?: string | null
          partner_description_ko?: string | null
          partner_description_nl?: string | null
          partner_description_pl?: string | null
          partner_description_pt?: string | null
          partner_description_ru?: string | null
          partner_description_sv?: string | null
          partner_description_tr?: string | null
          partner_description_uz?: string | null
          partner_description_vi?: string | null
          partner_description_zh?: string | null
          partner_name?: string | null
          partner_name_ar?: string | null
          partner_name_az?: string | null
          partner_name_de?: string | null
          partner_name_en?: string | null
          partner_name_es?: string | null
          partner_name_fr?: string | null
          partner_name_hi?: string | null
          partner_name_id?: string | null
          partner_name_ja?: string | null
          partner_name_ka?: string | null
          partner_name_kk?: string | null
          partner_name_ko?: string | null
          partner_name_nl?: string | null
          partner_name_pl?: string | null
          partner_name_pt?: string | null
          partner_name_ru?: string | null
          partner_name_sv?: string | null
          partner_name_tr?: string | null
          partner_name_uz?: string | null
          partner_name_vi?: string | null
          partner_name_zh?: string | null
          premium_limit?: number | null
          premium_type?: string | null
          quick_access_gradient?: string | null
          quick_access_order?: number | null
          requires_partner?: boolean | null
          sort_order?: number | null
          tool_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string
          id: string
          key: string
          lang: string
          namespace: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          lang: string
          namespace?: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          lang?: string
          namespace?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_lang_fkey"
            columns: ["lang"]
            isOneToOne: false
            referencedRelation: "app_languages"
            referencedColumns: ["code"]
          },
        ]
      }
      trimester_info: {
        Row: {
          color_class: string | null
          created_at: string | null
          emoji: string
          id: string
          is_active: boolean | null
          label: string
          label_az: string | null
          label_en: string | null
          label_es: string | null
          label_fr: string | null
          label_hi: string | null
          label_id: string | null
          label_ja: string | null
          label_ko: string | null
          label_nl: string | null
          label_pl: string | null
          label_pt: string | null
          label_ru: string | null
          label_sv: string | null
          label_tr: string | null
          label_vi: string | null
          label_zh: string | null
          trimester_number: number
        }
        Insert: {
          color_class?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          label: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          trimester_number: number
        }
        Update: {
          color_class?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          is_active?: boolean | null
          label?: string
          label_az?: string | null
          label_en?: string | null
          label_es?: string | null
          label_fr?: string | null
          label_hi?: string | null
          label_id?: string | null
          label_ja?: string | null
          label_ko?: string | null
          label_nl?: string | null
          label_pl?: string | null
          label_pt?: string | null
          label_ru?: string | null
          label_sv?: string | null
          label_tr?: string | null
          label_vi?: string | null
          label_zh?: string | null
          trimester_number?: number
        }
        Relationships: []
      }
      trimester_tips: {
        Row: {
          created_at: string | null
          icon: string
          id: string
          is_active: boolean | null
          sort_order: number | null
          tip_text: string
          tip_text_ar: string | null
          tip_text_de: string | null
          tip_text_en: string | null
          tip_text_es: string | null
          tip_text_fr: string | null
          tip_text_hi: string | null
          tip_text_id: string | null
          tip_text_ja: string | null
          tip_text_ka: string | null
          tip_text_kk: string | null
          tip_text_ko: string | null
          tip_text_nl: string | null
          tip_text_pl: string | null
          tip_text_pt: string | null
          tip_text_ru: string | null
          tip_text_sv: string | null
          tip_text_tr: string | null
          tip_text_uz: string | null
          tip_text_vi: string | null
          tip_text_zh: string | null
          trimester: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          tip_text: string
          tip_text_ar?: string | null
          tip_text_de?: string | null
          tip_text_en?: string | null
          tip_text_es?: string | null
          tip_text_fr?: string | null
          tip_text_hi?: string | null
          tip_text_id?: string | null
          tip_text_ja?: string | null
          tip_text_ka?: string | null
          tip_text_kk?: string | null
          tip_text_ko?: string | null
          tip_text_nl?: string | null
          tip_text_pl?: string | null
          tip_text_pt?: string | null
          tip_text_ru?: string | null
          tip_text_sv?: string | null
          tip_text_tr?: string | null
          tip_text_uz?: string | null
          tip_text_vi?: string | null
          tip_text_zh?: string | null
          trimester: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          tip_text?: string
          tip_text_ar?: string | null
          tip_text_de?: string | null
          tip_text_en?: string | null
          tip_text_es?: string | null
          tip_text_fr?: string | null
          tip_text_hi?: string | null
          tip_text_id?: string | null
          tip_text_ja?: string | null
          tip_text_ka?: string | null
          tip_text_kk?: string | null
          tip_text_ko?: string | null
          tip_text_nl?: string | null
          tip_text_pl?: string | null
          tip_text_pt?: string | null
          tip_text_ru?: string | null
          tip_text_sv?: string | null
          tip_text_tr?: string | null
          tip_text_uz?: string | null
          tip_text_vi?: string | null
          tip_text_zh?: string | null
          trimester?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          created_at: string
          feature_type: string
          id: string
          updated_at: string
          usage_count: number
          usage_date: string
          usage_seconds: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_type: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_date?: string
          usage_seconds?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature_type?: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_date?: string
          usage_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achieved_at: string
          achievement_id: string
          achievement_type: string
          created_at: string
          id: string
          notified: boolean | null
          user_id: string
        }
        Insert: {
          achieved_at?: string
          achievement_id: string
          achievement_type: string
          created_at?: string
          id?: string
          notified?: boolean | null
          user_id: string
        }
        Update: {
          achieved_at?: string
          achievement_id?: string
          achievement_type?: string
          created_at?: string
          id?: string
          notified?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_type: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_type: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_type?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          block_type: string
          blocked_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          reason: string | null
          user_id: string
        }
        Insert: {
          block_type?: string
          blocked_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          user_id: string
        }
        Update: {
          block_type?: string
          blocked_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_children: {
        Row: {
          avatar_emoji: string | null
          birth_date: string
          country_code: string
          created_at: string | null
          due_date: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          sort_order: number | null
          updated_at: string | null
          user_id: string
          vaccine_country_code: string | null
        }
        Insert: {
          avatar_emoji?: string | null
          birth_date: string
          country_code?: string
          created_at?: string | null
          due_date?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
          vaccine_country_code?: string | null
        }
        Update: {
          avatar_emoji?: string | null
          birth_date?: string
          country_code?: string
          created_at?: string | null
          due_date?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
          vaccine_country_code?: string | null
        }
        Relationships: []
      }
      user_play_inventory: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          item_name_az: string | null
          item_name_en: string | null
          item_name_ru: string | null
          item_name_tr: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          item_name_az?: string | null
          item_name_en?: string | null
          item_name_ru?: string | null
          item_name_tr?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          item_name_az?: string | null
          item_name_en?: string | null
          item_name_ru?: string | null
          item_name_tr?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          community_last_seen_at: string | null
          created_at: string
          daily_push_enabled: boolean | null
          exercise_days: number[] | null
          exercise_reminder: boolean | null
          feed_languages: string[] | null
          id: string
          language: string
          last_delay_notification_at: string | null
          last_push_sent_at: string | null
          last_white_noise_sound: string | null
          notifications_enabled: boolean | null
          privacy_allow_messages: boolean
          privacy_location_sharing: boolean
          privacy_notification_sounds: boolean
          privacy_profile_visible: boolean
          privacy_share_analytics: boolean
          privacy_show_in_community: boolean
          push_comments: boolean | null
          push_community: boolean | null
          push_enabled: boolean | null
          push_likes: boolean | null
          push_messages: boolean | null
          silent_hours_enabled: boolean | null
          silent_hours_end: string | null
          silent_hours_start: string | null
          sound_enabled: boolean | null
          updated_at: string
          user_id: string
          vibration_enabled: boolean | null
          vitamin_reminder: boolean | null
          vitamin_time: string | null
          water_reminder: boolean | null
          white_noise_timer: number | null
          white_noise_volume: number | null
        }
        Insert: {
          community_last_seen_at?: string | null
          created_at?: string
          daily_push_enabled?: boolean | null
          exercise_days?: number[] | null
          exercise_reminder?: boolean | null
          feed_languages?: string[] | null
          id?: string
          language?: string
          last_delay_notification_at?: string | null
          last_push_sent_at?: string | null
          last_white_noise_sound?: string | null
          notifications_enabled?: boolean | null
          privacy_allow_messages?: boolean
          privacy_location_sharing?: boolean
          privacy_notification_sounds?: boolean
          privacy_profile_visible?: boolean
          privacy_share_analytics?: boolean
          privacy_show_in_community?: boolean
          push_comments?: boolean | null
          push_community?: boolean | null
          push_enabled?: boolean | null
          push_likes?: boolean | null
          push_messages?: boolean | null
          silent_hours_enabled?: boolean | null
          silent_hours_end?: string | null
          silent_hours_start?: string | null
          sound_enabled?: boolean | null
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean | null
          vitamin_reminder?: boolean | null
          vitamin_time?: string | null
          water_reminder?: boolean | null
          white_noise_timer?: number | null
          white_noise_volume?: number | null
        }
        Update: {
          community_last_seen_at?: string | null
          created_at?: string
          daily_push_enabled?: boolean | null
          exercise_days?: number[] | null
          exercise_reminder?: boolean | null
          feed_languages?: string[] | null
          id?: string
          language?: string
          last_delay_notification_at?: string | null
          last_push_sent_at?: string | null
          last_white_noise_sound?: string | null
          notifications_enabled?: boolean | null
          privacy_allow_messages?: boolean
          privacy_location_sharing?: boolean
          privacy_notification_sounds?: boolean
          privacy_profile_visible?: boolean
          privacy_share_analytics?: boolean
          privacy_show_in_community?: boolean
          push_comments?: boolean | null
          push_community?: boolean | null
          push_enabled?: boolean | null
          push_likes?: boolean | null
          push_messages?: boolean | null
          silent_hours_enabled?: boolean | null
          silent_hours_end?: string | null
          silent_hours_start?: string | null
          sound_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean | null
          vitamin_reminder?: boolean | null
          vitamin_time?: string | null
          water_reminder?: boolean | null
          white_noise_timer?: number | null
          white_noise_volume?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          show_admin_badge: boolean | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          show_admin_badge?: boolean | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          show_admin_badge?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_teething_logs: {
        Row: {
          child_id: string | null
          created_at: string | null
          emerged_date: string | null
          id: string
          notes: string | null
          tooth_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          emerged_date?: string | null
          id?: string
          notes?: string | null
          tooth_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          emerged_date?: string | null
          id?: string
          notes?: string | null
          tooth_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_teething_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "user_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teething_logs_tooth_id_fkey"
            columns: ["tooth_id"]
            isOneToOne: false
            referencedRelation: "baby_teeth_db"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vitamin_schedules: {
        Row: {
          created_at: string
          days_of_week: number[]
          icon_emoji: string
          id: string
          is_active: boolean
          notification_enabled: boolean
          scheduled_time: string
          updated_at: string
          user_id: string
          vitamin_name: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          icon_emoji?: string
          id?: string
          is_active?: boolean
          notification_enabled?: boolean
          scheduled_time: string
          updated_at?: string
          user_id: string
          vitamin_name: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          icon_emoji?: string
          id?: string
          is_active?: boolean
          notification_enabled?: boolean
          scheduled_time?: string
          updated_at?: string
          user_id?: string
          vitamin_name?: string
        }
        Relationships: []
      }
      vaccine_countries: {
        Row: {
          code: string
          created_at: string
          flag_emoji: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name_ar: string | null
          name_az: string
          name_de: string | null
          name_en: string
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          schedule_meta: Json | null
          sort_order: number
          source_label: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name_ar?: string | null
          name_az: string
          name_de?: string | null
          name_en: string
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          schedule_meta?: Json | null
          sort_order?: number
          source_label?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name_ar?: string | null
          name_az?: string
          name_de?: string | null
          name_en?: string
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          schedule_meta?: Json | null
          sort_order?: number
          source_label?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vaccine_schedules: {
        Row: {
          age_label_ar: string | null
          age_label_az: string
          age_label_de: string | null
          age_label_en: string | null
          age_label_es: string | null
          age_label_fr: string | null
          age_label_hi: string | null
          age_label_id: string | null
          age_label_ja: string | null
          age_label_ka: string | null
          age_label_kk: string | null
          age_label_ko: string | null
          age_label_nl: string | null
          age_label_pl: string | null
          age_label_pt: string | null
          age_label_ru: string | null
          age_label_sv: string | null
          age_label_tr: string | null
          age_label_uz: string | null
          age_label_vi: string | null
          age_label_zh: string | null
          country_code: string
          created_at: string
          dose_label_ar: string | null
          dose_label_az: string
          dose_label_de: string | null
          dose_label_en: string | null
          dose_label_es: string | null
          dose_label_fr: string | null
          dose_label_hi: string | null
          dose_label_id: string | null
          dose_label_ja: string | null
          dose_label_ka: string | null
          dose_label_kk: string | null
          dose_label_ko: string | null
          dose_label_nl: string | null
          dose_label_pl: string | null
          dose_label_pt: string | null
          dose_label_ru: string | null
          dose_label_sv: string | null
          dose_label_tr: string | null
          dose_label_uz: string | null
          dose_label_vi: string | null
          dose_label_zh: string | null
          dose_number: number
          id: string
          max_age_days: number | null
          min_age_days: number | null
          notes_ar: string | null
          notes_az: string | null
          notes_de: string | null
          notes_en: string | null
          notes_es: string | null
          notes_fr: string | null
          notes_hi: string | null
          notes_id: string | null
          notes_ja: string | null
          notes_ka: string | null
          notes_kk: string | null
          notes_ko: string | null
          notes_nl: string | null
          notes_pl: string | null
          notes_pt: string | null
          notes_ru: string | null
          notes_sv: string | null
          notes_tr: string | null
          notes_uz: string | null
          notes_vi: string | null
          notes_zh: string | null
          recommended_age_days: number
          schedule_meta: Json | null
          sort_order: number
          updated_at: string
          vaccine_id: string
        }
        Insert: {
          age_label_ar?: string | null
          age_label_az: string
          age_label_de?: string | null
          age_label_en?: string | null
          age_label_es?: string | null
          age_label_fr?: string | null
          age_label_hi?: string | null
          age_label_id?: string | null
          age_label_ja?: string | null
          age_label_ka?: string | null
          age_label_kk?: string | null
          age_label_ko?: string | null
          age_label_nl?: string | null
          age_label_pl?: string | null
          age_label_pt?: string | null
          age_label_ru?: string | null
          age_label_sv?: string | null
          age_label_tr?: string | null
          age_label_uz?: string | null
          age_label_vi?: string | null
          age_label_zh?: string | null
          country_code: string
          created_at?: string
          dose_label_ar?: string | null
          dose_label_az: string
          dose_label_de?: string | null
          dose_label_en?: string | null
          dose_label_es?: string | null
          dose_label_fr?: string | null
          dose_label_hi?: string | null
          dose_label_id?: string | null
          dose_label_ja?: string | null
          dose_label_ka?: string | null
          dose_label_kk?: string | null
          dose_label_ko?: string | null
          dose_label_nl?: string | null
          dose_label_pl?: string | null
          dose_label_pt?: string | null
          dose_label_ru?: string | null
          dose_label_sv?: string | null
          dose_label_tr?: string | null
          dose_label_uz?: string | null
          dose_label_vi?: string | null
          dose_label_zh?: string | null
          dose_number?: number
          id?: string
          max_age_days?: number | null
          min_age_days?: number | null
          notes_ar?: string | null
          notes_az?: string | null
          notes_de?: string | null
          notes_en?: string | null
          notes_es?: string | null
          notes_fr?: string | null
          notes_hi?: string | null
          notes_id?: string | null
          notes_ja?: string | null
          notes_ka?: string | null
          notes_kk?: string | null
          notes_ko?: string | null
          notes_nl?: string | null
          notes_pl?: string | null
          notes_pt?: string | null
          notes_ru?: string | null
          notes_sv?: string | null
          notes_tr?: string | null
          notes_uz?: string | null
          notes_vi?: string | null
          notes_zh?: string | null
          recommended_age_days: number
          schedule_meta?: Json | null
          sort_order?: number
          updated_at?: string
          vaccine_id: string
        }
        Update: {
          age_label_ar?: string | null
          age_label_az?: string
          age_label_de?: string | null
          age_label_en?: string | null
          age_label_es?: string | null
          age_label_fr?: string | null
          age_label_hi?: string | null
          age_label_id?: string | null
          age_label_ja?: string | null
          age_label_ka?: string | null
          age_label_kk?: string | null
          age_label_ko?: string | null
          age_label_nl?: string | null
          age_label_pl?: string | null
          age_label_pt?: string | null
          age_label_ru?: string | null
          age_label_sv?: string | null
          age_label_tr?: string | null
          age_label_uz?: string | null
          age_label_vi?: string | null
          age_label_zh?: string | null
          country_code?: string
          created_at?: string
          dose_label_ar?: string | null
          dose_label_az?: string
          dose_label_de?: string | null
          dose_label_en?: string | null
          dose_label_es?: string | null
          dose_label_fr?: string | null
          dose_label_hi?: string | null
          dose_label_id?: string | null
          dose_label_ja?: string | null
          dose_label_ka?: string | null
          dose_label_kk?: string | null
          dose_label_ko?: string | null
          dose_label_nl?: string | null
          dose_label_pl?: string | null
          dose_label_pt?: string | null
          dose_label_ru?: string | null
          dose_label_sv?: string | null
          dose_label_tr?: string | null
          dose_label_uz?: string | null
          dose_label_vi?: string | null
          dose_label_zh?: string | null
          dose_number?: number
          id?: string
          max_age_days?: number | null
          min_age_days?: number | null
          notes_ar?: string | null
          notes_az?: string | null
          notes_de?: string | null
          notes_en?: string | null
          notes_es?: string | null
          notes_fr?: string | null
          notes_hi?: string | null
          notes_id?: string | null
          notes_ja?: string | null
          notes_ka?: string | null
          notes_kk?: string | null
          notes_ko?: string | null
          notes_nl?: string | null
          notes_pl?: string | null
          notes_pt?: string | null
          notes_ru?: string | null
          notes_sv?: string | null
          notes_tr?: string | null
          notes_uz?: string | null
          notes_vi?: string | null
          notes_zh?: string | null
          recommended_age_days?: number
          schedule_meta?: Json | null
          sort_order?: number
          updated_at?: string
          vaccine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccine_schedules_vaccine_id_fkey"
            columns: ["vaccine_id"]
            isOneToOne: false
            referencedRelation: "vaccines"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccines: {
        Row: {
          code: string
          color_hex: string | null
          contraindications_ar: string | null
          contraindications_az: string | null
          contraindications_de: string | null
          contraindications_en: string | null
          contraindications_es: string | null
          contraindications_fr: string | null
          contraindications_hi: string | null
          contraindications_id: string | null
          contraindications_ja: string | null
          contraindications_ka: string | null
          contraindications_kk: string | null
          contraindications_ko: string | null
          contraindications_nl: string | null
          contraindications_pl: string | null
          contraindications_pt: string | null
          contraindications_ru: string | null
          contraindications_sv: string | null
          contraindications_tr: string | null
          contraindications_uz: string | null
          contraindications_vi: string | null
          contraindications_zh: string | null
          country_code: string
          created_at: string
          disease_ar: string | null
          disease_az: string | null
          disease_de: string | null
          disease_en: string | null
          disease_es: string | null
          disease_fr: string | null
          disease_hi: string | null
          disease_id: string | null
          disease_ja: string | null
          disease_ka: string | null
          disease_kk: string | null
          disease_ko: string | null
          disease_nl: string | null
          disease_pl: string | null
          disease_pt: string | null
          disease_ru: string | null
          disease_sv: string | null
          disease_tr: string | null
          disease_uz: string | null
          disease_vi: string | null
          disease_zh: string | null
          full_description_ar: string | null
          full_description_az: string | null
          full_description_de: string | null
          full_description_en: string | null
          full_description_es: string | null
          full_description_fr: string | null
          full_description_hi: string | null
          full_description_id: string | null
          full_description_ja: string | null
          full_description_ka: string | null
          full_description_kk: string | null
          full_description_ko: string | null
          full_description_nl: string | null
          full_description_pl: string | null
          full_description_pt: string | null
          full_description_ru: string | null
          full_description_sv: string | null
          full_description_tr: string | null
          full_description_uz: string | null
          full_description_vi: string | null
          full_description_zh: string | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          name_ar: string | null
          name_az: string
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          route_ar: string | null
          route_az: string | null
          route_de: string | null
          route_en: string | null
          route_es: string | null
          route_fr: string | null
          route_hi: string | null
          route_id: string | null
          route_ja: string | null
          route_ka: string | null
          route_kk: string | null
          route_ko: string | null
          route_nl: string | null
          route_pl: string | null
          route_pt: string | null
          route_ru: string | null
          route_sv: string | null
          route_tr: string | null
          route_uz: string | null
          route_vi: string | null
          route_zh: string | null
          short_description_ar: string | null
          short_description_az: string | null
          short_description_de: string | null
          short_description_en: string | null
          short_description_es: string | null
          short_description_fr: string | null
          short_description_hi: string | null
          short_description_id: string | null
          short_description_ja: string | null
          short_description_ka: string | null
          short_description_kk: string | null
          short_description_ko: string | null
          short_description_nl: string | null
          short_description_pl: string | null
          short_description_pt: string | null
          short_description_ru: string | null
          short_description_sv: string | null
          short_description_tr: string | null
          short_description_uz: string | null
          short_description_vi: string | null
          short_description_zh: string | null
          side_effects_ar: string | null
          side_effects_az: string | null
          side_effects_de: string | null
          side_effects_en: string | null
          side_effects_es: string | null
          side_effects_fr: string | null
          side_effects_hi: string | null
          side_effects_id: string | null
          side_effects_ja: string | null
          side_effects_ka: string | null
          side_effects_kk: string | null
          side_effects_ko: string | null
          side_effects_nl: string | null
          side_effects_pl: string | null
          side_effects_pt: string | null
          side_effects_ru: string | null
          side_effects_sv: string | null
          side_effects_tr: string | null
          side_effects_uz: string | null
          side_effects_vi: string | null
          side_effects_zh: string | null
          sort_order: number
          source_url: string | null
          updated_at: string
        }
        Insert: {
          code: string
          color_hex?: string | null
          contraindications_ar?: string | null
          contraindications_az?: string | null
          contraindications_de?: string | null
          contraindications_en?: string | null
          contraindications_es?: string | null
          contraindications_fr?: string | null
          contraindications_hi?: string | null
          contraindications_id?: string | null
          contraindications_ja?: string | null
          contraindications_ka?: string | null
          contraindications_kk?: string | null
          contraindications_ko?: string | null
          contraindications_nl?: string | null
          contraindications_pl?: string | null
          contraindications_pt?: string | null
          contraindications_ru?: string | null
          contraindications_sv?: string | null
          contraindications_tr?: string | null
          contraindications_uz?: string | null
          contraindications_vi?: string | null
          contraindications_zh?: string | null
          country_code: string
          created_at?: string
          disease_ar?: string | null
          disease_az?: string | null
          disease_de?: string | null
          disease_en?: string | null
          disease_es?: string | null
          disease_fr?: string | null
          disease_hi?: string | null
          disease_id?: string | null
          disease_ja?: string | null
          disease_ka?: string | null
          disease_kk?: string | null
          disease_ko?: string | null
          disease_nl?: string | null
          disease_pl?: string | null
          disease_pt?: string | null
          disease_ru?: string | null
          disease_sv?: string | null
          disease_tr?: string | null
          disease_uz?: string | null
          disease_vi?: string | null
          disease_zh?: string | null
          full_description_ar?: string | null
          full_description_az?: string | null
          full_description_de?: string | null
          full_description_en?: string | null
          full_description_es?: string | null
          full_description_fr?: string | null
          full_description_hi?: string | null
          full_description_id?: string | null
          full_description_ja?: string | null
          full_description_ka?: string | null
          full_description_kk?: string | null
          full_description_ko?: string | null
          full_description_nl?: string | null
          full_description_pl?: string | null
          full_description_pt?: string | null
          full_description_ru?: string | null
          full_description_sv?: string | null
          full_description_tr?: string | null
          full_description_uz?: string | null
          full_description_vi?: string | null
          full_description_zh?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name_ar?: string | null
          name_az: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          route_ar?: string | null
          route_az?: string | null
          route_de?: string | null
          route_en?: string | null
          route_es?: string | null
          route_fr?: string | null
          route_hi?: string | null
          route_id?: string | null
          route_ja?: string | null
          route_ka?: string | null
          route_kk?: string | null
          route_ko?: string | null
          route_nl?: string | null
          route_pl?: string | null
          route_pt?: string | null
          route_ru?: string | null
          route_sv?: string | null
          route_tr?: string | null
          route_uz?: string | null
          route_vi?: string | null
          route_zh?: string | null
          short_description_ar?: string | null
          short_description_az?: string | null
          short_description_de?: string | null
          short_description_en?: string | null
          short_description_es?: string | null
          short_description_fr?: string | null
          short_description_hi?: string | null
          short_description_id?: string | null
          short_description_ja?: string | null
          short_description_ka?: string | null
          short_description_kk?: string | null
          short_description_ko?: string | null
          short_description_nl?: string | null
          short_description_pl?: string | null
          short_description_pt?: string | null
          short_description_ru?: string | null
          short_description_sv?: string | null
          short_description_tr?: string | null
          short_description_uz?: string | null
          short_description_vi?: string | null
          short_description_zh?: string | null
          side_effects_ar?: string | null
          side_effects_az?: string | null
          side_effects_de?: string | null
          side_effects_en?: string | null
          side_effects_es?: string | null
          side_effects_fr?: string | null
          side_effects_hi?: string | null
          side_effects_id?: string | null
          side_effects_ja?: string | null
          side_effects_ka?: string | null
          side_effects_kk?: string | null
          side_effects_ko?: string | null
          side_effects_nl?: string | null
          side_effects_pl?: string | null
          side_effects_pt?: string | null
          side_effects_ru?: string | null
          side_effects_sv?: string | null
          side_effects_tr?: string | null
          side_effects_uz?: string | null
          side_effects_vi?: string | null
          side_effects_zh?: string | null
          sort_order?: number
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          color_hex?: string | null
          contraindications_ar?: string | null
          contraindications_az?: string | null
          contraindications_de?: string | null
          contraindications_en?: string | null
          contraindications_es?: string | null
          contraindications_fr?: string | null
          contraindications_hi?: string | null
          contraindications_id?: string | null
          contraindications_ja?: string | null
          contraindications_ka?: string | null
          contraindications_kk?: string | null
          contraindications_ko?: string | null
          contraindications_nl?: string | null
          contraindications_pl?: string | null
          contraindications_pt?: string | null
          contraindications_ru?: string | null
          contraindications_sv?: string | null
          contraindications_tr?: string | null
          contraindications_uz?: string | null
          contraindications_vi?: string | null
          contraindications_zh?: string | null
          country_code?: string
          created_at?: string
          disease_ar?: string | null
          disease_az?: string | null
          disease_de?: string | null
          disease_en?: string | null
          disease_es?: string | null
          disease_fr?: string | null
          disease_hi?: string | null
          disease_id?: string | null
          disease_ja?: string | null
          disease_ka?: string | null
          disease_kk?: string | null
          disease_ko?: string | null
          disease_nl?: string | null
          disease_pl?: string | null
          disease_pt?: string | null
          disease_ru?: string | null
          disease_sv?: string | null
          disease_tr?: string | null
          disease_uz?: string | null
          disease_vi?: string | null
          disease_zh?: string | null
          full_description_ar?: string | null
          full_description_az?: string | null
          full_description_de?: string | null
          full_description_en?: string | null
          full_description_es?: string | null
          full_description_fr?: string | null
          full_description_hi?: string | null
          full_description_id?: string | null
          full_description_ja?: string | null
          full_description_ka?: string | null
          full_description_kk?: string | null
          full_description_ko?: string | null
          full_description_nl?: string | null
          full_description_pl?: string | null
          full_description_pt?: string | null
          full_description_ru?: string | null
          full_description_sv?: string | null
          full_description_tr?: string | null
          full_description_uz?: string | null
          full_description_vi?: string | null
          full_description_zh?: string | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name_ar?: string | null
          name_az?: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          route_ar?: string | null
          route_az?: string | null
          route_de?: string | null
          route_en?: string | null
          route_es?: string | null
          route_fr?: string | null
          route_hi?: string | null
          route_id?: string | null
          route_ja?: string | null
          route_ka?: string | null
          route_kk?: string | null
          route_ko?: string | null
          route_nl?: string | null
          route_pl?: string | null
          route_pt?: string | null
          route_ru?: string | null
          route_sv?: string | null
          route_tr?: string | null
          route_uz?: string | null
          route_vi?: string | null
          route_zh?: string | null
          short_description_ar?: string | null
          short_description_az?: string | null
          short_description_de?: string | null
          short_description_en?: string | null
          short_description_es?: string | null
          short_description_fr?: string | null
          short_description_hi?: string | null
          short_description_id?: string | null
          short_description_ja?: string | null
          short_description_ka?: string | null
          short_description_kk?: string | null
          short_description_ko?: string | null
          short_description_nl?: string | null
          short_description_pl?: string | null
          short_description_pt?: string | null
          short_description_ru?: string | null
          short_description_sv?: string | null
          short_description_tr?: string | null
          short_description_uz?: string | null
          short_description_vi?: string | null
          short_description_zh?: string | null
          side_effects_ar?: string | null
          side_effects_az?: string | null
          side_effects_de?: string | null
          side_effects_en?: string | null
          side_effects_es?: string | null
          side_effects_fr?: string | null
          side_effects_hi?: string | null
          side_effects_id?: string | null
          side_effects_ja?: string | null
          side_effects_ka?: string | null
          side_effects_kk?: string | null
          side_effects_ko?: string | null
          side_effects_nl?: string | null
          side_effects_pl?: string | null
          side_effects_pt?: string | null
          side_effects_ru?: string | null
          side_effects_sv?: string | null
          side_effects_tr?: string | null
          side_effects_uz?: string | null
          side_effects_vi?: string | null
          side_effects_zh?: string | null
          sort_order?: number
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccines_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "vaccine_countries"
            referencedColumns: ["code"]
          },
        ]
      }
      vitamin_intake_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          schedule_id: string | null
          taken_at: string
          user_id: string
          vitamin_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          schedule_id?: string | null
          taken_at?: string
          user_id: string
          vitamin_name: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          schedule_id?: string | null
          taken_at?: string
          user_id?: string
          vitamin_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitamin_intake_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_vitamin_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      vitamins: {
        Row: {
          benefits: string[] | null
          benefits_ar: string[] | null
          benefits_de: string[] | null
          benefits_en: string[] | null
          benefits_es: string[] | null
          benefits_fr: string[] | null
          benefits_hi: string[] | null
          benefits_id: string[] | null
          benefits_ja: string[] | null
          benefits_ka: string[] | null
          benefits_kk: string[] | null
          benefits_ko: string[] | null
          benefits_nl: string[] | null
          benefits_pl: string[] | null
          benefits_pt: string[] | null
          benefits_ru: string[] | null
          benefits_sv: string[] | null
          benefits_tr: string[] | null
          benefits_uz: string[] | null
          benefits_vi: string[] | null
          benefits_zh: string[] | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          dosage: string | null
          dosage_ar: string | null
          dosage_de: string | null
          dosage_en: string | null
          dosage_es: string | null
          dosage_fr: string | null
          dosage_hi: string | null
          dosage_id: string | null
          dosage_ja: string | null
          dosage_ka: string | null
          dosage_kk: string | null
          dosage_ko: string | null
          dosage_nl: string | null
          dosage_pl: string | null
          dosage_pt: string | null
          dosage_ru: string | null
          dosage_sv: string | null
          dosage_tr: string | null
          dosage_uz: string | null
          dosage_vi: string | null
          dosage_zh: string | null
          food_sources: string[] | null
          food_sources_ar: string[] | null
          food_sources_de: string[] | null
          food_sources_en: string[] | null
          food_sources_es: string[] | null
          food_sources_fr: string[] | null
          food_sources_hi: string[] | null
          food_sources_id: string[] | null
          food_sources_ja: string[] | null
          food_sources_ka: string[] | null
          food_sources_kk: string[] | null
          food_sources_ko: string[] | null
          food_sources_nl: string[] | null
          food_sources_pl: string[] | null
          food_sources_pt: string[] | null
          food_sources_ru: string[] | null
          food_sources_sv: string[] | null
          food_sources_tr: string[] | null
          food_sources_uz: string[] | null
          food_sources_vi: string[] | null
          food_sources_zh: string[] | null
          icon_emoji: string | null
          id: string
          importance: string | null
          importance_en: string | null
          importance_ru: string | null
          importance_tr: string | null
          is_active: boolean | null
          life_stage: string | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          sort_order: number | null
          trimester: number[] | null
          updated_at: string
          week_end: number | null
          week_start: number | null
        }
        Insert: {
          benefits?: string[] | null
          benefits_ar?: string[] | null
          benefits_de?: string[] | null
          benefits_en?: string[] | null
          benefits_es?: string[] | null
          benefits_fr?: string[] | null
          benefits_hi?: string[] | null
          benefits_id?: string[] | null
          benefits_ja?: string[] | null
          benefits_ka?: string[] | null
          benefits_kk?: string[] | null
          benefits_ko?: string[] | null
          benefits_nl?: string[] | null
          benefits_pl?: string[] | null
          benefits_pt?: string[] | null
          benefits_ru?: string[] | null
          benefits_sv?: string[] | null
          benefits_tr?: string[] | null
          benefits_uz?: string[] | null
          benefits_vi?: string[] | null
          benefits_zh?: string[] | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          dosage?: string | null
          dosage_ar?: string | null
          dosage_de?: string | null
          dosage_en?: string | null
          dosage_es?: string | null
          dosage_fr?: string | null
          dosage_hi?: string | null
          dosage_id?: string | null
          dosage_ja?: string | null
          dosage_ka?: string | null
          dosage_kk?: string | null
          dosage_ko?: string | null
          dosage_nl?: string | null
          dosage_pl?: string | null
          dosage_pt?: string | null
          dosage_ru?: string | null
          dosage_sv?: string | null
          dosage_tr?: string | null
          dosage_uz?: string | null
          dosage_vi?: string | null
          dosage_zh?: string | null
          food_sources?: string[] | null
          food_sources_ar?: string[] | null
          food_sources_de?: string[] | null
          food_sources_en?: string[] | null
          food_sources_es?: string[] | null
          food_sources_fr?: string[] | null
          food_sources_hi?: string[] | null
          food_sources_id?: string[] | null
          food_sources_ja?: string[] | null
          food_sources_ka?: string[] | null
          food_sources_kk?: string[] | null
          food_sources_ko?: string[] | null
          food_sources_nl?: string[] | null
          food_sources_pl?: string[] | null
          food_sources_pt?: string[] | null
          food_sources_ru?: string[] | null
          food_sources_sv?: string[] | null
          food_sources_tr?: string[] | null
          food_sources_uz?: string[] | null
          food_sources_vi?: string[] | null
          food_sources_zh?: string[] | null
          icon_emoji?: string | null
          id?: string
          importance?: string | null
          importance_en?: string | null
          importance_ru?: string | null
          importance_tr?: string | null
          is_active?: boolean | null
          life_stage?: string | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          trimester?: number[] | null
          updated_at?: string
          week_end?: number | null
          week_start?: number | null
        }
        Update: {
          benefits?: string[] | null
          benefits_ar?: string[] | null
          benefits_de?: string[] | null
          benefits_en?: string[] | null
          benefits_es?: string[] | null
          benefits_fr?: string[] | null
          benefits_hi?: string[] | null
          benefits_id?: string[] | null
          benefits_ja?: string[] | null
          benefits_ka?: string[] | null
          benefits_kk?: string[] | null
          benefits_ko?: string[] | null
          benefits_nl?: string[] | null
          benefits_pl?: string[] | null
          benefits_pt?: string[] | null
          benefits_ru?: string[] | null
          benefits_sv?: string[] | null
          benefits_tr?: string[] | null
          benefits_uz?: string[] | null
          benefits_vi?: string[] | null
          benefits_zh?: string[] | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          dosage?: string | null
          dosage_ar?: string | null
          dosage_de?: string | null
          dosage_en?: string | null
          dosage_es?: string | null
          dosage_fr?: string | null
          dosage_hi?: string | null
          dosage_id?: string | null
          dosage_ja?: string | null
          dosage_ka?: string | null
          dosage_kk?: string | null
          dosage_ko?: string | null
          dosage_nl?: string | null
          dosage_pl?: string | null
          dosage_pt?: string | null
          dosage_ru?: string | null
          dosage_sv?: string | null
          dosage_tr?: string | null
          dosage_uz?: string | null
          dosage_vi?: string | null
          dosage_zh?: string | null
          food_sources?: string[] | null
          food_sources_ar?: string[] | null
          food_sources_de?: string[] | null
          food_sources_en?: string[] | null
          food_sources_es?: string[] | null
          food_sources_fr?: string[] | null
          food_sources_hi?: string[] | null
          food_sources_id?: string[] | null
          food_sources_ja?: string[] | null
          food_sources_ka?: string[] | null
          food_sources_kk?: string[] | null
          food_sources_ko?: string[] | null
          food_sources_nl?: string[] | null
          food_sources_pl?: string[] | null
          food_sources_pt?: string[] | null
          food_sources_ru?: string[] | null
          food_sources_sv?: string[] | null
          food_sources_tr?: string[] | null
          food_sources_uz?: string[] | null
          food_sources_vi?: string[] | null
          food_sources_zh?: string[] | null
          icon_emoji?: string | null
          id?: string
          importance?: string | null
          importance_en?: string | null
          importance_ru?: string | null
          importance_tr?: string | null
          is_active?: boolean | null
          life_stage?: string | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          sort_order?: number | null
          trimester?: number[] | null
          updated_at?: string
          week_end?: number | null
          week_start?: number | null
        }
        Relationships: []
      }
      weather_clothing_logs: {
        Row: {
          city_name: string | null
          clothing_advice: string | null
          created_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          pollen_advice: string | null
          user_id: string
          weather_data: Json | null
        }
        Insert: {
          city_name?: string | null
          clothing_advice?: string | null
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          pollen_advice?: string | null
          user_id: string
          weather_data?: Json | null
        }
        Update: {
          city_name?: string | null
          clothing_advice?: string | null
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          pollen_advice?: string | null
          user_id?: string
          weather_data?: Json | null
        }
        Relationships: []
      }
      weekly_tips: {
        Row: {
          content: string
          content_ar: string | null
          content_de: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          content_hi: string | null
          content_id: string | null
          content_ja: string | null
          content_ka: string | null
          content_kk: string | null
          content_ko: string | null
          content_nl: string | null
          content_pl: string | null
          content_pt: string | null
          content_ru: string | null
          content_sv: string | null
          content_tr: string | null
          content_uz: string | null
          content_vi: string | null
          content_zh: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          life_stage: string
          tips: Json | null
          tips_ar: Json | null
          tips_de: Json | null
          tips_en: Json | null
          tips_es: Json | null
          tips_fr: Json | null
          tips_hi: Json | null
          tips_id: Json | null
          tips_ja: Json | null
          tips_ka: Json | null
          tips_kk: Json | null
          tips_ko: Json | null
          tips_nl: Json | null
          tips_pl: Json | null
          tips_pt: Json | null
          tips_ru: Json | null
          tips_sv: Json | null
          tips_tr: Json | null
          tips_uz: Json | null
          tips_vi: Json | null
          tips_zh: Json | null
          title: string
          title_ar: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
          week_number: number
        }
        Insert: {
          content: string
          content_ar?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          life_stage?: string
          tips?: Json | null
          tips_ar?: Json | null
          tips_de?: Json | null
          tips_en?: Json | null
          tips_es?: Json | null
          tips_fr?: Json | null
          tips_hi?: Json | null
          tips_id?: Json | null
          tips_ja?: Json | null
          tips_ka?: Json | null
          tips_kk?: Json | null
          tips_ko?: Json | null
          tips_nl?: Json | null
          tips_pl?: Json | null
          tips_pt?: Json | null
          tips_ru?: Json | null
          tips_sv?: Json | null
          tips_tr?: Json | null
          tips_uz?: Json | null
          tips_vi?: Json | null
          tips_zh?: Json | null
          title: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
          week_number: number
        }
        Update: {
          content?: string
          content_ar?: string | null
          content_de?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          content_hi?: string | null
          content_id?: string | null
          content_ja?: string | null
          content_ka?: string | null
          content_kk?: string | null
          content_ko?: string | null
          content_nl?: string | null
          content_pl?: string | null
          content_pt?: string | null
          content_ru?: string | null
          content_sv?: string | null
          content_tr?: string | null
          content_uz?: string | null
          content_vi?: string | null
          content_zh?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          life_stage?: string
          tips?: Json | null
          tips_ar?: Json | null
          tips_de?: Json | null
          tips_en?: Json | null
          tips_es?: Json | null
          tips_fr?: Json | null
          tips_hi?: Json | null
          tips_id?: Json | null
          tips_ja?: Json | null
          tips_ka?: Json | null
          tips_kk?: Json | null
          tips_ko?: Json | null
          tips_nl?: Json | null
          tips_pl?: Json | null
          tips_pt?: Json | null
          tips_ru?: Json | null
          tips_sv?: Json | null
          tips_tr?: Json | null
          tips_uz?: Json | null
          tips_vi?: Json | null
          tips_zh?: Json | null
          title?: string
          title_ar?: string | null
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
          title_hi?: string | null
          title_id?: string | null
          title_ja?: string | null
          title_ka?: string | null
          title_kk?: string | null
          title_ko?: string | null
          title_nl?: string | null
          title_pl?: string | null
          title_pt?: string | null
          title_ru?: string | null
          title_sv?: string | null
          title_tr?: string | null
          title_uz?: string | null
          title_vi?: string | null
          title_zh?: string | null
          updated_at?: string
          week_number?: number
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          notes: string | null
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      weight_recommendations: {
        Row: {
          bmi_category: string
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          is_active: boolean | null
          max_gain_kg: number
          min_gain_kg: number
          trimester: number
          weekly_gain_kg: number | null
        }
        Insert: {
          bmi_category?: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          max_gain_kg: number
          min_gain_kg: number
          trimester: number
          weekly_gain_kg?: number | null
        }
        Update: {
          bmi_category?: string
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          is_active?: boolean | null
          max_gain_kg?: number
          min_gain_kg?: number
          trimester?: number
          weekly_gain_kg?: number | null
        }
        Relationships: []
      }
      white_noise_sounds: {
        Row: {
          audio_url: string | null
          color_gradient: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          name_az: string | null
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          noise_type: string | null
          sort_order: number | null
        }
        Insert: {
          audio_url?: string | null
          color_gradient?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          noise_type?: string | null
          sort_order?: number | null
        }
        Update: {
          audio_url?: string | null
          color_gradient?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_az?: string | null
          description_de?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ka?: string | null
          description_kk?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_uz?: string | null
          description_vi?: string | null
          description_zh?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          name_az?: string | null
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          noise_type?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      zodiac_compatibility: {
        Row: {
          compatibility_score: number | null
          description: string | null
          description_az: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_vi: string | null
          description_zh: string | null
          id: string
          relationship_type: string | null
          sign1: string
          sign2: string
        }
        Insert: {
          compatibility_score?: number | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          relationship_type?: string | null
          sign1: string
          sign2: string
        }
        Update: {
          compatibility_score?: number | null
          description?: string | null
          description_az?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          description_hi?: string | null
          description_id?: string | null
          description_ja?: string | null
          description_ko?: string | null
          description_nl?: string | null
          description_pl?: string | null
          description_pt?: string | null
          description_ru?: string | null
          description_sv?: string | null
          description_tr?: string | null
          description_vi?: string | null
          description_zh?: string | null
          id?: string
          relationship_type?: string | null
          sign1?: string
          sign2?: string
        }
        Relationships: []
      }
      zodiac_signs: {
        Row: {
          characteristics: string[] | null
          characteristics_ar: string | null
          characteristics_az: string[] | null
          characteristics_de: string | null
          characteristics_en: string | null
          characteristics_es: string | null
          characteristics_fr: string | null
          characteristics_hi: string | null
          characteristics_id: string | null
          characteristics_ja: string | null
          characteristics_ka: string | null
          characteristics_kk: string | null
          characteristics_ko: string | null
          characteristics_nl: string | null
          characteristics_pl: string | null
          characteristics_pt: string | null
          characteristics_ru: string | null
          characteristics_sv: string | null
          characteristics_tr: string | null
          characteristics_uz: string | null
          characteristics_vi: string | null
          characteristics_zh: string | null
          color: string | null
          element: string | null
          end_date: string
          id: string
          name: string
          name_ar: string | null
          name_az: string
          name_de: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ka: string | null
          name_kk: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_ru: string | null
          name_sv: string | null
          name_tr: string | null
          name_uz: string | null
          name_vi: string | null
          name_zh: string | null
          ruling_planet: string | null
          sort_order: number | null
          start_date: string
          symbol: string
        }
        Insert: {
          characteristics?: string[] | null
          characteristics_ar?: string | null
          characteristics_az?: string[] | null
          characteristics_de?: string | null
          characteristics_en?: string | null
          characteristics_es?: string | null
          characteristics_fr?: string | null
          characteristics_hi?: string | null
          characteristics_id?: string | null
          characteristics_ja?: string | null
          characteristics_ka?: string | null
          characteristics_kk?: string | null
          characteristics_ko?: string | null
          characteristics_nl?: string | null
          characteristics_pl?: string | null
          characteristics_pt?: string | null
          characteristics_ru?: string | null
          characteristics_sv?: string | null
          characteristics_tr?: string | null
          characteristics_uz?: string | null
          characteristics_vi?: string | null
          characteristics_zh?: string | null
          color?: string | null
          element?: string | null
          end_date: string
          id?: string
          name: string
          name_ar?: string | null
          name_az: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          ruling_planet?: string | null
          sort_order?: number | null
          start_date: string
          symbol: string
        }
        Update: {
          characteristics?: string[] | null
          characteristics_ar?: string | null
          characteristics_az?: string[] | null
          characteristics_de?: string | null
          characteristics_en?: string | null
          characteristics_es?: string | null
          characteristics_fr?: string | null
          characteristics_hi?: string | null
          characteristics_id?: string | null
          characteristics_ja?: string | null
          characteristics_ka?: string | null
          characteristics_kk?: string | null
          characteristics_ko?: string | null
          characteristics_nl?: string | null
          characteristics_pl?: string | null
          characteristics_pt?: string | null
          characteristics_ru?: string | null
          characteristics_sv?: string | null
          characteristics_tr?: string | null
          characteristics_uz?: string | null
          characteristics_vi?: string | null
          characteristics_zh?: string | null
          color?: string | null
          element?: string | null
          end_date?: string
          id?: string
          name?: string
          name_ar?: string | null
          name_az?: string
          name_de?: string | null
          name_en?: string | null
          name_es?: string | null
          name_fr?: string | null
          name_hi?: string | null
          name_id?: string | null
          name_ja?: string | null
          name_ka?: string | null
          name_kk?: string | null
          name_ko?: string | null
          name_nl?: string | null
          name_pl?: string | null
          name_pt?: string | null
          name_ru?: string | null
          name_sv?: string | null
          name_tr?: string | null
          name_uz?: string | null
          name_vi?: string | null
          name_zh?: string | null
          ruling_planet?: string | null
          sort_order?: number | null
          start_date?: string
          symbol?: string
        }
        Relationships: []
      }
    }
    Views: {
      partner_venues_public: {
        Row: {
          address: string | null
          address_en: string | null
          address_es: string | null
          address_fr: string | null
          address_hi: string | null
          address_id: string | null
          address_ja: string | null
          address_ko: string | null
          address_nl: string | null
          address_pl: string | null
          address_pt: string | null
          address_sv: string | null
          address_vi: string | null
          address_zh: string | null
          category_key: string | null
          city: string | null
          city_en: string | null
          city_es: string | null
          city_fr: string | null
          city_hi: string | null
          city_id: string | null
          city_ja: string | null
          city_ko: string | null
          city_nl: string | null
          city_pl: string | null
          city_pt: string | null
          city_sv: string | null
          city_vi: string | null
          city_zh: string | null
          countries: string[] | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_sv: string | null
          description_vi: string | null
          description_zh: string | null
          discount_label: string | null
          discount_label_en: string | null
          discount_label_es: string | null
          discount_label_fr: string | null
          discount_label_hi: string | null
          discount_label_id: string | null
          discount_label_ja: string | null
          discount_label_ko: string | null
          discount_label_nl: string | null
          discount_label_pl: string | null
          discount_label_pt: string | null
          discount_label_sv: string | null
          discount_label_vi: string | null
          discount_label_zh: string | null
          discount_terms: string | null
          discount_terms_en: string | null
          discount_terms_es: string | null
          discount_terms_fr: string | null
          discount_terms_hi: string | null
          discount_terms_id: string | null
          discount_terms_ja: string | null
          discount_terms_ko: string | null
          discount_terms_nl: string | null
          discount_terms_pl: string | null
          discount_terms_pt: string | null
          discount_terms_sv: string | null
          discount_terms_vi: string | null
          discount_terms_zh: string | null
          discount_value: number | null
          district: string | null
          district_en: string | null
          district_es: string | null
          district_fr: string | null
          district_hi: string | null
          district_id: string | null
          district_ja: string | null
          district_ko: string | null
          district_nl: string | null
          district_pl: string | null
          district_pt: string | null
          district_sv: string | null
          district_vi: string | null
          district_zh: string | null
          gallery_urls: string[] | null
          id: string | null
          instagram: string | null
          is_active: boolean | null
          is_featured: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string | null
          name_en: string | null
          name_es: string | null
          name_fr: string | null
          name_hi: string | null
          name_id: string | null
          name_ja: string | null
          name_ko: string | null
          name_nl: string | null
          name_pl: string | null
          name_pt: string | null
          name_sv: string | null
          name_vi: string | null
          name_zh: string | null
          phone: string | null
          qr_ttl_seconds: number | null
          redemption_cooldown_hours: number | null
          redemption_lifetime_limit: number | null
          slug: string | null
          sort_order: number | null
          updated_at: string | null
          website: string | null
          working_hours: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_venues_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "partner_venue_categories"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Functions: {
      _grant_premium_days: {
        Args: { p_days: number; p_user: string }
        Returns: undefined
      }
      ack_my_moderator_warning_v1: {
        Args: { p_actor: string; p_claim: string; p_warning: string }
        Returns: boolean
      }
      admin_assert_access_v1: { Args: never; Returns: undefined }
      admin_brand_action_v1: {
        Args: {
          p_action: string
          p_brand: string
          p_payload: Json
          p_request: string
          p_target: string
        }
        Returns: Json
      }
      admin_brand_workspace_v1: { Args: { p_brand?: string }; Returns: Json }
      admin_community_ad_decide_v1: {
        Args: {
          p_action: string
          p_id: string
          p_note: string
          p_reason: string
          p_request: string
          p_revision: number
          p_updated_at: string
        }
        Returns: Json
      }
      admin_community_ad_queue_v1: {
        Args: {
          p_language?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_since?: string
          p_state?: string
        }
        Returns: Json
      }
      admin_country_features: {
        Args: { _country: string; _from: string; _limit?: number; _to: string }
        Returns: {
          event_category: string
          event_count: number
          event_name: string
          unique_users: number
        }[]
      }
      admin_country_platforms: {
        Args: { _country: string; _from: string; _to: string }
        Returns: {
          event_count: number
          platform: string
          unique_users: number
        }[]
      }
      admin_country_stats: {
        Args: { _from: string; _to: string }
        Returns: {
          active_users: number
          bump_users: number
          country_code: string
          flow_users: number
          mommy_users: number
          new_users: number
          partner_users: number
          premium_users: number
          total_users: number
        }[]
      }
      admin_country_timeseries: {
        Args: { _country: string; _from: string; _to: string }
        Returns: {
          active_users: number
          day: string
          new_users: number
        }[]
      }
      admin_insight_filters_v1: { Args: { p_filters?: Json }; Returns: Json }
      admin_insights_v1: {
        Args: { p_filters?: Json; p_from: string; p_to: string }
        Returns: Json
      }
      admin_matches_insight_v1: {
        Args: {
          access_kind: string
          billing_cycle: string
          country: string
          email: string
          expires_at: string
          f: Json
          language: string
          module: string
          name: string
          subscription_status: string
        }
        Returns: boolean
      }
      admin_member_facts_v1: {
        Args: never
        Returns: {
          access_kind: string
          billing_basis: string
          billing_cycle: string
          cancelled_at: string
          country: string
          email: string
          expires_at: string
          is_trial: boolean
          joined_at: string
          language: string
          module: string
          name: string
          product_id: string
          subscription_status: string
          user_id: string
        }[]
      }
      admin_members_v1: {
        Args: { p_filters?: Json; p_page?: number; p_size?: number }
        Returns: Json
      }
      admin_notification_audience_v1: {
        Args: { p_segment: Json }
        Returns: {
          eligible: boolean
          platform: string
          reason: string
          token_hash: string
          token_id: string
          user_id: string
        }[]
      }
      admin_notification_cancel_v1: { Args: { p_id: string }; Returns: Json }
      admin_notification_claim_v1: {
        Args: { p_claim: string; p_id: string; p_limit?: number }
        Returns: Json
      }
      admin_notification_create_v1: {
        Args: {
          p_body: string
          p_fingerprint: string
          p_id: string
          p_segment: Json
          p_title: string
        }
        Returns: Json
      }
      admin_notification_finish_v1: {
        Args: { p_claim: string; p_id: string; p_results: Json }
        Returns: Json
      }
      admin_notification_list_v1: { Args: { p_limit?: number }; Returns: Json }
      admin_notification_preview_v1: {
        Args: { p_segment: Json }
        Returns: Json
      }
      admin_notification_quiet_v1: {
        Args: { enabled: boolean; end_at: string; start_at: string }
        Returns: boolean
      }
      admin_notification_segment_v1: {
        Args: { p_segment: Json }
        Returns: Json
      }
      admin_notification_status_v1: { Args: { p_id: string }; Returns: Json }
      admin_retry_community_ad_delivery_v1: {
        Args: { p_id: string }
        Returns: boolean
      }
      admin_set_source_admob_emergency_v1: {
        Args: { p_disabled: boolean }
        Returns: Json
      }
      anacan_source_stream_v1: {
        Args: { p_action: string; p_options?: Json }
        Returns: Json
      }
      anacan_source_sync_v1: {
        Args: { p_action: string; p_options?: Json }
        Returns: Json
      }
      anacan_source_writer_status_v1: { Args: never; Returns: Json }
      brand_ad_report_v1: {
        Args: {
          p_ad?: string
          p_brand: string
          p_export?: boolean
          p_from: string
          p_limit?: number
          p_offset?: number
          p_placement?: string
          p_search?: string
          p_sort?: string
          p_status?: string
          p_to: string
        }
        Returns: Json
      }
      brand_ad_status_v1: {
        Args: { p: Json; p_brand_active: boolean; p_deleted: string }
        Returns: string
      }
      brand_ads_access_v1: { Args: { p_brand: string }; Returns: string }
      brand_ads_admin_v1: { Args: never; Returns: string }
      brand_banner_eligible_v1: {
        Args: { p_actor: string; p_banner: string; p_language: string }
        Returns: boolean
      }
      brand_banner_readable_v1: { Args: { p_banner: string }; Returns: boolean }
      can_redeem_partner_venue: {
        Args: { _user_id: string; _venue_id: string }
        Returns: Json
      }
      chat_actor_v2: { Args: { p_expected: string }; Returns: string }
      chat_create_group_v2: {
        Args: {
          p_actor: string
          p_description?: string
          p_id: string
          p_members?: string[]
          p_name: string
        }
        Returns: string
      }
      chat_create_group_v3: {
        Args: {
          p_actor: string
          p_description?: string
          p_id: string
          p_members?: string[]
          p_name: string
          p_visibility?: string
        }
        Returns: string
      }
      chat_create_group_v4: {
        Args: {
          p_actor: string
          p_description?: string
          p_id: string
          p_language: string
          p_members?: string[]
          p_name: string
          p_visibility?: string
        }
        Returns: string
      }
      chat_delete_group_message_v3: {
        Args: { p_actor: string; p_group: string; p_message: string }
        Returns: Json
      }
      chat_group_action_v3: {
        Args: {
          p_action: string
          p_actor: string
          p_group: string
          p_users?: string[]
        }
        Returns: Json
      }
      chat_group_admin_v2: { Args: { p_group: string }; Returns: boolean }
      chat_group_cards_v3: { Args: { p_groups: string[] }; Returns: Json[] }
      chat_group_cards_v4: {
        Args: { p_groups: string[]; p_language: string }
        Returns: Json[]
      }
      chat_group_member_v2: { Args: { p_group: string }; Returns: boolean }
      chat_group_members_v2: {
        Args: { p_group: string }
        Returns: {
          avatar_url: string
          joined_at: string
          name: string
          role: string
          user_id: string
        }[]
      }
      chat_group_notice_v3: {
        Args: {
          p_actor: string
          p_group: string
          p_kind: string
          p_target: string
        }
        Returns: undefined
      }
      chat_group_owner_v3: { Args: { p_group: string }; Returns: boolean }
      chat_group_people_v3: { Args: { p_group: string }; Returns: Json[] }
      chat_group_public_v2: { Args: { p_group: string }; Returns: boolean }
      chat_groups_v2: { Args: never; Returns: Json[] }
      chat_groups_v3: {
        Args: { p_group?: string; p_scope?: string; p_search?: string }
        Returns: Json[]
      }
      chat_groups_v4: {
        Args: {
          p_group?: string
          p_language: string
          p_scope?: string
          p_search?: string
        }
        Returns: Json[]
      }
      chat_manage_members_v2: {
        Args: {
          p_action: string
          p_actor: string
          p_group: string
          p_users?: string[]
        }
        Returns: undefined
      }
      chat_mark_read_v2: {
        Args: {
          p_actor: string
          p_ids?: string[]
          p_kind: string
          p_target: string
        }
        Returns: undefined
      }
      chat_media_visible_v2: { Args: { p_path: string }; Returns: boolean }
      chat_message_visible_v2: {
        Args: { p_kind: string; p_message: string }
        Returns: boolean
      }
      chat_messages_v2: {
        Args: {
          p_before_at?: string
          p_before_id?: string
          p_kind: string
          p_limit?: number
          p_target: string
        }
        Returns: Json[]
      }
      chat_send_message_v2: {
        Args: {
          p_actor: string
          p_content?: string
          p_duration_ms?: number
          p_id: string
          p_kind: string
          p_media_mime?: string
          p_media_path?: string
          p_reply_to?: string
          p_target: string
          p_type?: string
        }
        Returns: Json
      }
      chat_set_reaction_v2: {
        Args: {
          p_actor: string
          p_emoji?: string
          p_kind: string
          p_message: string
        }
        Returns: undefined
      }
      chat_update_group_v3: {
        Args: {
          p_actor: string
          p_description: string
          p_group: string
          p_name: string
          p_posting_policy: string
          p_visibility: string
        }
        Returns: undefined
      }
      claim_communication_notification_v2: {
        Args: {
          p_body: string
          p_data: Json
          p_interaction_id: string
          p_kind: string
          p_target_user_id: string
          p_title: string
        }
        Returns: boolean
      }
      claim_community_ad_deliveries_v1: {
        Args: { p_claim: string; p_limit?: number; p_review_ids?: string[] }
        Returns: Json
      }
      claim_community_ad_reviews_v1: {
        Args: { p_claim: string; p_limit?: number; p_review_ids?: string[] }
        Returns: Json
      }
      claim_my_moderator_warning_v1: {
        Args: { p_actor: string; p_claim: string }
        Returns: Json
      }
      community_ad_admin_v1: { Args: never; Returns: undefined }
      community_ad_case_v1: { Args: { p_id: string }; Returns: Json }
      community_ad_delivery_payload_v1: {
        Args: { p_claim: string; p_id: string }
        Returns: Json
      }
      community_ad_hash_v1: { Args: { p: Json }; Returns: string }
      community_ad_media_delete_allowed_v1: {
        Args: { p_bucket: string; p_name: string }
        Returns: boolean
      }
      community_ad_media_key_v1: {
        Args: { p_author: string; p_url: string }
        Returns: string
      }
      community_ad_media_ready_v1: {
        Args: { p_author: string; p_urls: string[] }
        Returns: boolean
      }
      community_ad_media_referenced_v1: {
        Args: { p_bucket: string; p_name: string }
        Returns: boolean
      }
      community_ad_notice_copy_v1: {
        Args: { p_language: string; p_state: string }
        Returns: Json
      }
      community_ad_notify_v1: {
        Args: { p_event: string; p_review: string; p_technical?: boolean }
        Returns: undefined
      }
      community_ad_payload_v1: { Args: { p: Json }; Returns: Json }
      community_ad_service_v1: { Args: never; Returns: undefined }
      community_ad_worker_heartbeat_v1: {
        Args: { p_report: Json; p_run: string }
        Returns: undefined
      }
      community_blog_visible_v1: {
        Args: { p_blog: string; p_user: string }
        Returns: boolean
      }
      community_comments_v2: {
        Args: { p_post: string }
        Returns: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          is_anonymous: boolean
          is_pinned: boolean | null
          likes_count: number | null
          moderation_action_id: string | null
          moderation_edited_at: string | null
          moderation_edited_by: string | null
          moderation_reason: string | null
          moderation_removed_at: string | null
          moderation_version: number | null
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "post_comments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      community_language_valid_v1: { Args: { value: string }; Returns: boolean }
      community_language_words_v1: { Args: never; Returns: Json }
      community_legacy_post_language_v1: {
        Args: { p_content: string; p_preferred: string; p_submitted: string }
        Returns: string
      }
      community_premium_active_v2: {
        Args: { p_user: string }
        Returns: boolean
      }
      community_resolve_post_language_v1: {
        Args: { p_actor: string; p_content: string; p_language: string }
        Returns: string
      }
      confirm_referral_conversion: {
        Args: { p_referred_user_id: string }
        Returns: Json
      }
      customerio_activity_event_v1: {
        Args: { event_name: string }
        Returns: boolean
      }
      customerio_audience_dirty_v1: {
        Args: { actor: string }
        Returns: undefined
      }
      customerio_audience_enqueue_household_v1: {
        Args: { actor: string }
        Returns: undefined
      }
      customerio_audience_traits_v1: { Args: { actor: string }; Returns: Json }
      customerio_audience_v1: {
        Args: { p_action: string; p_options?: Json }
        Returns: Json
      }
      customerio_enqueue_v1: { Args: { actor: string }; Returns: undefined }
      customerio_iso_v1: { Args: { value: string }; Returns: string }
      customerio_profile_event_base_v1: {
        Args: { actor: string }
        Returns: Json
      }
      customerio_profile_event_v1: { Args: { actor: string }; Returns: Json }
      customerio_source_grant_v1: { Args: { actor: string }; Returns: Json }
      customerio_sync_v1: {
        Args: { p_action: string; p_options?: Json }
        Returns: Json
      }
      customerio_writer_open_v1: { Args: never; Returns: boolean }
      edit_community_post_v1: {
        Args: {
          p_actor: string
          p_content: string
          p_expected_revision?: number
          p_language: string
          p_post: string
        }
        Returns: Json
      }
      find_partner_by_code: {
        Args: { p_partner_code: string }
        Returns: {
          id: string
          is_premium: boolean
          name: string
          user_id: string
        }[]
      }
      finish_community_ad_delivery_v1: {
        Args: {
          p_claim: string
          p_code?: string
          p_id: string
          p_state: string
        }
        Returns: boolean
      }
      finish_community_ad_review_v1: {
        Args: {
          p_claim: string
          p_content_hash: string
          p_id: string
          p_result: Json
        }
        Returns: Json
      }
      generate_partner_code: { Args: never; Returns: string }
      get_active_payment_methods: {
        Args: never
        Returns: {
          created_at: string
          description: string
          description_az: string
          icon: string
          id: string
          is_active: boolean
          label: string
          label_az: string
          method_key: string
          sort_order: number
          updated_at: string
        }[]
      }
      get_active_users_count: { Args: { _since: string }; Returns: number }
      get_admin_console_contract_v1: { Args: never; Returns: Json }
      get_anacan_account_projection_contract_v1: { Args: never; Returns: Json }
      get_anacan_notification_contract_v1: { Args: never; Returns: Json }
      get_anacan_notification_delivery_v2: { Args: never; Returns: Json }
      get_anacan_runtime_contract_v1: { Args: never; Returns: Json }
      get_baby_crisis: {
        Args: { baby_age_weeks: number }
        Returns: {
          color: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          description_az: string | null
          description_de: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          description_hi: string | null
          description_id: string | null
          description_ja: string | null
          description_ka: string | null
          description_kk: string | null
          description_ko: string | null
          description_nl: string | null
          description_pl: string | null
          description_pt: string | null
          description_ru: string | null
          description_sv: string | null
          description_tr: string | null
          description_uz: string | null
          description_vi: string | null
          description_zh: string | null
          duration_days: number | null
          emoji: string | null
          id: string
          is_active: boolean
          leap_number: number | null
          severity: string | null
          sort_order: number
          symptoms: string[] | null
          symptoms_ar: string | null
          symptoms_az: string[] | null
          symptoms_de: string | null
          symptoms_en: string | null
          symptoms_es: string | null
          symptoms_fr: string | null
          symptoms_hi: string | null
          symptoms_id: string | null
          symptoms_ja: string | null
          symptoms_ka: string | null
          symptoms_kk: string | null
          symptoms_ko: string | null
          symptoms_nl: string | null
          symptoms_pl: string | null
          symptoms_pt: string | null
          symptoms_ru: string | null
          symptoms_sv: string | null
          symptoms_tr: string | null
          symptoms_uz: string | null
          symptoms_vi: string | null
          symptoms_zh: string | null
          tips: string[] | null
          tips_ar: string | null
          tips_az: string[] | null
          tips_de: string | null
          tips_en: string | null
          tips_es: string | null
          tips_fr: string | null
          tips_hi: string | null
          tips_id: string | null
          tips_ja: string | null
          tips_ka: string | null
          tips_kk: string | null
          tips_ko: string | null
          tips_nl: string | null
          tips_pl: string | null
          tips_pt: string | null
          tips_ru: string | null
          tips_sv: string | null
          tips_tr: string | null
          tips_uz: string | null
          tips_vi: string | null
          tips_zh: string | null
          title: string
          title_ar: string | null
          title_az: string | null
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
          title_hi: string | null
          title_id: string | null
          title_ja: string | null
          title_ka: string | null
          title_kk: string | null
          title_ko: string | null
          title_nl: string | null
          title_pl: string | null
          title_pt: string | null
          title_ru: string | null
          title_sv: string | null
          title_tr: string | null
          title_uz: string | null
          title_vi: string | null
          title_zh: string | null
          updated_at: string
          week_end: number
          week_start: number
        }[]
        SetofOptions: {
          from: "*"
          to: "baby_crisis_periods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_banner_inventory_v2: {
        Args: { p_actor: string; p_language: string; p_placement: string }
        Returns: Json
      }
      get_brand_ads_contract_v1: { Args: never; Returns: Json }
      get_brand_portal_access_v1: { Args: never; Returns: Json }
      get_chat_contract_v2: { Args: never; Returns: Json }
      get_community_ad_moderation_contract_v1: { Args: never; Returns: Json }
      get_community_connections: {
        Args: {
          p_direction: string
          p_limit?: number
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          avatar_url: string
          badge_type: string
          followed_at: string
          is_following: boolean
          is_verified: boolean
          life_stage: string
          name: string
          user_id: string
          verified_until: string
        }[]
      }
      get_community_feed: {
        Args: {
          p_author_id?: string
          p_group_id?: string
          p_limit?: number
          p_offset?: number
          p_priority_languages?: string[]
          p_search?: string
          p_view?: string
        }
        Returns: {
          ad_moderated_at: string | null
          ad_moderation_revision: number | null
          ad_moderation_state: string | null
          blog_post_id: string | null
          comments_count: number | null
          comments_locked: boolean | null
          content: string
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean | null
          is_anonymous: boolean
          is_pinned: boolean | null
          language: string | null
          likes_count: number | null
          media_urls: string[] | null
          moderation_action_id: string | null
          moderation_edited_at: string | null
          moderation_edited_by: string | null
          moderation_reason: string | null
          moderation_removed_at: string | null
          moderation_version: number | null
          tagged_group_ids: string[] | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "community_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_community_feed_v2: {
        Args: {
          p_author_id?: string
          p_group_id?: string
          p_language: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_view?: string
        }
        Returns: {
          ad_moderated_at: string | null
          ad_moderation_revision: number | null
          ad_moderation_state: string | null
          blog_post_id: string | null
          comments_count: number | null
          comments_locked: boolean | null
          content: string
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean | null
          is_anonymous: boolean
          is_pinned: boolean | null
          language: string | null
          likes_count: number | null
          media_urls: string[] | null
          moderation_action_id: string | null
          moderation_edited_at: string | null
          moderation_edited_by: string | null
          moderation_reason: string | null
          moderation_removed_at: string | null
          moderation_version: number | null
          tagged_group_ids: string[] | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "community_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_community_language_contract_v1: { Args: never; Returns: Json }
      get_community_language_inference_contract_v1: {
        Args: never
        Returns: Json
      }
      get_community_profile_stats: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_customerio_audience_contract_v1: { Args: never; Returns: Json }
      get_customerio_sync_contract_v1: { Args: never; Returns: Json }
      get_followup36_contract_v1: { Args: never; Returns: Json }
      get_followup37_contract_v1: { Args: never; Returns: Json }
      get_group_chat_contract_v3: { Args: never; Returns: Json }
      get_linked_partner_premium: { Args: never; Returns: boolean }
      get_linked_partner_user_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_localization_contract_v1: { Args: never; Returns: Json }
      get_moderator_access_v1: { Args: never; Returns: Json }
      get_moderator_contract_v1: { Args: never; Returns: Json }
      get_my_moderation_status_v1: { Args: { p_actor: string }; Returns: Json }
      get_notification_admin_status: { Args: never; Returns: Json }
      get_or_create_referral_code: { Args: never; Returns: string }
      get_premium_access_v1: { Args: { p_user_id?: string }; Returns: Json }
      get_public_app_setting: { Args: { p_key: string }; Returns: Json }
      get_public_community_profiles_v2: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          badge_type: string
          can_share_links: boolean
          created_at: string
          is_premium: boolean
          is_verified: boolean
          life_stage: string
          name: string
          user_id: string
          verified_until: string
        }[]
      }
      get_regional_catalog_contract_v1: { Args: never; Returns: Json }
      get_source_admob_configuration_v1: {
        Args: { p_expected_revision?: number }
        Returns: Json
      }
      get_source_admob_contract_v1: { Args: never; Returns: Json }
      get_source_community_worker_contract_v1: { Args: never; Returns: Json }
      get_user_linked_partner_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_banner_click: {
        Args: { p_banner_id: string }
        Returns: undefined
      }
      increment_banner_impression: {
        Args: { p_banner_id: string }
        Returns: undefined
      }
      increment_blog_view_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      increment_coupon_usage: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_same_country: {
        Args: { _author_id: string; _viewer_id: string }
        Returns: boolean
      }
      is_user_blocked: {
        Args: { _scope?: string; _user_id: string }
        Returns: boolean
      }
      issue_brand_ad_delivery_v1: {
        Args: {
          p_actor: string
          p_banner: string
          p_exposure: string
          p_language: string
          p_platform: string
        }
        Returns: Json
      }
      link_partners: {
        Args: {
          p_my_profile_id: string
          p_partner_profile_id: string
          p_partner_user_id: string
        }
        Returns: boolean
      }
      moderator_action_detail_v1: { Args: { p_id: string }; Returns: Json }
      moderator_ad_case_v1: { Args: { p_id: string }; Returns: Json }
      moderator_ad_decide_v1: {
        Args: {
          p_action: string
          p_id: string
          p_note: string
          p_reason: string
          p_request: string
          p_revision: number
          p_updated_at: string
        }
        Returns: Json
      }
      moderator_ad_queue_v1: {
        Args: {
          p_language?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_since?: string
          p_state?: string
        }
        Returns: Json
      }
      moderator_assert_v1: { Args: never; Returns: string }
      moderator_before_user_created_v1: { Args: { event: Json }; Returns: Json }
      moderator_begin_action_v1: {
        Args: {
          p_action: string
          p_args: Json
          p_detail: string
          p_kind: string
          p_note: string
          p_reason: string
          p_request: string
          p_subject: string
          p_user: string
        }
        Returns: Json
      }
      moderator_content_action_v1: {
        Args: {
          p_action: string
          p_content?: string
          p_id: string
          p_kind: string
          p_note?: string
          p_reason: string
          p_request?: string
          p_version: number
        }
        Returns: Json
      }
      moderator_content_body_v1: {
        Args: { p: Json; p_kind: string }
        Returns: Json
      }
      moderator_content_detail_v1: {
        Args: { p_id: string; p_kind: string }
        Returns: Json
      }
      moderator_content_query_v1: {
        Args: {
          p_kind: string
          p_language?: string
          p_limit?: number
          p_offset?: number
          p_removed?: boolean
          p_search?: string
          p_user?: string
        }
        Returns: Json
      }
      moderator_content_record_v1: {
        Args: { p_id: string; p_kind: string; p_lock?: boolean }
        Returns: Json
      }
      moderator_copy_v1: {
        Args: { p_key: string; p_language: string }
        Returns: string
      }
      moderator_current_role_v1: { Args: never; Returns: string }
      moderator_function_access_v1: {
        Args: { p_function: string; p_user: string }
        Returns: boolean
      }
      moderator_hash_v1: { Args: { p: Json }; Returns: string }
      moderator_ip_action_v1: {
        Args: {
          p_action: string
          p_note: string
          p_observation: string
          p_reason: string
          p_request: string
          p_rule: string
          p_seconds: number
        }
        Returns: Json
      }
      moderator_ip_rules_v1: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      moderator_ip_v1: { Args: { p_value: string }; Returns: unknown }
      moderator_notice_v1: {
        Args: {
          p_action: string
          p_kind: string
          p_subject?: string
          p_subject_kind?: string
          p_user: string
        }
        Returns: undefined
      }
      moderator_observe_ip_v1: {
        Args: {
          p_address: unknown
          p_event?: string
          p_proposed?: string
          p_source: string
          p_trusted: boolean
          p_user: string
        }
        Returns: undefined
      }
      moderator_pre_request_v1: { Args: never; Returns: undefined }
      moderator_query_v1: {
        Args: {
          p_filters?: Json
          p_limit?: number
          p_offset?: number
          p_view: string
        }
        Returns: Json
      }
      moderator_reason_valid_v1: { Args: { p: string }; Returns: boolean }
      moderator_recheck_post_v1: { Args: { p_id: string }; Returns: undefined }
      moderator_report_decide_v1: {
        Args: { p_decision: string; p_report: string; p_request: string }
        Returns: Json
      }
      moderator_retry_ad_delivery_v1: {
        Args: { p_id: string }
        Returns: boolean
      }
      moderator_role_v1: { Args: { p_user?: string }; Returns: string }
      moderator_source_writable_v1: { Args: never; Returns: boolean }
      moderator_target_v1: {
        Args: { p_sanction?: boolean; p_user: string }
        Returns: undefined
      }
      moderator_task_action_v1: {
        Args: {
          p_action: string
          p_id: string
          p_note?: string
          p_reply?: string
          p_request?: string
          p_revision: number
        }
        Returns: Json
      }
      moderator_user_action_v1: {
        Args: {
          p_action: string
          p_detail?: string
          p_options?: Json
          p_reason: string
          p_request?: string
          p_user: string
        }
        Returns: Json
      }
      moderator_user_network_v1: { Args: { p_user: string }; Returns: Json }
      my_ad_brands_v1: { Args: never; Returns: Json }
      my_community_ad_reviews_v1: {
        Args: {
          p_actor: string
          p_limit?: number
          p_offset?: number
          p_post?: string
        }
        Returns: Json
      }
      my_moderator_decisions_v1: {
        Args: { p_actor: string; p_limit?: number }
        Returns: Json
      }
      premium_grant_state_v1: { Args: { p_user_id: string }; Returns: Json }
      record_brand_ad_event_v1: {
        Args: {
          p_actor: string
          p_delivery: string
          p_event: string
          p_visible_ms?: number
        }
        Returns: boolean
      }
      record_period_days: {
        Args: {
          p_complete?: boolean
          p_daily_log?: Json
          p_dates: string[]
          p_expected_user_id: string
          p_flow?: string
          p_preserve_existing?: boolean
          p_timezone?: string
        }
        Returns: Json
      }
      redeem_referral_code: { Args: { p_code: string }; Returns: Json }
      save_story_editor: {
        Args: {
          p_background_color?: string
          p_editor_layout?: Json
          p_expected_user_id: string
          p_group_id: string
          p_media_type: string
          p_media_url: string
          p_story_id: string
          p_text_overlay?: string
        }
        Returns: string
      }
      search_share_blogs_v1: {
        Args: {
          p_ids?: string[]
          p_language: string
          p_limit?: number
          p_search?: string
        }
        Returns: {
          cover_image_url: string
          excerpt: string
          id: string
          slug: string
          title: string
        }[]
      }
      set_admin_badge_visibility_v1: {
        Args: { p_actor: string; p_target: string; p_visible: boolean }
        Returns: Json
      }
      set_community_bookmark: {
        Args: {
          p_expected_user_id: string
          p_post_id: string
          p_saved: boolean
        }
        Returns: Json
      }
      set_community_follow: {
        Args: {
          p_expected_user_id: string
          p_follow: boolean
          p_following_id: string
        }
        Returns: Json
      }
      source_community_worker_v1: {
        Args: { p_args?: Json; p_function: string }
        Returns: Json
      }
      submit_community_post_v1: {
        Args: {
          p_actor: string
          p_blog_post_id?: string
          p_content: string
          p_group_id?: string
          p_id: string
          p_is_anonymous?: boolean
          p_language: string
          p_media_urls?: string[]
          p_tagged_group_ids?: string[]
        }
        Returns: Json
      }
      submit_community_post_v2: {
        Args: {
          p_actor: string
          p_auto_language?: boolean
          p_blog_post_id?: string
          p_content: string
          p_group_id?: string
          p_id: string
          p_is_anonymous?: boolean
          p_language: string
          p_media_urls?: string[]
          p_tagged_group_ids?: string[]
        }
        Returns: Json
      }
      submit_game_score_v1: {
        Args: {
          p_expected_user_id: string
          p_game_id: string
          p_level: number
          p_score: number
          p_submission_id: string
        }
        Returns: Json
      }
      submit_moderator_appeal_v1: {
        Args: {
          p_action: string
          p_actor: string
          p_body: string
          p_id: string
        }
        Returns: Json
      }
      unlink_partners: { Args: never; Returns: undefined }
      update_my_referral_status: { Args: { p_state: string }; Returns: Json }
      verify_source_notification_cron_v2: {
        Args: { p_function: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      place_category:
        | "cafe"
        | "restaurant"
        | "park"
        | "mall"
        | "hospital"
        | "metro"
        | "pharmacy"
        | "playground"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "moderator"],
      place_category: [
        "cafe",
        "restaurant",
        "park",
        "mall",
        "hospital",
        "metro",
        "pharmacy",
        "playground",
      ],
    },
  },
} as const
