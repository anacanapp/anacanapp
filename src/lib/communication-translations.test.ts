import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const current = vi.hoisted(() => ({ language:'az' }));
vi.mock('@/lib/tr', () => ({ getPersistedLanguage: () => current.language, tr: (_key:string, fallback:string) => fallback }));
import { CHAT_TRANSLATIONS } from './chat-i18n';
import { GROUP_LANGUAGES, GROUP_LABELS, tr } from './group-i18n';

describe('new communications translations', () => {
  it('covers literal interface labels used by all new chat/group/story surfaces in every language',()=>{
    const paths=['../components/chat/ConversationScreen.tsx','../components/chat/VoiceMessage.tsx','../components/chat/ChatMemberPicker.tsx',
      '../components/community/ChatGroupsPanel.tsx','../components/community/GroupChatScreen.tsx','../components/community/GroupPostTags.tsx',
      '../components/community/ConversationListScreen.tsx','../components/community/StoryViewer.tsx','../components/community/UserBadge.tsx','./chat.ts'];
    const keys=[...new Set(paths.flatMap(path=>[...readFileSync(new URL(path,import.meta.url),'utf8').matchAll(/\btr\(\s*['"]([^'"]+)['"]/g)].map(match=>match[1])))];
    const missing:string[]=[];
    for(const language of GROUP_LANGUAGES){
      const path=['az','en'].includes(language)?`../locales/${language}.json`:`../../scripts/i18n/${language}.seed.json`;
      const base=JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
      for(const key of keys)if(!GROUP_LABELS[key]&&!CHAT_TRANSLATIONS[language]?.[key]&&!base[key])missing.push(`${language}:${key}`);
    }
    expect(missing).toEqual([]);
  });
  it.each(GROUP_LANGUAGES)('provides every chat/group label and placeholder in %s', language => {
    const expected=Object.keys(CHAT_TRANSLATIONS.en).sort();
    expect(Object.keys(CHAT_TRANSLATIONS[language]).sort()).toEqual(expected);
    for(const key of expected){
      const text=CHAT_TRANSLATIONS[language][key]; expect(text.trim(),key).not.toBe('');
      expect(text.match(/\{\w+\}/g)||[]).toEqual(CHAT_TRANSLATIONS.en[key].match(/\{\w+\}/g)||[]);
    }
    current.language=language;
    for(const [key,values] of Object.entries(GROUP_LABELS)){
      expect(values,key).toHaveLength(GROUP_LANGUAGES.length);
      expect(values.every(value=>typeof value==='string'&&value.trim().length>0),key).toBe(true);
      expect(tr(key),key).toBe(values[GROUP_LANGUAGES.indexOf(language)]);
    }
  });
  it('uses Qurucu/İdarəçi and localized privacy instead of legacy labels',()=>{
    current.language='az';expect(tr('group_owner')).toBe('Qurucu');expect(tr('group_administrator')).toBe('İdarəçi');
    expect(tr('group_private_note')).not.toMatch(/yaradan/i);
    expect(tr('group_public')).toBe('Açıq');expect(tr('group_private')).toBe('Özəl');
    expect(tr('common_all')).toBe('Hamısı');current.language='de';expect(tr('common_all')).toBe('Alle');
  });
});
