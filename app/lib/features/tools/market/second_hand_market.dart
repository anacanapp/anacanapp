// Ported from: src/components/tools/SecondHandMarket.tsx
//
// İkinci Əl Bazarı: active listings (all / mine), search, category filter, create listing (up to 5 images to the
// community-media bucket, status 'pending'), listing detail, contacting the seller, the inbox of both sides
// (market_inbox.dart) and the safety tools (report / block, market_safety.dart). React keeps every dialog in the
// component state; here each dialog is a route whose content rebuilds from this screen's state ([_tick]).
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../core/offline/offline_providers.dart' show appResumeEventsProvider;
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show jsNumberToString, jsParseDate;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../settings/ui/settings_ui.dart' show ALoader, FadeRise, px, toasts;
import '../baby_album/image_compress.dart' show UploadFile;
import '../health_common/health_ui.dart' show AField, AGridCols, APillButton, APillKind, APulse, ARankTagBox, ASearchField, ATextArea;
import '../kit/kit.dart';
import '../more_common/more_ui.dart';
import 'market_db.dart';
import 'market_inbox.dart';
import 'market_inbox_view.dart';
import 'market_safety.dart';
import 'market_safety_dialogs.dart';
import 'market_thread.dart';
import 'use_market_inbox.dart';

/// A `marketplace_listings` row.
typedef MarketListing = Map<String, dynamic>;

/// Categories → anacan palette (`grad`, `ink`). 'Geyim' / 'Oyuncaqlar' are plain literals in the React array (no tr).
class _Category {
  const _Category(this.id, this.label, this.emoji);
  final String id;
  final String label;
  final String emoji;
}

List<_Category> _categories() => [
      // SecondHandMarket.tsx keeps these two labels as untranslated literals.
      const _Category('clothing', 'Geyim', '👕'),
      const _Category('toys', 'Oyuncaqlar', '🧸'),
      _Category('furniture', tr('secondhandmarket_mebel_3c7a2d', 'Mebel'), '🛏️'),
      _Category('stroller', tr('secondhandmarket_araba_3c7a2d', 'Araba'), '👶'),
      _Category('feeding', tr('secondhandmarket_qidalanma_3c7a2d', 'Qidalanma'), '🍼'),
      _Category('hygiene', tr('secondhandmarket_gigiyena_3c7a2d', 'Gigiyena'), '🛁'),
      _Category('other', tr('secondhandmarket_diger_293b3a', 'Digər'), '📦'),
    ];

(Gradient, Color) _categoryLook(ATokens a, String id) => switch (id) {
      'clothing' => (a.gradPink, a.alertInk),
      'toys' => (a.gradYellow, a.warnInk),
      'furniture' => (a.gradPeach, a.accentInk),
      'stroller' => (a.gradLav, a.lavInk),
      'feeding' => (a.gradGreen, a.greenInk),
      'hygiene' => (a.gradBlue, a.blueInk),
      _ => (LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a.surfaceSoft, a.lineStrong]), a.inkSoft),
    };

class _Condition {
  const _Condition(this.id, this.label);
  final String id;
  final String label;
}

List<_Condition> _conditions() => [
      _Condition('new', tr('secondhandmarket_yeni', 'Yeni')),
      _Condition('like_new', tr('secondhandmarket_yeni_kimi', 'Yeni kimi')),
      _Condition('good', tr('secondhandmarket_yaxsi_9d8595', 'Yaxşı')),
      _Condition('fair', tr('common_normal', 'Normal')),
    ];

/// (dot, ink, soft).
(Color, Color, Color) _conditionLook(ATokens a, String id) => switch (id) {
      'new' => (a.green2, a.greenInk, a.green1),
      // `dot: '#8fd19e'` (SecondHandMarket.tsx literal)
      'like_new' => (const Color(0xFF8FD19E), a.greenInk, a.green1),
      'fair' => (a.yellow2, a.warnInk, a.yellow1),
      _ => (a.blue2, a.blueInk, a.blue1),
    };

List<String> _ageRanges() => [
      tr('secondhandmarket_0_3_ay_3c7a2d', '0-3 ay'),
      tr('secondhandmarket_3_6_ay_3c7a2d', '3-6 ay'),
      tr('secondhandmarket_6_12_ay_3c7a2d', '6-12 ay'),
      tr('secondhandmarket_1_2_yas_aa6324', '1-2 yaş'),
      tr('secondhandmarket_2_3_yas_d49317', '2-3 yaş'),
      tr('secondhandmarket_3_yas_dec51d', '3+ yaş'),
    ];

String _price(Object? price) => price is num ? jsNumberToString(price) : '${price ?? 0}';

class _Form {
  String title = '';
  String description = '';
  String category = 'clothing';
  String condition = 'good';
  num price = 0;
  bool isFree = true;
  String ageRange = '';
  String locationCity = '';
}

class SecondHandMarket extends ConsumerStatefulWidget {
  const SecondHandMarket({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<SecondHandMarket> createState() => _SecondHandMarketState();
}

class _SecondHandMarketState extends ConsumerState<SecondHandMarket> {
  /// Bumped on every state change so open dialogs rebuild.
  final ValueNotifier<int> _tick = ValueNotifier<int>(0);
  ModalRoute<Object?>? _pageRoute;

  List<MarketListing> _listings = [];
  bool _isLoading = true;
  final TextEditingController _search = TextEditingController();
  String? _selectedCategory;
  bool _showMyListings = false;

  MarketListing? _contactListing;
  List<Map<String, dynamic>> _contactMessages = [];
  final TextEditingController _contactText = TextEditingController();
  bool _sendingMessage = false;

  bool _uploadingImages = false;
  List<String> _uploadedImages = [];
  _Form _form = _Form();
  bool _isSubmitting = false;

  Set<String> _blocked = {};
  Map<String, String> _blockedNames = {};

  bool _showInbox = false;
  MarketConversation? _openConv;
  final TextEditingController _threadText = TextEditingController();
  bool _threadSending = false;
  late MarketInboxController _inbox;
  String? _inboxUser;
  int _loadSeq = 0;

  MarketDb get _db => ref.read(marketDbProvider);
  String? get _myId {
    final id = ref.read(authProfileProvider)?.userId;
    return id == null || id.isEmpty ? null : id;
  }

  void _update(VoidCallback fn) {
    if (!mounted) return;
    setState(fn);
    _tick.value++;
  }

  @override
  void initState() {
    super.initState();
    _createInbox(_myId);
    _search.addListener(() => _update(() {}));
    unawaited(_loadBlocks());
    unawaited(_loadListings());
  }

  void _createInbox(String? myId) {
    _inboxUser = myId;
    _inbox = MarketInboxController(
      db: _db,
      myId: myId,
      storage: LocalMarketStorage(ref.read(localStoreProvider)),
      loadNames: ref.read(marketProfileNamesProvider),
      resumes: ref.read(appResumeEventsProvider),
    )..addListener(_onInbox);
  }

  void _onInbox() {
    _update(() {});
    _markOpenThreadRead();
  }

  @override
  void dispose() {
    _inbox
      ..removeListener(_onInbox)
      ..dispose();
    _tick.dispose();
    _search.dispose();
    _contactText.dispose();
    _threadText.dispose();
    super.dispose();
  }

  List<MarketMessage> get _openThread {
    final conv = _openConv;
    final me = _myId;
    if (conv == null || me == null) return const [];
    return threadMessages(_inbox.messages, conv.listingId, conv.counterpartId, me, _blocked);
  }

  // Opening a thread (and every new incoming message while it is open) marks it read.
  void _markOpenThreadRead() {
    final conv = _openConv;
    if (conv == null) return;
    final thread = _openThread;
    if (thread.isEmpty) return;
    final hasUnread = thread.any((m) => m.senderId == conv.counterpartId && m.isRead != true);
    if (hasUnread) _inbox.markRead(conv.listingId, conv.counterpartId, thread.last.createdAt);
  }

  Future<void> _loadBlocks() async {
    final set = await loadMarketBlocks(_db, _myId);
    _update(() => _blocked = set);
  }

  Future<void> _loadBlockedNames() async {
    if (!_showMyListings || _blocked.isEmpty) return;
    try {
      final names = await ref.read(marketProfileNamesProvider)(_blocked.toList());
      _update(() => _blockedNames = names);
    } catch (_) {}
  }

  Future<void> _loadListings() async {
    final run = ++_loadSeq;
    _update(() => _isLoading = true);
    try {
      final me = _myId;
      final r = await _db.select(MarketQuery(
        'marketplace_listings',
        filters: [
          eqF('status', 'active'),
          if (_selectedCategory != null) eqF('category', _selectedCategory),
          if (_showMyListings && me != null) eqF('user_id', me),
        ],
        order: (column: 'created_at', ascending: false),
      ));
      if (r.error != null) throw r.error!;
      if (run != _loadSeq) return;
      final data = r.data;
      _update(() => _listings = data is List ? [for (final l in data) if (l is Map) l.cast<String, dynamic>()] : []);
    } catch (_) {
      if (mounted) {
        toasts(context).show(title: tr('secondhandmarket_xeta_3cdbb6', 'Xəta'), description: tr('secondhandmarket_elanlar_yuklene_bilmedi_3af806', 'Elanlar yüklənə bilmədi'), destructive: true);
      }
    } finally {
      if (run == _loadSeq) _update(() => _isLoading = false);
    }
  }

  void _error(String description) =>
      toasts(context).show(title: tr('secondhandmarket_xeta_3cdbb6', 'Xəta'), description: description, destructive: true);

  // ── safety ──

  Future<void> _openReport(MarketReportTarget target, String? listingId, String? userId) => showMarketReportDialog(
        context,
        target: target,
        onSubmit: (reason, note) async {
          final me = _myId;
          if (me == null) return false;
          final outcome = await submitMarketReport(_db, me, MarketReportInput(target: target, listingId: listingId, reportedUserId: userId, reason: reason, note: note));
          if (!mounted) return false;
          if (outcome == 'sent' || outcome == 'duplicate') {
            toasts(context).show(
              title: outcome == 'sent'
                  ? tr('market_report_sent', 'Şikayətiniz göndərildi. Moderatorlar baxacaq.')
                  : tr('market_report_duplicate', 'Bu barədə şikayətiniz artıq qəbul edilib.'),
            );
            return true;
          }
          _error(tr('market_report_failed', 'Şikayət göndərilmədi. Yenidən cəhd edin.'));
          return false;
        },
      );

  Future<void> _openBlock(String blockedId) => showMarketBlockDialog(
        context,
        onConfirm: () async {
          final me = _myId;
          if (me == null) return false;
          final ok = await blockMarketUser(_db, me, blockedId);
          if (!mounted) return false;
          if (!ok) {
            _error(tr('market_block_failed', 'Bloklamaq alınmadı. Yenidən cəhd edin.'));
            return false;
          }
          _update(() {
            _blocked = {..._blocked, blockedId};
            _openConv = null;
            _contactListing = null;
          });
          // Closes the block dialog together with the contact / detail / conversation dialogs under it.
          final page = _pageRoute;
          if (page != null) Navigator.of(context).popUntil((r) => r == page);
          toasts(context).show(title: tr('market_blocked_done', 'İstifadəçi bloklandı'));
          return false;
        },
      );

  Future<void> _unblock(String id) async {
    final me = _myId;
    if (me == null) return;
    if (await unblockMarketUser(_db, me, id)) _update(() => _blocked = {..._blocked}..remove(id));
  }

  // ── create ──

  Future<void> _pickImages() async {
    final user = ref.read(authUserProvider);
    if (user == null || _uploadingImages) return;
    final files = await ref.read(marketImagePickerProvider)();
    if (files.isEmpty) return;
    _update(() => _uploadingImages = true);
    final newImages = <String>[];
    try {
      final now = ref.read(marketNowProvider);
      final count = files.length < 5 - _uploadedImages.length ? files.length : 5 - _uploadedImages.length;
      for (var i = 0; i < count; i++) {
        final UploadFile file = files[i];
        final ext = file.name.split('.').last;
        final fileName = '${user.id}/${now()}-$i.$ext';
        final error = await _db.upload('community-media', fileName, file.bytes, file.type);
        if (error != null) throw error;
        newImages.add(_db.publicUrl('community-media', fileName));
      }
      _update(() => _uploadedImages = [..._uploadedImages, ...newImages]);
      if (mounted) toasts(context).show(title: tr('secondhandmarket_sekiller_yuklendi_5f1633', 'Şəkillər yükləndi!'));
    } catch (_) {
      if (mounted) _error(tr('secondhandmarket_sekil_yuklene_bilmedi_3c275f', 'Şəkil yüklənə bilmədi'));
    } finally {
      _update(() => _uploadingImages = false);
    }
  }

  void _resetForm() => _update(() {
        _form = _Form();
        _uploadedImages = [];
      });

  Future<void> _createListing(BuildContext dialogContext) async {
    final me = _myId;
    if (me == null) {
      _error(tr('secondhandmarket_elan_yaratmaq_ucun_daxil_olun_264bf1', 'Elan yaratmaq üçün daxil olun'));
      return;
    }
    if (_form.title.trim().isEmpty) {
      _error(tr('secondhandmarket_basliq_daxil_edin_edf2fd', 'Başlıq daxil edin'));
      return;
    }
    _update(() => _isSubmitting = true);
    try {
      final r = await _db.insert('marketplace_listings', {
        'user_id': me,
        'title': _form.title,
        'description': _form.description,
        'category': _form.category,
        'condition': _form.condition,
        // `Number('abc')` is NaN, which JSON.stringify sends as null.
        'price': _form.isFree ? 0 : (_form.price.isNaN ? null : _form.price),
        'is_free': _form.isFree,
        'age_range': _form.ageRange,
        'location_city': _form.locationCity,
        'images': _uploadedImages,
        'status': 'pending',
      });
      if (r.error != null) throw r.error!;
      if (!mounted) return;
      toasts(context).show(title: tr('secondhandmarket_ugurlu_5c0191', 'Uğurlu!'), description: tr('secondhandmarket_elan_yaradildi_ve_tesdiq_ucun_gonderildi_2869bb', 'Elan yaradıldı və təsdiq üçün göndərildi'));
      if (dialogContext.mounted) Navigator.of(dialogContext).pop();
      unawaited(_loadListings());
    } catch (_) {
      if (mounted) _error(tr('secondhandmarket_elan_yaradila_bilmedi_9b2414', 'Elan yaradıla bilmədi'));
    } finally {
      _update(() => _isSubmitting = false);
    }
  }

  // ── contact / thread ──

  Future<void> _loadContactMessages(MarketListing listing) async {
    final me = _myId;
    if (me == null) return;
    List<Map<String, dynamic>> rows = [];
    try {
      final r = await _db.select(MarketQuery(
        'marketplace_messages',
        filters: [eqF('listing_id', listing['id'])],
        or: 'sender_id.eq.$me,receiver_id.eq.$me',
        order: (column: 'created_at', ascending: true),
      ));
      final data = r.data;
      rows = data is List ? [for (final m in data) if (m is Map) m.cast<String, dynamic>()] : [];
    } catch (_) {}
    _update(() => _contactMessages = rows);
    final lastFromSeller = rows.reversed.where((m) => m['sender_id'] == listing['user_id'] && m['receiver_id'] == me).firstOrNull;
    if (lastFromSeller != null) _inbox.markRead('${listing['id']}', '${listing['user_id']}', '${lastFromSeller['created_at']}');
  }

  Future<void> _sendContact() async {
    final listing = _contactListing;
    final me = _myId;
    final text = _contactText.text.trim();
    if (text.isEmpty || listing == null || me == null) return;
    _update(() => _sendingMessage = true);
    try {
      final r = await _db.insert('marketplace_messages', {'listing_id': listing['id'], 'sender_id': me, 'receiver_id': listing['user_id'], 'content': text});
      if (r.error != null) {
        if (isMarketBlockedError(r.error)) {
          if (mounted) toasts(context).show(title: tr('market_message_blocked', 'Bu istifadəçiyə mesaj göndərmək mümkün deyil.'), destructive: true);
          return;
        }
        throw r.error!;
      }
      _contactText.clear();
      await _loadContactMessages(listing);
      unawaited(_inbox.refresh());
    } catch (_) {
      if (mounted) _error(tr('secondhandmarket_mesaj_gonderile_bilmedi_0cd095', 'Mesaj göndərilə bilmədi'));
    } finally {
      _update(() => _sendingMessage = false);
    }
  }

  Future<void> _sendThread() async {
    final conv = _openConv;
    final me = _myId;
    final text = _threadText.text.trim();
    if (text.isEmpty || conv == null || me == null || _threadSending) return;
    _update(() => _threadSending = true);
    try {
      final r = await _db.insert('marketplace_messages', {'listing_id': conv.listingId, 'sender_id': me, 'receiver_id': conv.counterpartId, 'content': text});
      if (r.error != null) {
        if (isMarketBlockedError(r.error)) {
          if (mounted) toasts(context).show(title: tr('market_message_blocked', 'Bu istifadəçiyə mesaj göndərmək mümkün deyil.'), destructive: true);
          return;
        }
        throw r.error!;
      }
      _threadText.clear();
      await _inbox.refresh();
    } catch (_) {
      if (mounted) _error(tr('secondhandmarket_mesaj_gonderile_bilmedi_0cd095', 'Mesaj göndərilə bilmədi'));
    } finally {
      _update(() => _threadSending = false);
    }
  }

  // ── dialogs ──

  Widget _live(Widget Function(BuildContext context) build) => ValueListenableBuilder<int>(valueListenable: _tick, builder: (context, _, _) => build(context));

  Future<void> _showCreate() async {
    await showMoreDialog<void>(context, key: const ValueKey('market-create'), builder: (_) => _live(_createContent));
    _resetForm();
  }

  Future<void> _showDetail(MarketListing listing) async {
    final contact = await showMoreDialog<bool>(context, padded: false, builder: (_) => _live((c) => _detailContent(c, listing)));
    if (contact == true && mounted) await _showContact(listing);
  }

  Future<void> _showContact(MarketListing listing) async {
    _update(() {
      _contactListing = listing;
      _contactMessages = [];
    });
    unawaited(_loadContactMessages(listing));
    await showMoreDialog<void>(context, builder: (_) => _live(_contactContent));
    _update(() => _contactListing = null);
  }

  Future<void> _showThread(MarketConversation conv) async {
    _threadText.clear();
    _update(() => _openConv = conv);
    _markOpenThreadRead();
    await showMoreDialog<void>(context, builder: (_) => _live(_threadContent));
    _update(() => _openConv = null);
    unawaited(_inbox.refresh());
  }

  @override
  Widget build(BuildContext context) {
    _pageRoute = ModalRoute.of(context);
    final myId = ref.watch(authProfileProvider)?.userId;
    final me = myId == null || myId.isEmpty ? null : myId;
    if (me != _inboxUser) {
      _inbox
        ..removeListener(_onInbox)
        ..dispose();
      _createInbox(me);
      unawaited(_loadBlocks());
    }
    final a = context.a;
    final x = context.aText;
    final cats = _categories();
    final q = _search.text.toLowerCase();
    final filtered = visibleListings(_listings, _blocked, me, (MarketListing l) => '${l['user_id']}')
        .where((l) => '${l['title'] ?? ''}'.toLowerCase().contains(q) || (l['description'] is String && (l['description'] as String).toLowerCase().contains(q)))
        .toList();
    final freeCount = _listings.where((l) => l['is_free'] == true).length;
    final unread = _inbox.unread(_blocked);

    Widget stat(int value, String label, Color bg, Color ink, int delayMs) => FadeRise(
          delay: Duration(milliseconds: delayMs),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('$value', style: x.heading(px(22, color: ink, height: 1.25))),
              Opacity(opacity: 0.8, child: Text(label, style: px(12, weight: FontWeight.w600, color: ink, height: 16 / 12))),
            ]),
          ),
        );

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: tr('secondhandmarket_i_lk_elani_siz_yerlesdirin_02683c', 'İlk elanı siz yerləşdirin!'),
          title: tr('secondhandmarket_i_kinci_el_bazari_ad9f9f', 'İkinci Əl Bazarı'),
          actions: [
            Semantics(
              button: true,
              label: tr('secondhandmarket_yeni_elan_yarat_3c7a2d', 'Yeni elan yarat'),
              excludeSemantics: true,
              child: PressScale(
                scale: 0.95,
                onTap: _showCreate,
                child: Container(
                  key: const ValueKey('market-create-open'),
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                  child: const AIcon(AIcons.plus, size: 16, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
                ),
              ),
            ),
          ],
        ),
        ASearchField(controller: _search, placeholder: tr('untranslated_axtar_92w4nn', 'Axtar...'), fieldKey: const ValueKey('market-search')),
        const SizedBox(height: 12),
        AGridCols(columns: 3, gap: 12, children: [
          stat(_listings.length, tr('untranslated_elan_voiz8p', 'Elan'), a.green1, a.greenInk, 100),
          stat(freeCount, tr('untranslated_pulsuz_27d02z', 'Pulsuz'), a.yellow1, a.warnInk, 150),
          stat(cats.length, tr('untranslated_kateqoriya_d7bf4y', 'Kateqoriya'), a.lav1, a.lavInk, 200),
        ]),
        const SizedBox(height: 12),
        FadeRise(
          delay: const Duration(milliseconds: 250),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              MorePillChip(
                key: const ValueKey('market-cat-all'),
                selected: _selectedCategory == null,
                onTap: () {
                  _update(() => _selectedCategory = null);
                  unawaited(_loadListings());
                },
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                weight: FontWeight.w700,
                gap: 8,
                gradient: _selectedCategory == null ? a.gradCta : null,
                background: _selectedCategory == null ? null : a.surface,
                borderColor: _selectedCategory == null ? a.btnBorder : a.line,
                color: _selectedCategory == null ? a.accentInk : a.inkSoft,
                shadow: _selectedCategory == null ? a.cardShadow : null,
                children: [const AIcon(AIcons.sparkles, size: 16), Text(tr('secondhandmarket_hamisi_c73c4d', 'Hamısı'))],
              ),
              for (final c in cats) ...[
                const SizedBox(width: 8),
                () {
                  final (grad, ink) = _categoryLook(a, c.id);
                  final on = _selectedCategory == c.id;
                  return MorePillChip(
                    key: ValueKey('market-cat-${c.id}'),
                    selected: on,
                    onTap: () {
                      _update(() => _selectedCategory = c.id);
                      unawaited(_loadListings());
                    },
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    weight: FontWeight.w700,
                    gap: 8,
                    gradient: on ? grad : null,
                    background: on ? null : a.surface,
                    borderColor: on ? const Color(0x00000000) : a.line,
                    color: on ? ink : a.inkSoft,
                    shadow: on ? a.cardShadow : null,
                    children: [Text(c.emoji), Text(c.label)],
                  );
                }(),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 12),
        _Tabs(tabs: [
          (
            key: 'all',
            on: !_showMyListings && !_showInbox,
            child: Text(tr('secondhandmarket_butun_elanlar_033e6a', 'Bütün elanlar')),
            label: null,
            onTap: () {
              _update(() {
                _showMyListings = false;
                _showInbox = false;
              });
              unawaited(_loadListings());
            },
          ),
          (
            key: 'mine',
            on: _showMyListings && !_showInbox,
            child: Text(tr('secondhandmarket_menim_elanlarim_cec2c2', 'Mənim elanlarım')),
            label: null,
            onTap: () {
              _update(() {
                _showMyListings = true;
                _showInbox = false;
              });
              unawaited(_loadListings());
              unawaited(_loadBlockedNames());
            },
          ),
          if (me != null)
            (
              key: 'inbox',
              on: _showInbox,
              label: unread > 0 ? '${tr('bottomnav_mesajlar', 'Mesajlar')}, ${formatTr('marketinbox_unread_count', '{n} oxunmamış', {'n': unread})}' : null,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Flexible(child: Text(tr('bottomnav_mesajlar', 'Mesajlar'), maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (unread > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    key: const ValueKey('market-inbox-badge'),
                    constraints: const BoxConstraints(minWidth: 18),
                    height: 18,
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.green2, borderRadius: BorderRadius.circular(999)),
                    child: Text(unread > 99 ? '99+' : '$unread', style: px(11, weight: FontWeight.w700, color: const Color(0xFFFFFFFF), height: 1)),
                  ),
                ],
              ]),
              onTap: () {
                _update(() => _showInbox = true);
                unawaited(_inbox.refresh());
              },
            ),
        ]),
        if (_showMyListings && !_showInbox && _blocked.isNotEmpty) ...[
          const SizedBox(height: 12),
          ACard(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('market_blocked_users', 'Bloklanmış istifadəçilər'), style: x.aListTitle)),
              for (final id in _blocked)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    Expanded(
                      child: Text((_blockedNames[id] ?? '').isNotEmpty ? _blockedNames[id]! : tr('market_user_fallback', 'İstifadəçi'),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListSub),
                    ),
                    const SizedBox(width: 8),
                    APillButton(
                      buttonKey: ValueKey('market-unblock-$id'),
                      kind: APillKind.soft,
                      height: 40,
                      label: tr('market_unblock', 'Blokdan çıxar'),
                      onTap: () => _unblock(id),
                    ),
                  ]),
                ),
            ]),
          ),
        ],
        const SizedBox(height: 12),
        if (_showInbox)
          MarketInbox(
            conversations: _inbox.conversations(_blocked),
            listings: _inbox.listings,
            names: _inbox.names,
            myId: me,
            loading: _inbox.loading,
            failed: _inbox.failed,
            onRetry: () => unawaited(_inbox.refresh()),
            onOpen: _showThread,
          )
        else if (_isLoading)
          AGridCols(columns: 2, gap: 12, children: [
            for (var i = 0; i < 4; i++)
              APulse(
                child: ACard(
                  padding: EdgeInsets.zero,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                    AspectRatio(aspectRatio: 1, child: ColoredBox(color: a.surfaceSoft)),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        FractionallySizedBox(widthFactor: 0.75, child: Container(height: 16, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(4)))),
                        const SizedBox(height: 8),
                        FractionallySizedBox(widthFactor: 0.5, child: Container(height: 12, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(4)))),
                      ]),
                    ),
                  ]),
                ),
              ),
          ])
        else if (filtered.isEmpty)
          DashedEmptyCard(
            gradient: a.gradGreen,
            icon: AIcon(AIcons.package, size: 32, color: a.greenInk),
            title: tr('secondhandmarket_hele_elan_yoxdur_89fb8c', 'Hələ elan yoxdur'),
            text: tr('secondhandmarket_i_lk_elani_siz_yerlesdirin_02683c', 'İlk elanı siz yerləşdirin!'),
            action: APillButton(
              buttonKey: const ValueKey('market-create-first'),
              label: tr('secondhandmarket_i_lk_elani_yarat_a4e8b2', 'İlk elanı yarat'),
              icon: const AIcon(AIcons.plus, size: 15, strokeWidth: 2.2),
              onTap: _showCreate,
            ),
          )
        else
          AGridCols(columns: 2, gap: 12, children: [
            for (var i = 0; i < filtered.length; i++)
              FadeRise(
                dy: 10,
                delay: Duration(milliseconds: (i * 50).clamp(0, 300)),
                child: _ListingCard(key: ValueKey('market-listing-${filtered[i]['id']}'), listing: filtered[i], onTap: () => _showDetail(filtered[i])),
              ),
          ]),
      ]),
    );
  }

  // ── dialog contents ──

  Widget _createContent(BuildContext context) {
    final a = context.a;
    final f = _form;
    Widget field(String label, Widget input) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [MoreFieldLabel(label), input]);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      MoreDialogHeader(
        icon: Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(gradient: a.gradGreen, borderRadius: BorderRadius.circular(8)),
          child: AIcon(AIcons.plus, size: 16, color: a.greenInk),
        ),
        title: tr('secondhandmarket_yeni_elan_yarat_3c7a2d', 'Yeni elan yarat'),
      ),
      const SizedBox(height: 32),
      field(
        tr('secondhandmarket_sekiller_maks_5_4281f8', 'Şəkillər (maks. 5)'),
        AGridCols(columns: 5, gap: 8, children: [
          for (var i = 0; i < _uploadedImages.length; i++)
            AspectRatio(
              aspectRatio: 1,
              child: Stack(fit: StackFit.expand, children: [
                ClipRRect(borderRadius: BorderRadius.circular(12), child: marketImage(_uploadedImages[i])),
                PositionedDirectional(
                  top: 4,
                  end: 4,
                  child: Semantics(
                    button: true,
                    label: tr('marketinbox_remove_image', 'Şəkli sil'),
                    child: PressScale(
                      scale: 0.9,
                      onTap: () => _update(() => _uploadedImages = [..._uploadedImages]..removeAt(i)),
                      child: Container(
                        key: ValueKey('market-remove-image-$i'),
                        width: 24,
                        height: 24,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.pink2, shape: BoxShape.circle),
                        child: const AIcon(AIcons.x, size: 12, color: Color(0xFFFFFFFF)),
                      ),
                    ),
                  ),
                ),
              ]),
            ),
          if (_uploadedImages.length < 5)
            Semantics(
              button: true,
              enabled: !_uploadingImages,
              child: PressScale(
                scale: 0.95,
                enabled: !_uploadingImages,
                onTap: _pickImages,
                child: AspectRatio(
                  key: const ValueKey('market-add-image'),
                  aspectRatio: 1,
                  child: DashedBox(
                    child: _uploadingImages
                        ? Center(child: ALoader(size: 20, color: a.inkSoft))
                        : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            AIcon(AIcons.imagePlus, size: 20, color: a.inkSoft),
                            const SizedBox(height: 4),
                            Text(tr('secondhandmarket_elave_et_6e1b9b', 'Əlavə et'), maxLines: 1, overflow: TextOverflow.ellipsis, style: px(10, color: a.inkSoft, height: 15 / 10)),
                          ]),
                  ),
                ),
              ),
            ),
        ]),
      ),
      const SizedBox(height: 16),
      field(
        tr('secondhandmarket_basliq_3dfed8', 'Başlıq *'),
        _FormField(
          fieldKey: const ValueKey('market-form-title'),
          initial: f.title,
          placeholder: tr('secondhandmarket_meselen_0_3_ay_oglan_geyimleri_55b327', 'Məsələn: 0-3 ay oğlan geyimləri'),
          onChanged: (v) => f.title = v,
        ),
      ),
      const SizedBox(height: 16),
      field(
        tr('secondhandmarket_tesvir_f85651', 'Təsvir'),
        _FormArea(initial: f.description, placeholder: tr('secondhandmarket_esya_haqqinda_melumat_9e2aa1', 'Əşya haqqında məlumat...'), onChanged: (v) => f.description = v),
      ),
      const SizedBox(height: 16),
      field(
        tr('untranslated_kateqoriya_d7bf4y', 'Kateqoriya'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final c in _categories())
            () {
              final (grad, ink) = _categoryLook(a, c.id);
              final on = f.category == c.id;
              return MorePillChip(
                key: ValueKey('market-form-cat-${c.id}'),
                selected: on,
                onTap: () => _update(() => f.category = c.id),
                gradient: on ? grad : null,
                background: on ? null : a.surfaceSoft,
                color: on ? ink : a.inkSoft,
                shadow: on ? a.cardShadow : null,
                children: [Text('${c.emoji} ${c.label}')],
              );
            }(),
        ]),
      ),
      const SizedBox(height: 16),
      field(
        tr('secondhandmarket_veziyyet_f0e993', 'Vəziyyət'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final c in _conditions())
            () {
              final (dot, ink, soft) = _conditionLook(a, c.id);
              final on = f.condition == c.id;
              return MorePillChip(
                key: ValueKey('market-form-cond-${c.id}'),
                selected: on,
                onTap: () => _update(() => f.condition = c.id),
                background: on ? soft : a.surfaceSoft,
                color: on ? ink : a.inkSoft,
                borderColor: on ? dot : const Color(0x00000000),
                children: [Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)), Text(c.label)],
              );
            }(),
        ]),
      ),
      const SizedBox(height: 16),
      field(
        tr('secondhandmarket_yas_araligi_2e277e', 'Yaş aralığı'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final age in _ageRanges())
            MorePillChip(
              selected: f.ageRange == age,
              onTap: () => _update(() => f.ageRange = age),
              background: f.ageRange == age ? a.peach1 : a.surfaceSoft,
              color: f.ageRange == age ? a.accentInk : a.inkSoft,
              borderColor: f.ageRange == age ? a.peach2 : const Color(0x00000000),
              children: [Text(age)],
            ),
        ]),
      ),
      const SizedBox(height: 16),
      field(
        tr('secondhandmarket_qiymet_54c4f3', 'Qiymət'),
        Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            APillButton(
              buttonKey: const ValueKey('market-form-free'),
              kind: f.isFree ? APillKind.cta : APillKind.soft,
              background: f.isFree ? a.green2 : null,
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              label: tr('untranslated_pulsuz_27d02z', 'Pulsuz'),
              onTap: () => _update(() {
                f.isFree = true;
                f.price = 0;
              }),
            ),
            const SizedBox(width: 8),
            APillButton(
              buttonKey: const ValueKey('market-form-paid'),
              kind: !f.isFree ? APillKind.cta : APillKind.soft,
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              label: tr('secondhandmarket_pullu_3c7a2d', 'Pullu'),
              onTap: () => _update(() => f.isFree = false),
            ),
          ]),
          if (!f.isFree)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(children: [
                SizedBox(
                  width: 96,
                  child: _FormField(
                    fieldKey: const ValueKey('market-form-price'),
                    initial: _price(f.price),
                    placeholder: '0',
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (v) => f.price = num.tryParse(v.trim()) ?? (v.trim().isEmpty ? 0 : double.nan),
                  ),
                ),
                const SizedBox(width: 8),
                Text('₼', style: px(13, color: a.inkSoft)),
              ]),
            ),
        ]),
      ),
      const SizedBox(height: 16),
      field(
        tr('secondhandmarket_seher_5f373c', 'Şəhər'),
        _FormField(initial: f.locationCity, placeholder: tr('secondhandmarket_meselen_baki_425cda', 'Məsələn: Bakı'), onChanged: (v) => f.locationCity = v),
      ),
      const SizedBox(height: 16),
      Builder(
        builder: (dialogContext) => APillButton(
          buttonKey: const ValueKey('market-form-submit'),
          height: 46,
          expand: true,
          background: a.green2,
          opacity: _isSubmitting ? 0.6 : 1,
          icon: _isSubmitting ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.check, size: 15, strokeWidth: 2.2),
          label: _isSubmitting ? tr('secondhandmarket_yaradilir_9bb5ed', 'Yaradılır...') : tr('marketinbox_create_listing', 'Elan yarat'),
          onTap: _isSubmitting ? null : () => _createListing(dialogContext),
        ),
      ),
    ]);
  }

  Widget _detailContent(BuildContext context, MarketListing l) {
    final a = context.a;
    final x = context.aText;
    final me = _myId;
    final images = marketImages(l['images']);
    final (grad, _) = _categoryLook(a, '${l['category']}');
    final cat = _categories().firstWhere((c) => c.id == l['category'], orElse: () => _categories()[6]);
    final cond = _conditions().firstWhere((c) => c.id == l['condition'], orElse: () => _conditions()[2]);
    final (_, condInk, condSoft) = _conditionLook(a, cond.id);
    final isFree = l['is_free'] == true;
    final own = l['user_id'] == me;
    final created = jsParseDate('${l['created_at'] ?? ''}')?.toLocal();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(fit: StackFit.expand, children: [
          if (images.isNotEmpty)
            ColoredBox(color: a.surfaceSoft, child: marketImage(images.first, semanticLabel: '${l['title'] ?? ''}'))
          else
            DecoratedBox(decoration: BoxDecoration(gradient: grad), child: Center(child: Text(cat.emoji, style: const TextStyle(fontSize: 72, height: 1)))),
          PositionedDirectional(
            top: 12,
            end: 12,
            child: Semantics(
              button: true,
              label: tr('common_close', 'Bağla'),
              child: PressScale(
                scale: 0.95,
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  // `bg-black/30 backdrop-blur-md`
                  decoration: const BoxDecoration(color: Color(0x4D000000), shape: BoxShape.circle),
                  child: const AIcon(AIcons.x, size: 16, color: Color(0xFFFFFFFF)),
                ),
              ),
            ),
          ),
          if (images.length > 1)
            PositionedDirectional(
              start: 12,
              end: 12,
              bottom: 12,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  for (var i = 0; i < images.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Container(
                      width: 48,
                      height: 48,
                      clipBehavior: Clip.antiAlias,
                      // `border-2 border-white/50`
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0x80FFFFFF), width: 2)),
                      child: marketImage(images[i]),
                    ),
                  ],
                ]),
              ),
            ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text('${l['title'] ?? ''}', style: x.heading(px(20, weight: FontWeight.w700, color: a.ink, height: 28 / 20))),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            ARankTagBox(cond.label, background: condSoft, color: condInk),
            if ('${l['age_range'] ?? ''}'.isNotEmpty) ARankTagBox('${l['age_range']}', background: a.surfaceSoft, color: a.inkSoft),
          ]),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: isFree ? a.green1 : a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Opacity(opacity: 0.8, child: Text(tr('secondhandmarket_qiymet_54c4f3', 'Qiymət'), style: px(14, color: isFree ? a.greenInk : a.inkSoft, height: 20 / 14))),
                  Text(
                    isFree ? tr('secondhandmarket_pulsuz', 'Pulsuz') : '${_price(l['price'])} ₼',
                    style: x.heading(px(24, color: isFree ? a.greenInk : a.ink, height: 1.25)),
                  ),
                ]),
              ),
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: isFree ? a.green2 : a.lineStrong, borderRadius: BorderRadius.circular(12)),
                child: AIcon(AIcons.tag, size: 24, color: isFree ? const Color(0xFFFFFFFF) : a.inkSoft),
              ),
            ]),
          ),
          if ('${l['description'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 16),
            Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('secondhandmarket_tesvir_f85651', 'Təsvir'), style: px(16, weight: FontWeight.w700, color: a.ink))),
            Text('${l['description']}', style: px(16, color: a.bodyText)),
          ],
          if ('${l['location_city'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 16),
            Row(children: [
              AIcon(AIcons.mapPin, size: 16, color: a.inkSoft),
              const SizedBox(width: 8),
              Flexible(child: Text('${l['location_city']}', style: px(16, color: a.inkSoft))),
            ]),
          ],
          const SizedBox(height: 16),
          Row(children: [
            AIcon(AIcons.clock, size: 16, color: a.inkSoft),
            const SizedBox(width: 8),
            Text(created == null ? '' : formatDatePattern(created, 'd MMMM yyyy'), style: px(14, color: a.inkSoft, height: 20 / 14)),
          ]),
          const SizedBox(height: 16),
          APillButton(
            buttonKey: const ValueKey('market-contact-open'),
            height: 48,
            expand: true,
            background: a.green2,
            opacity: own ? 0.5 : 1,
            icon: const AIcon(AIcons.messageCircle, size: 16, strokeWidth: 2.2),
            label: own ? tr('secondhandmarket_oz_elaninizdir_4cfb3d', 'Öz elanınızdır') : tr('secondhandmarket_satici_ile_elaqe_a7f3e8', 'Satıcı ilə əlaqə'),
            onTap: own ? null : () => Navigator.of(context).pop(true),
          ),
          if (me != null && !own) ...[
            const SizedBox(height: 16),
            _safetyRow(
              minHeight: 44,
              iconSize: 15,
              onReport: () => _openReport('listing', '${l['id']}', '${l['user_id']}'),
              onBlock: () => _openBlock('${l['user_id']}'),
              blockLabel: tr('market_block_user', 'Satıcını blokla'),
            ),
          ],
        ]),
      ),
    ]);
  }

  Widget _safetyRow({required double minHeight, required double iconSize, required VoidCallback onReport, required VoidCallback onBlock, required String blockLabel}) =>
      Row(children: [
        Expanded(
          child: APillButton(
            buttonKey: const ValueKey('market-report-open'),
            kind: APillKind.soft,
            height: minHeight,
            expand: true,
            icon: AIcon(AIcons.flag, size: iconSize, strokeWidth: 2.2),
            label: tr('market_report', 'Şikayət et'),
            onTap: onReport,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: APillButton(
            buttonKey: const ValueKey('market-block-open'),
            kind: APillKind.soft,
            height: minHeight,
            expand: true,
            icon: AIcon(AIcons.ban, size: iconSize, strokeWidth: 2.2),
            label: blockLabel,
            onTap: onBlock,
          ),
        ),
      ]);

  Widget _listingInfo(BuildContext context, {required String? image, required String category, required String title, required String sub}) {
    final a = context.a;
    final x = context.aText;
    final (grad, _) = _categoryLook(a, category);
    final cat = _categories().firstWhere((c) => c.id == category, orElse: () => _categories()[6]);
    final fallback = Container(
      width: 48,
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: grad, borderRadius: BorderRadius.circular(8)),
      child: Text(cat.emoji, style: const TextStyle(fontSize: 20, height: 1)),
    );
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        if (image != null) ClipRRect(borderRadius: BorderRadius.circular(8), child: SizedBox(width: 48, height: 48, child: marketImage(image, fallback: fallback))) else fallback,
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle),
            Text(sub, style: x.aListSub),
          ]),
        ),
      ]),
    );
  }

  Widget _contactContent(BuildContext context) {
    final a = context.a;
    final l = _contactListing;
    final me = _myId;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      MoreDialogHeader(icon: AIcon(AIcons.messageCircle, size: 20, color: a.green2), title: tr('secondhandmarket_satici_ile_elaqe_a7f3e8', 'Satıcı ilə əlaqə')),
      if (l != null) ...[
        const SizedBox(height: 24),
        _listingInfo(
          context,
          image: marketImages(l['images']).firstOrNull,
          category: '${l['category']}',
          title: '${l['title'] ?? ''}',
          sub: l['is_free'] == true ? tr('secondhandmarket_pulsuz', 'Pulsuz') : '${_price(l['price'])} ₼',
        ),
        if (me != null && l['user_id'] != me) ...[
          const SizedBox(height: 16),
          _safetyRow(
            minHeight: 40,
            iconSize: 14,
            onReport: () => _openReport(reportTargetForContact(_contactMessages.length), '${l['id']}', '${l['user_id']}'),
            onBlock: () => _openBlock('${l['user_id']}'),
            blockLabel: tr('market_block_user', 'Satıcını blokla'),
          ),
        ],
        const SizedBox(height: 16),
        MarketThread(
          messages: [
            for (final m in visibleMessages(_contactMessages, _blocked, (Map<String, dynamic> m) => '${m['sender_id']}'))
              ThreadMessage(id: '${m['id']}', senderId: '${m['sender_id']}', content: '${m['content'] ?? ''}', createdAt: '${m['created_at'] ?? ''}'),
          ],
          myId: me,
          controller: _contactText,
          onSend: _sendContact,
          sending: _sendingMessage,
          emptyHint: tr('secondhandmarket_saticiya_mesaj_gonderin_ad78e2', 'Satıcıya mesaj göndərin'),
        ),
      ],
    ]);
  }

  Widget _threadContent(BuildContext context) {
    final a = context.a;
    final conv = _openConv;
    final name = conv == null ? '' : ((_inbox.names[conv.counterpartId] ?? '').isNotEmpty ? _inbox.names[conv.counterpartId]! : tr('market_user_fallback', 'İstifadəçi'));
    final thread = _openThread;
    final l = conv == null ? null : _inbox.listings[conv.listingId];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      MoreDialogHeader(
        icon: AIcon(AIcons.messageCircle, size: 20, color: a.green2),
        title: name,
        titleWidget: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      if (conv != null) ...[
        const SizedBox(height: 24),
        _listingInfo(
          context,
          image: marketImages(l?['images']).firstOrNull,
          category: '${l?['category'] ?? 'other'}',
          title: '${l?['title'] ?? ''}'.isNotEmpty ? '${l!['title']}' : tr('untranslated_elan_voiz8p', 'Elan'),
          sub: '${conv.role == 'seller' ? tr('marketinbox_role_buyer', 'Alıcı') : tr('marketinbox_role_seller', 'Satıcı')}'
              '${l != null ? ' · ${l['is_free'] == true ? tr('secondhandmarket_pulsuz', 'Pulsuz') : '${_price(l['price'])} ₼'}' : ''}',
        ),
        const SizedBox(height: 16),
        _safetyRow(
          minHeight: 40,
          iconSize: 14,
          onReport: () => _openReport(reportTargetForContact(thread.length), conv.listingId, conv.counterpartId),
          onBlock: () => _openBlock(conv.counterpartId),
          blockLabel: conv.role == 'seller' ? tr('marketinbox_block_buyer', 'Alıcını blokla') : tr('market_block_user', 'Satıcını blokla'),
        ),
        const SizedBox(height: 16),
        MarketThread(
          messages: [for (final m in thread) ThreadMessage(id: m.id, senderId: m.senderId, content: m.content, createdAt: m.createdAt)],
          myId: _myId,
          controller: _threadText,
          onSend: _sendThread,
          sending: _threadSending,
        ),
      ],
    ]);
  }
}

/// `.a-tabs w-full` (flex) whose `.a-tab`s are `flex-1` (track surface-soft, padding 3, gap 2; active peach-1 /
/// accent ink) with rich labels and an optional aria-label.
class _Tabs extends StatelessWidget {
  const _Tabs({required this.tabs});
  final List<({String key, bool on, Widget child, String? label, VoidCallback onTap})> tabs;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
      child: Row(children: [
        for (var i = 0; i < tabs.length; i++) ...[
          if (i > 0) const SizedBox(width: 2),
          Expanded(
            child: Semantics(
              button: true,
              selected: tabs[i].on,
              label: tabs[i].label,
              child: GestureDetector(
                key: ValueKey('market-tab-${tabs[i].key}'),
                behavior: HitTestBehavior.opaque,
                onTap: tabs[i].onTap,
                child: AnimatedContainer(
                  duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: tabs[i].on ? a.peach1 : const Color(0x00000000), borderRadius: BorderRadius.circular(999)),
                  child: DefaultTextStyle.merge(
                    style: x.aTab.copyWith(color: tabs[i].on ? a.accentInk : a.inkSoft),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    child: tabs[i].child,
                  ),
                ),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// A grid card of a listing (square image with the price and image-count badges, title, condition · age, city).
class _ListingCard extends StatelessWidget {
  const _ListingCard({super.key, required this.listing, required this.onTap});
  final MarketListing listing;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final l = listing;
    final images = marketImages(l['images']);
    final (grad, _) = _categoryLook(a, '${l['category']}');
    final cat = _categories().firstWhere((c) => c.id == l['category'], orElse: () => _categories()[6]);
    final cond = _conditions().firstWhere((c) => c.id == l['condition'], orElse: () => _conditions()[2]);
    final (dot, _, _) = _conditionLook(a, cond.id);
    final emojiTile = DecoratedBox(decoration: BoxDecoration(gradient: grad), child: Center(child: Text(cat.emoji, style: const TextStyle(fontSize: 48, height: 1))));
    final small = px(12, color: a.inkSoft, height: 16 / 12);
    return Semantics(
      button: true,
      child: PressScale(
        scale: 0.98,
        onTap: onTap,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: a.line), boxShadow: a.cardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(fit: StackFit.expand, children: [
                ColoredBox(color: a.surfaceSoft, child: images.isNotEmpty ? marketImage(images.first, semanticLabel: '${l['title'] ?? ''}', fallback: emojiTile) : emojiTile),
                PositionedDirectional(
                  top: 8,
                  start: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      // `rgba(255,255,255,0.92)` price badge (SecondHandMarket.tsx literal); shadow-lg
                      color: l['is_free'] == true ? a.green2 : const Color(0xEBFFFFFF),
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3)],
                    ),
                    child: Text(
                      l['is_free'] == true ? tr('untranslated_pulsuz_27d02z', 'Pulsuz') : '${_price(l['price'])} ₼',
                      style: px(12, weight: FontWeight.w700, color: l['is_free'] == true ? const Color(0xFFFFFFFF) : a.ink, height: 16 / 12),
                    ),
                  ),
                ),
                if (images.length > 1)
                  PositionedDirectional(
                    bottom: 8,
                    end: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      // `bg-black/50 backdrop-blur-md`
                      decoration: BoxDecoration(color: const Color(0x80000000), borderRadius: BorderRadius.circular(8)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const AIcon(AIcons.image, size: 12, color: Color(0xFFFFFFFF)),
                        const SizedBox(width: 4),
                        Text('${images.length}', style: px(12, color: const Color(0xFFFFFFFF), height: 16 / 12)),
                      ]),
                    ),
                  ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text('${l['title'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14)),
                const SizedBox(height: 6),
                Row(children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Flexible(child: Text(cond.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: small)),
                  if ('${l['age_range'] ?? ''}'.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Text('•', style: px(12, color: a.inkFaint, height: 16 / 12)),
                    const SizedBox(width: 6),
                    Flexible(child: Text('${l['age_range']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: small)),
                  ],
                ]),
                if ('${l['location_city'] ?? ''}'.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(children: [
                    AIcon(AIcons.mapPin, size: 12, color: a.inkSoft),
                    const SizedBox(width: 4),
                    Flexible(child: Text('${l['location_city']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: small)),
                  ]),
                ],
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `.a-input` text field that keeps its own controller (the form object holds the value).
class _FormField extends StatefulWidget {
  const _FormField({required this.initial, required this.placeholder, required this.onChanged, this.keyboardType, this.fieldKey});
  final String initial;
  final String placeholder;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final Key? fieldKey;
  @override
  State<_FormField> createState() => _FormFieldState();
}

class _FormFieldState extends State<_FormField> {
  late final TextEditingController _c = TextEditingController(text: widget.initial);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AField(
        fieldKey: widget.fieldKey,
        controller: _c,
        placeholder: widget.placeholder,
        keyboardType: widget.keyboardType,
        inputFormatters: widget.keyboardType == null ? null : [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,-]'))],
        onChanged: widget.onChanged,
      );
}

/// `<textarea className="a-input w-full resize-none" rows={3}>` (min-height 72).
class _FormArea extends StatefulWidget {
  const _FormArea({required this.initial, required this.placeholder, required this.onChanged});
  final String initial;
  final String placeholder;
  final ValueChanged<String> onChanged;
  @override
  State<_FormArea> createState() => _FormAreaState();
}

class _FormAreaState extends State<_FormArea> {
  late final TextEditingController _c = TextEditingController(text: widget.initial);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ATextArea(controller: _c, placeholder: widget.placeholder, onChanged: widget.onChanged, height: 72);
}

/// The add-image tile: `rounded-xl` (12) with `2px dashed var(--a-line-strong)` on `--a-surface-soft`.
class DashedBox extends StatelessWidget {
  const DashedBox({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => CustomPaint(painter: _Dash(context.a.lineStrong, context.a.surfaceSoft), child: child);
}

class _Dash extends CustomPainter {
  _Dash(this.color, this.fill);
  final Color color;
  final Color fill;
  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(12)).deflate(1);
    canvas.drawRRect(rrect, Paint()..color = fill);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      for (double d = 0; d < metric.length; d += 12) {
        canvas.drawPath(metric.extractPath(d, (d + 6).clamp(0, metric.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_Dash old) => old.color != color || old.fill != fill;
}
