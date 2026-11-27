const N = [
  ['community_like', 'Yeni bəyənmə', 'Günel paylaşımınızı bəyəndi', '-2h', false],
  ['reminder', 'Su xatırlatması', 'Bu gün 5 stəkan su içmisiniz. Davam edin!', '-5h', false],
  ['community_comment', 'Yeni şərh', 'Nərmin: "Çox faydalı məsləhətdir, təşəkkürlər!"', '-1d', true],
  ['system', 'Anacan', 'Həftəlik xülasəniz hazırdır', '-3d', true],
];
export default (ctx) => ctx.persona.user ? N.map(([type, title, message, when, read], i) => ({
  id: `77000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.persona.user.id, notification_type: type, title, message,
  is_read: read, action_type: null, action_data: null, created_at: ctx.iso(when),
})) : [];
