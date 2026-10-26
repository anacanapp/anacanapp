import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rememberBlog, validBlogSlug } from '@/lib/blog-links';
import { Capacitor } from '@capacitor/core';
import { lazy, Suspense } from 'react';
import StartupScreen from '@/components/StartupScreen';
const PublicBlogPage = lazy(() => import('@/public-blog/BlogPage'));

export default function BlogLink() {
  const { slug } = useParams(), navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (validBlogSlug(slug)) rememberBlog(slug);
    navigate('/', { replace: true });
  }, [slug, navigate]);
  return Capacitor.isNativePlatform() ? <StartupScreen /> : <Suspense fallback={<StartupScreen />}><PublicBlogPage /></Suspense>;
}
