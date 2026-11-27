// Conversation between Leyla (bump-week24) and Rəşad (partner-linked).
export const LEYLA = 'b0000000-0000-4000-8000-000000000024';
export const RESHAD = 'd0000000-0000-4000-8000-000000000001';
const M = [[RESHAD, 'Sabahın xeyir, əzizim! Necə yatmısan? ☀️', '-3h', true], [LEYLA, 'Yaxşı, körpə gecə çox təpikləyirdi 😄', '-2.9h', true],
  [RESHAD, 'Axşam həkimə birlikdə gedək, 10:30-da qeydiyyat var', '-2h', true], [LEYLA, 'Əla, çox sağ ol ❤️', '-1h', false]];
export const partnerMessages = (ctx) => M.map(([sender_id, content, when, read], i) => ({
  id: `e0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, sender_id, receiver_id: sender_id === LEYLA ? RESHAD : LEYLA, content,
  message_type: 'text', is_read: read, media_path: null, media_mime: null, duration_ms: null, created_at: ctx.iso(when) })).reverse();
