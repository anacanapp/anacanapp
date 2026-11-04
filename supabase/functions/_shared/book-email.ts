// "Your books are ready" e-mail (Customer.io transactional API, same sender setup as e-mail verification).
// Links point to book-download with the order's download token, so they keep working after the
// short-lived signed storage URLs expire. Book titles are Azerbaijani (the books are Azerbaijani).
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export async function sendBooksEmail(input: {
  userId: string | null; to: string; orderId: string; token: string; books: { id: string; title: string; cover: string }[]; functionsUrl: string;
}): Promise<boolean> {
  const key = Deno.env.get('CUSTOMERIO_APP_API_KEY');
  const from = Deno.env.get('BOOKS_EMAIL_FROM') || Deno.env.get('EMAIL_VERIFICATION_FROM');
  if (!key || !from) return false;
  const host = Deno.env.get('CUSTOMERIO_REGION') === 'us' ? 'https://api.customer.io' : 'https://api-eu.customer.io';
  const link = (bookId: string) => `${input.functionsUrl}/book-download?o=${input.orderId}&t=${encodeURIComponent(input.token)}&b=${encodeURIComponent(bookId)}`;
  const rows = input.books.map(book => `<tr><td style="padding:10px 0;border-bottom:1px solid #f1e6e2">
<table role="presentation" width="100%"><tr><td width="64"><img src="${escapeHtml(book.cover)}" width="56" style="border-radius:8px;display:block" alt=""></td>
<td style="font:600 15px Arial,sans-serif;color:#333;padding-left:12px">${escapeHtml(book.title)}</td>
<td align="right"><a href="${escapeHtml(link(book.id))}" style="display:inline-block;background:#FF5A5F;color:#fff;text-decoration:none;font:700 13px Arial,sans-serif;padding:10px 16px;border-radius:999px">PDF yüklə</a></td></tr></table></td></tr>`).join('');
  const html = `<!doctype html><html lang="az"><body style="margin:0;background:#FFF7F3;font-family:Arial,sans-serif">
<table role="presentation" width="100%" style="background:#FFF7F3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:28px">
<tr><td style="font:800 22px Arial,sans-serif;color:#333;padding-bottom:8px">Kitablarınız hazırdır 📚</td></tr>
<tr><td style="font:15px/1.55 Arial,sans-serif;color:#555;padding-bottom:16px">Alışınız üçün təşəkkür edirik! Aşağıdakı düymələrlə PDF-ləri yükləyin. Kitablar həmçinin Anacan tətbiqində <b>Kitablarım</b> bölməsindədir.</td></tr>
${rows}
<tr><td style="font:13px/1.6 Arial,sans-serif;color:#666;padding-top:18px"><b>Çap üçün:</b> A4, rəngli printer, 120–160 q/m² mat kağız, “Actual size / 100%” miqyas. Təkrar istifadə üçün səhifələri laminasiya edib marker ilə yazdıra bilərsiniz.</td></tr>
<tr><td style="font:12px Arial,sans-serif;color:#aaa;border-top:1px solid #f1e6e2;padding-top:16px;margin-top:16px">Şəxsi istifadə üçündür · Anacan · anacan.az</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Kitablarınız hazırdır\n\n${input.books.map(book => `${book.title}: ${link(book.id)}`).join('\n')}\n\nKitablar Anacan tətbiqində Kitablarım bölməsindədir.`;
  const response = await fetch(`${host}/v1/send/email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: input.to, from, subject: 'Anacan — kitablarınız hazırdır 📚', body: html, plaintext_body: text,
      identifiers: input.userId ? { id: input.userId } : { email: input.to }, send_to_unsubscribed: true, tracked: false }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) console.error('[book-email] send failed:', response.status);
  return response.ok;
}
