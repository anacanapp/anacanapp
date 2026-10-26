// Shared FCM v1 helper - generates OAuth2 token from service account
export async function getFirebaseAccessToken(serviceAccountJson: string): Promise<{ accessToken: string; projectId: string }> {
  const serviceAccount = JSON.parse(serviceAccountJson);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedToken = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedToken}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`OAuth token error: ${JSON.stringify(tokenData)}`);
  }

  return { accessToken: tokenData.access_token, projectId: serviceAccount.project_id };
}

export async function sendFCMv1(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string; unregistered?: boolean; errorCode?: string; httpStatus?: number }> {
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message: any = {
    token: deviceToken,
    notification: { title, body },
    data: data || {},
    android: {
      priority: 'HIGH',
      // Do not force a custom channel here. Older Android installs may not have
      // created `high_importance_channel`, and Android drops notifications sent
      // to a missing channel. Let FCM/app defaults choose a valid channel.
      notification: { sound: 'default' },
    },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
          // NOTE: 'content-available' və 'mutable-content' qəsdən çıxarılıb.
          // Onlar olanda iOS push-u silent/background kimi qəbul edir və
          // Notification Service Extension olmadan ekranda görünmür.
        },
      },
    },
  };

  const res = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (res.ok) {
    return { success: true, httpStatus: res.status };
  }

  const errBody = await res.json().catch(() => ({}));
  const errCode: string =
    errBody?.error?.details?.[0]?.errorCode ||
    errBody?.error?.status ||
    '';

  // Treat the token as truly dead for these specific codes.
  const PERMANENT_DEAD_CODES = new Set([
    'UNREGISTERED',
    'NOT_FOUND',
    'INVALID_REGISTRATION',
    'MISMATCH_SENDER_ID',
  ]);
  let unregistered = PERMANENT_DEAD_CODES.has(errCode);

  // INVALID_ARGUMENT is usually transient (payload issues), BUT when FCM
  // specifically flags `message.token` as invalid, the token itself is dead.
  if (!unregistered && errCode === 'INVALID_ARGUMENT') {
    const violations =
      errBody?.error?.details?.find((d: any) => Array.isArray(d?.fieldViolations))
        ?.fieldViolations ?? [];
    if (violations.some((v: any) => v?.field === 'message.token')) {
      unregistered = true;
    }
  }

  // DÜZƏLİŞ: iOS tokenləri üçün FCM çox vaxt "INVALID_ARGUMENT" ilə örtülmüş
  // bir APNs-səviyyəli ApnsError detayı qaytarır: statusCode 410 / reason
  // "Unregistered" (məs. { message: "APNs device token is disabled." }).
  // Bu, Apple-ın öz dilində "bu token bir daha işləməyəcək" siqnalıdır —
  // FCM-in birbaşa UNREGISTERED kodu ilə eyni əhəmiyyətə malikdir. Əvvəllər
  // yalnız `message.token` fieldViolations yoxlanırdı, bu APNs-spesifik hal
  // heç vaxt tutulmurdu — nəticədə ölü iOS tokenləri silinmir, hər cron
  // işində (scheduled/flow_reminder/vitamin_reminder və s.) təkrar-təkrar
  // uğursuz göndərmə cəhdi kimi qeyd olunurdu.
  if (!unregistered) {
    const apnsDetail = errBody?.error?.details?.find((d: any) =>
      typeof d?.['@type'] === 'string' && d['@type'].includes('ApnsError')
    );
    if (
      apnsDetail &&
      (apnsDetail.statusCode === 410 ||
        String(apnsDetail.reason ?? '').toLowerCase() === 'unregistered')
    ) {
      unregistered = true;
    }
  }

  const tokenSuffix = deviceToken.slice(-12);
  console.log(
    `[FCM] send failed http=${res.status} code=${errCode || 'UNKNOWN'} unregistered=${unregistered} token=...${tokenSuffix}`
  );

  return {
    success: false,
    error: JSON.stringify(errBody),
    unregistered,
    errorCode: errCode,
    httpStatus: res.status,
  };
}
