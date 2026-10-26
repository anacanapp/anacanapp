import AdminInsightsPage from './AdminInsightsPage';
export default function AdminPremiumAnalytics({ onNavigate }: { onNavigate?: (section: string) => void }) {
  return <AdminInsightsPage premium onNavigate={onNavigate} />;
}
