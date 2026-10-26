export interface BlogHeading { id: string; title: string }
export function blogMarkup(value: string): string;
export function prepareBlogContent(value: string, options: {
  document: Document;
  sanitize: (html: string, options: Record<string, unknown>) => string;
  nativeCompatibility?: boolean;
}): { content: string; headings: BlogHeading[] };
