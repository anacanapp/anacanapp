// Ported from: src/components/ads/DemoAd.tsx, src/components/ads/AdExperienceProvider.tsx (preview toolbar),
//              src/styles/ads.css (.admob-demo-*, .admob-preview-toolbar)
//
// Admin demo creatives: no request reaches Google and no revenue is generated. The visible copy is literal in
// React and localised by the Vite inline plugin, so it goes through trInline / formatTrInline here.
import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/ads/ads_config.dart';

/// `<DemoBanner placementId onClick />` (`.admob-demo-banner`; [compact] = `.admob-position-middle`).
class DemoBanner extends StatelessWidget {
  const DemoBanner({super.key, required this.placementId, this.onTap, this.compact = false});
  final String placementId;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final title = placementDefinition(placementId)['title'] ?? '';
    return Semantics(
      button: true,
      label: tr('demoad_about_aria', 'Demo reklam haqqında'),
      child: GestureDetector(
        key: ValueKey<String>('ad-demo-$placementId'),
        onTap: onTap,
        child: Container(
          padding: compact ? const EdgeInsets.symmetric(horizontal: 8, vertical: 4) : const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            // ads.css .admob-demo-banner literals
            border: Border.all(color: const Color(0xFFECD9CF)),
            borderRadius: BorderRadius.circular(compact ? 9 : 14),
            gradient: const LinearGradient(
              begin: Alignment(-0.94, -0.34),
              end: Alignment(0.94, 0.34),
              colors: [Color(0xFFFFFAF5), Color(0xFFFFF2EB), Color(0xFFF2ECFF)],
              stops: [0, 0.65, 1],
            ),
            boxShadow: const [BoxShadow(color: Color(0x104B2B16), offset: Offset(0, 4), blurRadius: 20)],
          ),
          child: Row(children: [
            Container(
              width: compact ? 32 : 42,
              height: compact ? 32 : 42,
              decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(compact ? 8 : 12)),
              alignment: Alignment.center,
              child: const AIcon(AIcons.sparkles, size: 22, color: Color(0xFFC17856)),
            ),
            SizedBox(width: compact ? 7 : 10),
            Expanded(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(trInline('DemoAd.tsx', 'DEMO · ADMOB'),
                    style: TextStyle(fontSize: compact ? 7 : 8, fontWeight: FontWeight.w800, letterSpacing: (compact ? 7 : 8) * 0.12, color: const Color(0xFF907667))),
                Text(trInline('DemoAd.tsx', 'Burada reklamınız görünəcək'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: compact ? 11 : 14, height: compact ? 13 / 11 : 20 / 14, fontWeight: FontWeight.w700, color: const Color(0xFF43322C))),
                Opacity(
                  opacity: 0.7,
                  child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: Color(0xFF43322C))),
                ),
              ]),
            ),
            SizedBox(width: compact ? 7 : 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(color: const Color(0xFFF6DBC9), borderRadius: BorderRadius.circular(9)),
              child: Text(trInline('DemoAd.tsx', 'Nümunə'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF43322C))),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `<DemoFullscreen placementId rewardMinutes storyFormat onFinish />` drawn as a modal layer.
class DemoFullscreen extends StatefulWidget {
  const DemoFullscreen({super.key, required this.placementId, required this.rewardMinutes, this.storyFormat = 'native', required this.onFinish});
  final String placementId;
  final int rewardMinutes;
  final String storyFormat;
  final void Function(bool rewarded) onFinish;

  @override
  State<DemoFullscreen> createState() => _DemoFullscreenState();
}

class _DemoFullscreenState extends State<DemoFullscreen> {
  late final String _format = placementDefinition(widget.placementId)['format'] ?? '';
  bool get _rewarded => _format == 'rewarded';
  bool get _story => _format == 'native_story';
  late int _remaining = _rewarded ? 3 : _story ? 6 : 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (_rewarded || _story) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() => _remaining = _remaining > 0 ? _remaining - 1 : 0);
        if (_story && _remaining == 0) widget.onFinish(false);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Widget _close(Color background) => Semantics(
        button: true,
        label: tr('demoad_close_aria', 'Demo reklamı bağla'),
        child: GestureDetector(
          onTap: () => widget.onFinish(false),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: background, shape: BoxShape.circle),
            child: AIcon(AIcons.x, size: 18, color: background == const Color(0xCCFFFFFF) ? const Color(0xFF1E293B) : const Color(0xFFFFFFFF)),
          ),
        ),
      );

  Widget _storyView(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final video = widget.storyFormat == 'video';
    final width = [size.width * 0.94, size.height * 0.5].reduce((a, b) => a < b ? a : b);
    final height = [width * 16 / 9, size.height * 0.94].reduce((a, b) => a < b ? a : b);
    return SizedBox(
      width: height * 9 / 16,
      height: height,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  // Tailwind violet-800 / indigo-700 / fuchsia-800 (video) and orange-200 / rose-100 / violet-200
                  colors: video ? const [Color(0xFF5B21B6), Color(0xFF4338CA), Color(0xFF86198F)] : const [Color(0xFFFED7AA), Color(0xFFFFE4E6), Color(0xFFDDD6FE)],
                ),
              ),
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            top: 12,
            child: Column(children: [
              Container(
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: const Color(0x4DFFFFFF), borderRadius: BorderRadius.circular(4)),
                alignment: AlignmentDirectional.centerStart,
                child: FractionallySizedBox(
                  widthFactor: (6 - _remaining) / 6,
                  child: Container(decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(4))),
                ),
              ),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0x66000000), borderRadius: BorderRadius.circular(999)),
                  child: Text('${trInline('DemoAd.tsx', 'REKLAM · DEMO')} ${trInline('DemoAd.tsx', video ? 'VİDEO' : 'NATIVE')}', style: const TextStyle(fontSize: 10, color: Color(0xFFFFFFFF))),
                ),
                _close(const Color(0x66000000)),
              ]),
            ]),
          ),
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(24)),
                  child: video ? const AIcon(AIcons.play, size: 58, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.sparkles, size: 58, color: Color(0xFF6D28D9)),
                ),
                Text(trInline('DemoAd.tsx', 'Story ölçüsündə reklam'),
                    textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: video ? const Color(0xFFFFFFFF) : const Color(0xFF1E293B))),
                const SizedBox(height: 12),
                Text(trInline('DemoAd.tsx', '9:16 demo səhnə. Real native mediaya AdMob SDK-sı xidmət edir.'),
                    textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: video ? const Color(0xCCFFFFFF) : const Color(0xFF475569))),
              ]),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 20,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: const Color(0x99000000), borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Text(trInline('DemoAd.tsx', 'Demo sponsor'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFFFFFFF))),
                const SizedBox(height: 4),
                Text(trInline('DemoAd.tsx', 'Şəxsi story kimi göstərilmir və baxış sayınıza əlavə olunmur.'),
                    style: const TextStyle(fontSize: 11, color: Color(0xB3FFFFFF))),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () => widget.onFinish(false),
                  child: Container(
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(6)),
                    child: Text('${trInline('DemoAd.tsx', 'Növbəti story ·')} $_remaining${trInline('DemoAd.tsx', 's')}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _fullscreenView(BuildContext context) {
    final s = context.tokens.shadcn;
    final gameReward = widget.placementId == 'game_revive_rewarded';
    final title = gameReward
        ? trInline('DemoAd.tsx', 'Can / gediş bərpası')
        : _rewarded
            ? formatTrInline('DemoAd.tsx', '{inline_0} dəqiqə reklamsız', [widget.rewardMinutes])
            : trInline('DemoAd.tsx', 'Təbii keçiddə reklam');
    final description = trInline(
        'DemoAd.tsx',
        gameReward
            ? 'Videonu tamamladıqda cari oyunda can və ya əlavə gediş bərpa edilir. Xal saxlanır; bağlamaq bərpa vermir.'
            : _rewarded
                ? 'Videonun tamamlanmasını burada demo olaraq sınaqdan keçirirsiniz. Bağlamaq mükafat vermir.'
                : 'Bu nümunə təbii keçid nöqtəsini göstərir. Bağladıqdan sonra naviqasiya davam edir.');
    final label = _remaining > 0
        ? formatTrInline('DemoAd.tsx', 'Demo video · {inline_0} san.', [_remaining])
        : trInline(
            'DemoAd.tsx',
            gameReward
                ? 'Demoyu tamamla və canı bərpa et'
                : _rewarded
                    ? 'Demoyu tamamla və fasiləni sına'
                    : 'Davam et');
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 390),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: ColoredBox(
          color: s.background,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.fromLTRB(28, 28, 28, 40),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFFFEDD5), Color(0xFFFFF1F2), Color(0xFFEDE9FE)], // orange-100 / rose-50 / violet-100
                ),
              ),
              child: Stack(children: [
                Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xCCFFFFFF), borderRadius: BorderRadius.circular(999)),
                      child: Text(trInline('DemoAd.tsx', 'DEMO · REAL REKLAM DEYİL'),
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1, color: Color(0xFF1E293B))),
                    ),
                  ),
                  Center(
                    child: Container(
                      width: 96,
                      height: 96,
                      margin: const EdgeInsets.only(top: 40, bottom: 24),
                      decoration: BoxDecoration(
                        color: const Color(0xCCFFFFFF),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: const [BoxShadow(color: Color(0x0D000000), offset: Offset(0, 1), blurRadius: 2)],
                      ),
                      alignment: Alignment.center,
                      child: _rewarded ? const AIcon(AIcons.gift, size: 44, color: Color(0xFF8B5CF6)) : const AIcon(AIcons.play, size: 42, color: Color(0xFFF97316)),
                    ),
                  ),
                  Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
                  const SizedBox(height: 12),
                  Text(description, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: Color(0xFF475569))),
                ]),
                PositionedDirectional(top: -12, end: -12, child: _close(const Color(0xCCFFFFFF))),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(widget.placementId, textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: s.mutedForeground)),
                const SizedBox(height: 12),
                Opacity(
                  opacity: _remaining > 0 ? 0.5 : 1,
                  child: GestureDetector(
                    key: const ValueKey<String>('ad-demo-finish'),
                    onTap: _remaining > 0 ? null : () => widget.onFinish(_rewarded),
                    child: Container(
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(6)),
                      child: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: s.primaryForeground)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(trInline('DemoAd.tsx', 'Google-a reklam sorğusu göndərilmir. Demo gəlir yaratmır.'), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: s.mutedForeground)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      Positioned.fill(
        child: GestureDetector(onTap: () => widget.onFinish(false), child: const ColoredBox(color: Color(0xCC000000))), // Dialog overlay bg-black/80
      ),
      Center(child: Padding(padding: const EdgeInsets.all(16), child: _story ? _storyView(context) : _fullscreenView(context))),
    ]);
  }
}

/// `.admob-preview-toolbar`.
class AdPreviewToolbar extends StatelessWidget {
  const AdPreviewToolbar({super.key, required this.platform, required this.premium, required this.onReset, required this.onClose});
  final String platform;
  final bool premium;
  final VoidCallback onReset;
  final VoidCallback onClose;

  Widget _button(String label, AIconData icon, VoidCallback onTap) => Semantics(
        button: true,
        label: label,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: const Color(0x18FFFFFF), borderRadius: BorderRadius.circular(6)),
            child: AIcon(icon, size: 14, color: const Color(0xFFFFFFFF)),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => Container(
        key: const ValueKey<String>('ad-preview-toolbar'),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xED402E60), // ads.css #402e60ed
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [BoxShadow(color: Color(0x22000000), offset: Offset(0, 4), blurRadius: 20)],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const AIcon(AIcons.eye, size: 13, color: Color(0xFFFFFFFF)),
          const SizedBox(width: 7),
          Text('${trInline('AdExperienceProvider.tsx', 'Ad demo ·')} $platform · ${premium ? 'Premium' : trInline('AdExperienceProvider.tsx', 'Free')}',
              style: const TextStyle(fontSize: 10, color: Color(0xFFFFFFFF))),
          const SizedBox(width: 7),
          _button(trInline('AdExperienceProvider.tsx', 'Demo limitlərini sıfırla'), AIcons.settings2, onReset),
          const SizedBox(width: 7),
          _button(trInline('AdExperienceProvider.tsx', 'Demo rejimini bağla'), AIcons.x, onClose),
        ]),
      );
}
