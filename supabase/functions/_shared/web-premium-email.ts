// E-mails of the anacan.az web subscriptions (Customer.io transactional API, same sender setup as the book e-mail).
// Optional: without CUSTOMERIO_APP_API_KEY and a sender nothing is sent. Never logs addresses or card data.
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export type WebPremiumEmail = 'receipt' | 'renewal_failed' | 'expired' | 'cancelled';

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} ₼`;
const day = (iso: string | null | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('az-AZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baku' }).format(date) : '';
};

export function webPremiumEmailCopy(kind: WebPremiumEmail, input: { plan: 'monthly' | 'yearly'; amount: number; periodEnd?: string | null }) {
  const plan = input.plan === 'yearly' ? 'illik' : 'aylıq';
  const end = day(input.periodEnd);
  switch (kind) {
    case 'receipt': return { subject: 'Anacan Premium — ödəniş qəbul olundu', heading: 'Təşəkkür edirik! Premium aktivdir',
      body: `${money(input.amount)} ödəniş qəbul olundu (${plan} plan).${end ? ` Növbəti ödəniş ${end} tarixindən bir gün əvvəl avtomatik alınacaq.` : ''} Abunəliyi istədiyin vaxt ləğv edə bilərsən.` };
    case 'renewal_failed': return { subject: 'Anacan Premium — ödəniş alınmadı', heading: 'Abunəlik ödənişi alınmadı',
      body: `${money(input.amount)} kartından çıxıla bilmədi. 24 saat sonra yenidən cəhd edəcəyik. Kartını "Premium hesabım" səhifəsində yeniləyə bilərsən.` };
    case 'expired': return { subject: 'Anacan Premium — abunəlik dayandı', heading: 'Abunəlik dayandırıldı',
      body: `Üç cəhddən sonra ödəniş alınmadı və abunəlik dayandı.${end ? ` Premium ${end} tarixinə qədər açıq qalır.` : ''} Yenidən abunə olmaq üçün anacan.az saytına daxil ol.` };
    case 'cancelled': return { subject: 'Anacan Premium — abunəlik ləğv edildi', heading: 'Abunəlik ləğv edildi',
      body: `Yeni ödəniş alınmayacaq.${end ? ` Premium ${end} tarixinə qədər açıq qalır.` : ''} Fikrini dəyişsən, bu tarixə qədər "Premium hesabım" səhifəsində bərpa edə bilərsən.` };
  }
}

export async function sendWebPremiumEmail(kind: WebPremiumEmail, input: {
  userId: string; to: string | null | undefined; plan: 'monthly' | 'yearly'; amount: number; periodEnd?: string | null;
}): Promise<boolean> {
  const key = Deno.env.get('CUSTOMERIO_APP_API_KEY');
  const from = Deno.env.get('WEB_PREMIUM_EMAIL_FROM') || Deno.env.get('BOOKS_EMAIL_FROM') || Deno.env.get('EMAIL_VERIFICATION_FROM');
  if (!key || !from || !input.to || input.to.endsWith('@users.anacan.az')) return false;
  const copy = webPremiumEmailCopy(kind, input);
  const cabinet = 'https://anacan.az/website/premium/hesab/index.html';
  const html = `<!doctype html><html lang="az"><body style="margin:0;background:#FFF7F3;font-family:Arial,sans-serif">
<table role="presentation" width="100%" style="background:#FFF7F3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:500px;background:#fff;border-radius:20px;padding:28px">
<tr><td style="font:800 20px Arial,sans-serif;color:#FF5A5F;padding-bottom:14px">Anacan</td></tr>
<tr><td style="font:800 20px Arial,sans-serif;color:#333;padding-bottom:8px">${escapeHtml(copy.heading)}</td></tr>
<tr><td style="font:15px/1.55 Arial,sans-serif;color:#555;padding-bottom:20px">${escapeHtml(copy.body)}</td></tr>
<tr><td><a href="${cabinet}" style="display:inline-block;background:#FF5A5F;color:#fff;text-decoration:none;font:700 14px Arial,sans-serif;padding:12px 20px;border-radius:999px">Premium hesabım</a></td></tr>
<tr><td style="font:12px Arial,sans-serif;color:#aaa;border-top:1px solid #f1e6e2;padding-top:16px;margin-top:16px">Anacan · anacan.az</td></tr>
</table></td></tr></table></body></html>`;
  try {
    const host = Deno.env.get('CUSTOMERIO_REGION') === 'us' ? 'https://api.customer.io' : 'https://api-eu.customer.io';
    const response = await fetch(`${host}/v1/send/email`, {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: input.to, from, subject: copy.subject, body: html, plaintext_body: `${copy.heading}\n\n${copy.body}\n\n${cabinet}`,
        identifiers: { id: input.userId }, send_to_unsubscribed: true, tracked: false }),
    });
    if (!response.ok) console.error('[web-premium-email] send failed:', response.status);
    return response.ok;
  } catch {
    console.error('[web-premium-email] send failed: network');
    return false;
  }
}
