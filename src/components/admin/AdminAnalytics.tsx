import AdminInsightsPage from './AdminInsightsPage';
export default function AdminAnalytics({ onNavigate }: { onNavigate?: (section: string) => void }) {
  return <AdminInsightsPage onNavigate={onNavigate} />;
}
