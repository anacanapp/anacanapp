import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AdminPanel from '@/components/AdminPanel';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function AdmobAdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!user || !isAdmin) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><ShieldCheck size={34} className="text-primary" /><h1 className="text-xl font-semibold">Reklam idarəetməsi</h1><p className="max-w-sm text-sm text-muted-foreground">Bu bölmə administrator hesabı ilə açılır. Əsas səhifədən hesabınıza daxil olub bu ünvana qayıdın.</p><Button onClick={() => navigate('/')}>Əsas səhifəni aç</Button></div>;
  return <AdminPanel initialTab="admob" onExit={() => navigate('/')} />;
}
