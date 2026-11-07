import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { createInteractionPushHandler } from '../_shared/interaction-push.ts';

Deno.serve(createInteractionPushHandler({
  requireUser,
  serviceClient: () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
  env: (name) => Deno.env.get(name),
}));
