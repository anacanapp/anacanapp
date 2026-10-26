import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { BrandAuthProvider } from './Auth';
import { getBrandClient, brandBackendConfig, brandAuthStorageKey } from './client';
import BrandPortal from './Portal';
import '@/styles/brand-ads.css';

export function startBrandPortal() {
  const client = getBrandClient();
  const backend = brandBackendConfig(import.meta.env);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  document.body.classList.add('brand-web-root');
  const element = document.getElementById('root');
  if (!element) throw new Error('BRAND_PORTAL_ROOT_MISSING');
  createRoot(element).render(<QueryClientProvider client={queries}><BrandAuthProvider client={client}
    backendOrigin={backend.url} storageKey={brandAuthStorageKey(backend.url)} reportBackend={backend.reportBackend}>
    <BrowserRouter basename="/brands"><BrandPortal /></BrowserRouter>
  </BrandAuthProvider></QueryClientProvider>);
}
