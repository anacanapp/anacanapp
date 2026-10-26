import { getPersistedLanguage } from '@/lib/tr';
import { tr as chatTr } from '@/lib/chat-i18n';

export const GROUP_LANGUAGES = ['az','en','tr','ru','de','ar','ka','kk','uz'] as const;
export const GROUP_LABELS: Record<string, readonly string[]> = {
  group_public_note: ['Hər kəs özü qoşula bilər.','Anyone can join.','Herkes katılabilir.','Присоединиться может каждый.','Jeder kann beitreten.','يمكن للجميع الانضمام.','შეუერთდეს ყველას შეუძლია.','Барлығы қосыла алады.','Hamma qo‘shila oladi.'],
  group_private_note: ['Yalnız qurucunun dəvəti və ya təsdiqi ilə.','Invitation or approval from the creator is required.','Kurucunun daveti veya onayı gerekir.','Нужно приглашение или одобрение создателя.','Einladung oder Zustimmung des Erstellers erforderlich.','يلزم دعوة أو موافقة منشئ المجموعة.','საჭიროა შემქმნელის მოწვევა ან თანხმობა.','Құрушының шақыруы немесе мақұлдауы қажет.','Yaratuvchining taklifi yoki tasdig‘i kerak.'],
  group_request: ['Qoşulma sorğusu','Request to join','Katılma isteği','Запросить вступление','Beitritt anfragen','طلب الانضمام','გაწევრიანების მოთხოვნა','Қосылуға өтініш','Qo‘shilish so‘rovi'],
  group_pending: ['Təsdiq gözləyir','Awaiting approval','Onay bekliyor','Ожидает одобрения','Wartet auf Zustimmung','بانتظار الموافقة','ელოდება დამტკიცებას','Мақұлдауды күтуде','Tasdiq kutilmoqda'],
  group_invites: ['Dəvətlər','Invitations','Davetler','Приглашения','Einladungen','الدعوات','მოწვევები','Шақырулар','Takliflar'],
  group_invite: ['Dəvət et','Invite','Davet et','Пригласить','Einladen','دعوة','მოწვევა','Шақыру','Taklif qilish'],
  group_accept: ['Qəbul et','Accept','Kabul et','Принять','Annehmen','قبول','მიღება','Қабылдау','Qabul qilish'],
  group_approve: ['Təsdiqlə','Approve','Onayla','Одобрить','Bestätigen','موافقة','დამტკიცება','Мақұлдау','Tasdiqlash'],
  group_reject: ['Rədd et','Decline','Reddet','Отклонить','Ablehnen','رفض','უარყოფა','Бас тарту','Rad etish'],
  group_requests: ['Qoşulma sorğuları','Join requests','Katılma istekleri','Запросы на вступление','Beitrittsanfragen','طلبات الانضمام','გაწევრიანების მოთხოვნები','Қосылу өтініштері','Qo‘shilish so‘rovlari'],
  group_owner: ['Qurucu','Creator','Kurucu','Создатель','Ersteller','المؤسس','შემქმნელი','Құрушы','Yaratuvchi'],
  group_block: ['Qrupdan blokla','Ban from group','Gruptan engelle','Заблокировать в группе','In Gruppe sperren','حظر من المجموعة','ჯგუფში დაბლოკვა','Топта бұғаттау','Guruhdan bloklash'],
  group_unblock: ['Bloku aç','Unban','Engeli kaldır','Разблокировать','Entsperren','إلغاء الحظر','განბლოკვა','Бұғаттан шығару','Blokdan chiqarish'],
  group_blocked: ['Bu qrupdan bloklanmısınız.','You are banned from this group.','Bu gruptan engellendiniz.','Вы заблокированы в этой группе.','Du bist in dieser Gruppe gesperrt.','أنت محظور من هذه المجموعة.','ამ ჯგუფში დაბლოკილი ხართ.','Сіз осы топта бұғатталғансыз.','Siz bu guruhdan bloklangansiz.'],
  group_bans: ['Bloklananlar','Banned members','Engellenenler','Заблокированные','Gesperrte Mitglieder','المحظورون','დაბლოკილები','Бұғатталғандар','Bloklanganlar'],
  group_settings: ['Qrup ayarları','Group settings','Grup ayarları','Настройки группы','Gruppeneinstellungen','إعدادات المجموعة','ჯგუფის პარამეტრები','Топ баптаулары','Guruh sozlamalari'],
  group_description: ['Haqqında','Description','Açıklama','Описание','Beschreibung','الوصف','აღწერა','Сипаттама','Tavsif'],
  group_admins_only: ['Yalnız idarəçilər mesaj yaza bilər','Only admins can send messages','Yalnızca yöneticiler mesaj yazabilir','Писать могут только администраторы','Nur Admins dürfen schreiben','يمكن للمشرفين فقط إرسال الرسائل','წერა მხოლოდ ადმინისტრატორებს შეუძლიათ','Тек әкімшілер жаза алады','Faqat administratorlar yozishi mumkin'],
  group_delete: ['Qrupu sil','Delete group','Grubu sil','Удалить группу','Gruppe löschen','حذف المجموعة','ჯგუფის წაშლა','Топты жою','Guruhni o‘chirish'],
  group_delete_confirm: ['Qrupu bütün üzvlər üçün bağlamaq istəyirsiniz?','Close this group for all members?','Grup herkes için kapatılsın mı?','Закрыть группу для всех участников?','Gruppe für alle schließen?','إغلاق المجموعة لجميع الأعضاء؟','დაიხუროს ჯგუფი ყველასთვის?','Топ барлық мүшелер үшін жабылсын ба?','Guruh barcha uchun yopilsinmi?'],
  group_delete_message: ['Mesajı hamı üçün sil','Delete for everyone','Herkesten sil','Удалить у всех','Für alle löschen','حذف لدى الجميع','ყველასთვის წაშლა','Барлығы үшін жою','Hamma uchun o‘chirish'],
  group_demote: ['İdarəçiliyi götür','Remove admin role','Yöneticiliği kaldır','Снять администратора','Adminrolle entfernen','إزالة صلاحية المشرف','ადმინისტრატორის მოხსნა','Әкімшілікті алу','Administratorlikni olib tashlash'],
  group_transfer: ['Sahibliyi ötür','Transfer ownership','Sahipliği devret','Передать владение','Eigentum übertragen','نقل الملكية','მფლობელობის გადაცემა','Иелікті беру','Egalikni topshirish'],
  group_tag: ['Qrup etiketlə','Tag a group','Grup etiketle','Отметить группу','Gruppe markieren','الإشارة إلى مجموعة','ჯგუფის მონიშვნა','Топты белгілеу','Guruhni belgilash'],
  group_tag_note: ['Öz yaratdığınız qruplardan ən çox 3-nü seçin.','Select up to 3 groups you created.','Oluşturduğunuz en fazla 3 grubu seçin.','Выберите до 3 созданных вами групп.','Wähle bis zu 3 eigene Gruppen.','اختر حتى 3 مجموعات أنشأتها.','აირჩიეთ თქვენ მიერ შექმნილი 3-მდე ჯგუფი.','Өзіңіз құрған 3 топқа дейін таңдаңыз.','O‘zingiz yaratgan 3 tagacha guruhni tanlang.'],
  group_invited_note: ['Qrupun qurucusu sizi dəvət edib.','The creator invited you.','Grup kurucusu sizi davet etti.','Вас пригласил создатель группы.','Der Ersteller hat dich eingeladen.','دعاك منشئ المجموعة.','შემქმნელმა მოგიწვიათ.','Топ құрушысы сізді шақырды.','Guruh yaratuvchisi sizni taklif qildi.'],
  group_no_people: ['Hələ heç kim yoxdur','No one here yet','Henüz kimse yok','Пока никого нет','Noch niemand hier','لا يوجد أحد بعد','ჯერ არავინ არის','Әзірге ешкім жоқ','Hali hech kim yo‘q'],
  group_public: ['Açıq','Public','Açık','Открытая','Öffentlich','عامة','ღია','Ашық','Ochiq'],
  group_private: ['Özəl','Private','Özel','Закрытая','Privat','خاصة','დახურული','Жеке','Yopiq'],
  group_administrator: ['İdarəçi','Administrator','Yönetici','Администратор','Administrator','مشرف','ადმინისტრატორი','Әкімші','Administrator'],
  group_make_administrator: ['İdarəçi et','Make administrator','Yönetici yap','Назначить администратором','Zum Administrator machen','تعيين مشرف','ადმინისტრატორად დანიშვნა','Әкімші ету','Administrator qilish'],
  community_moderator_label: ['Moderator','Moderator','Moderatör','Модератор','Moderator','مراقب','მოდერატორი','Модератор','Moderator'],
  common_all: ['Hamısı','All','Tümü','Все','Alle','الكل','ყველა','Барлығы','Barchasi'],
  common_saxla: ['Saxla','Save','Kaydet','Сохранить','Speichern','حفظ','შენახვა','Сақтау','Saqlash'],
  common_legv_et: ['Ləğv et','Cancel','Vazgeç','Отмена','Abbrechen','إلغاء','გაუქმება','Бас тарту','Bekor qilish'],
  story_like: ['Bəyən','Like','Beğen','Нравится','Gefällt mir','إعجاب','მოწონება','Ұнату','Yoqtirish'],
  story_unlike: ['Bəyənməni geri götür','Unlike','Beğeniyi kaldır','Убрать отметку','Gefällt mir entfernen','إلغاء الإعجاب','მოწონების გაუქმება','Ұнатуды жою','Yoqtirishni bekor qilish'],
  storyviewer_resume: ['Davam et','Resume','Devam et','Продолжить','Fortsetzen','متابعة','გაგრძელება','Жалғастыру','Davom etish'],
  storyviewer_pause: ['Dayandır','Pause','Duraklat','Пауза','Pausieren','إيقاف مؤقت','შეჩერება','Кідірту','To‘xtatish'],
  storyviewer_sesi_ac: ['Səsi aç','Unmute','Sesi aç','Включить звук','Ton einschalten','تشغيل الصوت','ხმის ჩართვა','Дыбысты қосу','Ovozni yoqish'],
  storyviewer_sesi_bagla: ['Səsi bağla','Mute','Sesi kapat','Выключить звук','Ton ausschalten','كتم الصوت','ხმის გამორთვა','Дыбысты өшіру','Ovozni o‘chirish'],
  stories_story_sil: ['Story-ni sil','Delete story','Hikâyeyi sil','Удалить историю','Story löschen','حذف القصة','ისტორიის წაშლა','Стористі жою','Hikoyani o‘chirish'],
};
export function tr(key: string, fallback = key) {
  let language = 'az'; try { language = getPersistedLanguage(); } catch { /* bootstrap */ }
  return chatTr(key, GROUP_LABELS[key]?.[Math.max(0, GROUP_LANGUAGES.indexOf(language as typeof GROUP_LANGUAGES[number]))] ?? fallback);
}
