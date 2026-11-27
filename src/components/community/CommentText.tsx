import { Fragment } from 'react';
import { appBlogSlug, isWebsiteBlogLink, openAppBlog } from '@/lib/blog-links';
import { inAppDeeplink, openInAppDeeplink } from '@/lib/in-app-links';

/** React text nodes retain escaping; only staff-authored HTTP(S) URLs are links. */
export default function CommentText({ content, allowLinks }: { content: string; allowLinks: boolean }) {
  const chunks = content.split(/((?:https?:\/\/|anacan:\/\/|www\.)[^\s<>]+)/gi);
  return <>{chunks.map((chunk, index) => {
    if (!/^(?:https?:\/\/|anacan:\/\/|www\.)/i.test(chunk)) return <Fragment key={index}>{chunk}</Fragment>;
    const match = /^(.*?)([.,!?;:)\]}]*)$/.exec(chunk)!;
    const text = match[1];
    try {
      const url = new URL(/^www\./i.test(text) ? `https://${text}` : text);
      if (appBlogSlug(url.href)) return <Fragment key={index}><a href={url.href} className="text-primary underline underline-offset-2 break-all"
        onClick={event => { event.preventDefault(); event.stopPropagation(); openAppBlog(url.href); }}>{text}</a>{match[2]}</Fragment>;
      if (!allowLinks && !isWebsiteBlogLink(url.href)) return <Fragment key={index}>{chunk}</Fragment>;
      // App links (https://app.anacan.az/…, anacan://…) the router knows open in the app, not the browser.
      const inApp = inAppDeeplink(url.href);
      if (inApp) return <Fragment key={index}><a href={url.href} data-in-app-link className="text-primary underline underline-offset-2 break-all"
        onClick={event => { event.preventDefault(); event.stopPropagation(); openInAppDeeplink(inApp); }}>{text}</a>{match[2]}</Fragment>;
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return <Fragment key={index}>{chunk}</Fragment>;
      return <Fragment key={index}><a href={url.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 break-all" onClick={event => event.stopPropagation()}>{text}</a>{match[2]}</Fragment>;
    } catch { return <Fragment key={index}>{chunk}</Fragment>; }
  })}</>;
}
