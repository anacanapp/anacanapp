const tabs = async (page, h) => {
  await h.shot('home');
  await h.scroll(800); await h.shot('home-s1');
  await h.scroll(1600); await h.shot('home-s2');
  await h.scroll(2400); await h.shot('home-s3');
  await h.tab('tools'); await h.shot('tools');
  await h.tab('community'); await h.shot('community');
  await h.tab('ai'); await h.shot('ai');
  await h.tab('profile'); await h.shot('profile');
};
export default [
  { id: 'proto.bump', persona: 'bump-week24', steps: tabs },
];
