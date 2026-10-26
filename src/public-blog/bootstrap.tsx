import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BlogPage from './BlogPage';
import { APP_LANGUAGES } from '@/lib/app-languages';

export function startPublicBlog() {
  document.documentElement.classList.add('anacan-public-blog');
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes>
    <Route path="/blog" element={<BlogPage />} />
    {APP_LANGUAGES.map(language => <Route key={language.code} path={`/blog/${language.code}`} element={<BlogPage indexLanguage={language.code} />} />)}
    <Route path="/blog/:slug" element={<BlogPage />} />
    <Route path="/blog/:language/:slug" element={<BlogPage />} />
  </Routes></BrowserRouter>);
}
