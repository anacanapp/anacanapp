import { lazy, Suspense, useState } from 'react';
import { Activity, Baby, Clock, Heart, Moon, Zap } from 'lucide-react';
import { tr } from '@/lib/tr';
import { AdminTabs, Page, PageHeader, Section, SkeletonRows } from './kit';
import AdminNotificationCampaigns from './AdminNotificationCampaigns';

// Each tab is its own chunk (the old single file was 2 168 lines); only the open tab is loaded and mounted.
const ScheduledNotificationsTab = lazy(() => import('./push/ScheduledNotificationsTab'));
const PregnancyDayNotificationsTab = lazy(() => import('./push/PregnancyDayNotificationsTab'));
const MommyDayNotificationsTab = lazy(() => import('./push/MommyDayNotificationsTab'));
const FlowRemindersTab = lazy(() => import('./push/FlowRemindersTab'));
const BulkTimeManager = lazy(() => import('./BulkTimeManager'));
const NotificationOpsCard = lazy(() => import('./NotificationOpsCard'));
const PushDiagnosticsCard = lazy(() => import('./PushDiagnosticsCard'));

type Tab = 'bulk' | 'scheduled' | 'pregnancy' | 'mommy' | 'flow' | 'time-manager' | 'diagnostics';
const fallback = <Section><SkeletonRows rows={6} columns={4} /></Section>;

const AdminPushNotifications = () => {
  const [activeTab, setActiveTab] = useState<Tab>('bulk');
  return (
    <Page testId="admin-push">
      <PageHeader title={tr('adminpushnotifications_push_bildirisleri_c44832', 'Push Bildirişləri')}
        subtitle={tr('adminpushnotifications_butun_push_notification_sistem_ab314e', 'Bütün push notification sistemini buradan idarə edin')} />
      <AdminTabs value={activeTab} onChange={setActiveTab} label="Bildiriş bölmələri" items={[
        { value: 'bulk', label: 'Kampaniyalar', icon: <Zap size={14} /> },
        { value: 'scheduled', label: tr('adminpushnotifications_gundelik_a7880f', 'Gündəlik'), icon: <Clock size={14} /> },
        { value: 'pregnancy', label: tr('adminpushnotifications_hamilelik_e86feb', 'Hamiləlik'), icon: <Baby size={14} /> },
        { value: 'mommy', label: 'Ana', icon: <Heart size={14} /> },
        { value: 'flow', label: 'Flow', icon: <Moon size={14} /> },
        { value: 'time-manager', label: tr('adminpushnotifications_saat_deyis_a9b025', 'Saat dəyiş.'), icon: <Clock size={14} /> },
        { value: 'diagnostics', label: 'Diaqnostika', icon: <Activity size={14} /> },
      ]} />
      <Suspense fallback={fallback}>
        {activeTab === 'bulk' && <AdminNotificationCampaigns />}
        {activeTab === 'scheduled' && <ScheduledNotificationsTab />}
        {activeTab === 'pregnancy' && <PregnancyDayNotificationsTab />}
        {activeTab === 'mommy' && <MommyDayNotificationsTab />}
        {activeTab === 'flow' && <FlowRemindersTab />}
        {activeTab === 'time-manager' && <BulkTimeManager />}
        {activeTab === 'diagnostics' && (
          <Section title="Bildiriş servisi və cihaz diaqnostikası" description="Servis vəziyyəti, son işləmələr və cihaz tokenləri">
            <div className="grid gap-4"><NotificationOpsCard /><PushDiagnosticsCard /></div>
          </Section>
        )}
      </Suspense>
    </Page>
  );
};

export default AdminPushNotifications;
