import { useNavigate, useParams } from 'react-router-dom';
import AdminPanel, { isAdminSection } from '@/components/AdminPanel';
export default function AdminPage() {
  const { section = 'dashboard' } = useParams(), navigate = useNavigate();
  return <AdminPanel initialTab={isAdminSection(section) ? section : 'dashboard'} onExit={() => navigate('/?web=admin')}
    onSectionChange={value => navigate(`/admin/${value === 'premium-analytics' ? 'premium' : value}?web=admin`)} />;
}
