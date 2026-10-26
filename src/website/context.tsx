import { createContext, useContext } from 'react';
import type { WebsiteBoot, WebsiteCopyKey } from './model';
import { formatCopy } from './model';
import { sitePath, type WebsitePage } from './routes';

export const WebsiteContext = createContext<WebsiteBoot | null>(null);
export function useWebsite() {
  const boot = useContext(WebsiteContext);
  if (!boot) throw new Error('WEBSITE_CONTEXT_REQUIRED');
  const merged={...boot.copy,...boot.details};
  return { ...boot,
    t: (key:WebsiteCopyKey, values:Record<string,string|number> = {}) => formatCopy(merged,key,values),
    href: (kind:WebsitePage = 'home', slug?:string, page = 1) => boot.basePath+sitePath(boot.route.language,kind,slug,page),
  };
}
