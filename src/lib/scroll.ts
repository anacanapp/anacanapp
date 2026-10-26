export const resetAppScrollPosition = () => {
  if (typeof window === 'undefined') return;

  const scrollableElements = new Set<HTMLElement>();

  const rootContainer = document.querySelector('[data-scroll-container]');
  if (rootContainer instanceof HTMLElement) {
    scrollableElements.add(rootContainer);
  }

  document
    .querySelectorAll('[data-scroll-container], [data-reset-scroll], .overflow-y-auto, .overflow-auto')
    .forEach((el) => {
      // data-scroll-ignore: öz scroll vəziyyətini idarə edən konteynerlər
      // (məs. AI chat — aşağıda qalmalıdır, yuxarı sıfırlanmamalıdır)
      if (el instanceof HTMLElement && !el.hasAttribute('data-scroll-ignore')) {
        scrollableElements.add(el);
      }
    });

  scrollableElements.forEach((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });

  const scrollingElement = document.scrollingElement;
  if (scrollingElement instanceof HTMLElement) {
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
  }

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
};
