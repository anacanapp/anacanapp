// Android 11 WebView (Chrome 90) and iOS <15.4 drop any declaration that uses
// dvh/svh/lvh, so full-height screens lost their height and could not scroll.
// Emit a vh copy right before each such declaration; newer engines override it.
const viewportUnitFallback = () => ({
  postcssPlugin: 'anacan-viewport-unit-fallback',
  Declaration(decl) {
    if (!/\d(?:d|s|l)vh\b/.test(decl.value)) return;
    const fallback = decl.value.replace(/(\d)(?:d|s|l)vh\b/g, '$1vh');
    const previous = decl.prev();
    if (previous && previous.type === 'decl' && previous.prop === decl.prop && previous.value === fallback) return;
    decl.cloneBefore({ value: fallback });
  },
});
viewportUnitFallback.postcss = true;

export default {
  plugins: [
    (await import('tailwindcss')).default,
    viewportUnitFallback,
    (await import('autoprefixer')).default,
  ],
};
