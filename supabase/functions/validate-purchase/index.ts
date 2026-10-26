import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseValidationRequest {
  transactionId: string;
  productId: string;
  receipt?: string;
  purchaseToken?: string;
  packageName?: string;
  platform: 'ios' | 'android';
}

// Validate iOS receipt with Apple's verifyReceipt endpoint
async function validateAppleReceipt(receipt: string): Promise<{ isValid: boolean; details: any }> {
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
  if (!sharedSecret) {
    return { isValid: false, details: { error: 'APPLE_SHARED_SECRET not configured' } };
  }

  // Try production first
  let resp = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
    method: 'POST',
    body: JSON.stringify({ 'receipt-data': receipt, password: sharedSecret, 'exclude-old-transactions': true }),
  });
  let data = await resp.json();

  // Status 21007 means receipt is from sandbox - retry against sandbox endpoint
  if (data.status === 21007) {
    resp = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      body: JSON.stringify({ 'receipt-data': receipt, password: sharedSecret, 'exclude-old-transactions': true }),
    });
    data = await resp.json();
  }

  return { isValid: data.status === 0, details: { status: data.status, environment: data.environment } };
}

// Validate Android purchase with Google Play Developer API
async function validateGooglePurchase(packageName: string, productId: string, purchaseToken: string): Promise<{ isValid: boolean; details: any }> {
  const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    return { isValid: false, details: { error: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured' } };
  }

  try {
    const sa = JSON.parse(serviceAccountJson);
    // Build JWT for Google OAuth2
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const enc = (o: any) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsigned = `${enc(header)}.${enc(claim)}`;

    // Import RSA private key (PKCS8)
    const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
    const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${unsigned}.${sig}`;

    // Exchange JWT for access token
    const tokRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const tokData = await tokRes.json();
    if (!tokData.access_token) {
      return { isValid: false, details: { error: 'Failed to obtain Google access token' } };
    }

    // Try subscription first, fall back to product
    let purchaseRes = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
      { headers: { Authorization: `Bearer ${tokData.access_token}` } }
    );
    let purchaseData = await purchaseRes.json();

    if (purchaseRes.status === 404 || purchaseData.error) {
      purchaseRes = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`,
        { headers: { Authorization: `Bearer ${tokData.access_token}` } }
      );
      purchaseData = await purchaseRes.json();
    }

    if (purchaseData.error) {
      return { isValid: false, details: { error: purchaseData.error.message } };
    }

    // purchaseState 0 = Purchased; for subscriptions, expiryTimeMillis in the future
    const isValid =
      purchaseData.purchaseState === 0 ||
      (purchaseData.expiryTimeMillis && parseInt(purchaseData.expiryTimeMillis) > Date.now());

    return { isValid: !!isValid, details: { purchaseState: purchaseData.purchaseState, expiryTimeMillis: purchaseData.expiryTimeMillis } };
  } catch (e) {
    return { isValid: false, details: { error: (e as Error).message } };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PurchaseValidationRequest = await req.json();
    const { transactionId, productId, receipt, purchaseToken, packageName, platform } = body;

    if (!transactionId || !productId || !platform) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let isValid = false;
    let validationDetails: any = {};

    if (platform === 'ios') {
      if (!receipt) {
        return new Response(JSON.stringify({ success: false, error: "Missing receipt for iOS" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await validateAppleReceipt(receipt);
      isValid = result.isValid;
      validationDetails = { method: 'ios_receipt', ...result.details };
    } else if (platform === 'android') {
      if (!purchaseToken || !packageName) {
        return new Response(JSON.stringify({ success: false, error: "Missing purchaseToken or packageName for Android" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await validateGooglePurchase(packageName, productId, purchaseToken);
      isValid = result.isValid;
      validationDetails = { method: 'android_token', ...result.details };
    } else {
      return new Response(JSON.stringify({ success: false, error: "Invalid platform" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Purchase validation for user ${user.id}: isValid=${isValid}`);

    // Audit
    await supabaseClient
      .from('usage_tracking')
      .insert({
        user_id: user.id,
        feature_type: 'iap_validation',
        usage_count: 1,
        usage_seconds: 0,
      });

    return new Response(
      JSON.stringify({
        success: true,
        isValid,
        message: isValid ? 'Purchase validated' : 'Purchase validation failed',
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
