import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create client with user's token to get their ID
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    // Use service role to delete user data and auth account
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Delete user data from all tables (cascade should handle most)
    const tables = [
      'ai_chat_messages',
      'appointments',
      'baby_growth',
      'baby_logs',
      'baby_milestones',
      'baby_photos',
      'blood_sugar_logs',
      'blog_comment_likes',
      'blog_comments',
      'blog_post_likes',
      'blog_post_saves',
      'cake_orders',
      'cart_items',
      'comment_likes',
      'community_posts',
      'community_stories',
      'contractions',
      'cry_analyses',
      'cycle_history',
      'daily_logs',
      'daily_summaries',
      'kick_sessions',
      'notification_history',
      'post_comments',
      'post_likes',
      'user_children',
      'user_preferences',
      'user_roles',
      'weight_entries',
      'device_tokens',
      'app_rating_prompts',
      'profiles',
    ]

    for (const table of tables) {
      try {
        await adminClient.from(table).delete().eq('user_id', userId)
      } catch (e) {
        console.log(`Skipping table ${table}:`, e)
      }
    }

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Delete account error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})