import { expect, it } from 'vitest';
import { blogCommand, blogImageUrl, validSharedBlog } from './community-blog';
it('detects the slash command at the caret and preserves caption boundaries', () => {
 const text='My caption /Blog sleep\nMore text';expect(blogCommand(text,22)).toEqual({start:11,end:22,search:'sleep'});
 expect(blogCommand('/Blog')).toEqual({start:0,end:5,search:''});expect(blogCommand('hello /blog körpə')).toEqual({start:6,end:17,search:'körpə'});
 expect(blogCommand('https://anacan.az/Blog')).toBeNull();expect(blogCommand('/Blog sleep\ncaption')).toBeNull();
});
it('keeps the card a validated first-party article rather than arbitrary executable OG input', () => {
 expect(validSharedBlog({id:'11111111-1111-4111-8111-111111111111',slug:'sleep',title:'Sleep'})).toBe(true);
 expect(validSharedBlog({id:'bad',slug:'../account',title:'Title'})).toBe(false);
 expect(blogImageUrl('javascript:alert(1)')).toBeNull();expect(blogImageUrl('https://user:password@example.com/a.png')).toBeNull();expect(blogImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
});
