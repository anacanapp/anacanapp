// Use native-provided safe areas on older Android WebViews, with the browser/iOS
// environment insets as the fallback. The canvas stays fullscreen behind chrome.
export default {
  plugins: [{
    postcssPlugin: 'startup-native-safe-area',
    Once(root) {
      root.walkDecls(declaration => {
        declaration.value = declaration.value.replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g,
          (fallback, side) => `var(--safe-area-inset-${side}, ${fallback})`);
      });
    },
  }],
};
