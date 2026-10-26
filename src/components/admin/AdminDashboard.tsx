import AdminInsightsPage from './AdminInsightsPage';
export default function AdminDashboard({ onNavigate }: { onNavigate?: (section: string) => void }) {
  return <AdminInsightsPage onNavigate={onNavigate} />;
}
