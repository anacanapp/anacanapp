// Tools opened by tapping their tile on the Tools tab (data-tour="tool-<id>").
const TOOLS = {
  'bump-week24': ['kick', 'maternity-calculator', 'weight', 'hospital', 'names', 'mood', 'safety', 'blood-pressure', 'danger-signs', 'fetal-growth', 'vitamin-tracker', 'doctors'],
  'mommy-6m': ['baby-tracker', 'baby-growth', 'vaccine-calendar', 'teething', 'first-aid', 'sleep-training', 'solid-food-guide', 'whitenoise'],
  'flow-day12': ['mood', 'weight'],
};
const SHORT = { 'bump-week24': 'bump', 'mommy-6m': 'mommy', 'flow-day12': 'flow' };

export default Object.entries(TOOLS).flatMap(([persona, ids]) => ids.map((tool) => ({
  id: `${SHORT[persona]}.tool.${tool}`, persona,
  async steps(page, h) { await h.openTool(tool); await h.shot(tool); },
})));
