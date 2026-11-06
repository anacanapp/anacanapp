import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Crown, Edit, Eye, EyeOff, KeyRound, Shield, User, UserRound, Users } from 'lucide-react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import BlockUserDialog from '@/components/moderation/BlockUserDialog';
import countriesData from '../../../countries.json';
import { countryFlag } from '@/lib/admin-insights';
import {
  AdminTabs, Avatar, Btn, DataTable, DescriptionList, EmptyState, ErrorState, Field, FieldGrid, FilterChips, Notice, Page, PageHeader, SearchInput, Section, SelectFilter,
  SideDrawer, SkeletonRows, StatusPill, Toolbar, fmtDate, fmtDateTime, fmtMinor, fmtNumber, type Column, type SortState,
} from './kit';
import { ADMIN_QUERY } from './data/rpc';
import { emptyUserFilters, fetchUserCounts, fetchUserDetail, fetchUsersPage, USERS_PAGE_SIZE, type AdminUserRow, type AppRole, type UserFilters } from './data/users';

const countries = countriesData as Array<{ isoAlpha2: string; name: string }>;
const STAGES: Record<string, { label: string; tone: 'danger' | 'violet' | 'success' | 'info' | 'neutral' }> = {
  flow: { label: 'Menstruasiya', tone: 'danger' }, bump: { label: tr('adminusers_hamilelik_e86feb', 'Hamiləlik'), tone: 'violet' },
  mommy: { label: tr('adminusers_analiq_9e762d', 'Analıq'), tone: 'success' }, partner: { label: 'Partnyor', tone: 'info' },
};
const stageLabel = (stage: string | null) => (stage && STAGES[stage]?.label) || tr('adminusers_mueyyen_edilmeyib_2d0de2', 'Müəyyən edilməyib');
const ROLE_LABEL: Record<AppRole, string> = { admin: 'Admin', moderator: 'Moderator', user: tr('adminusers_i_stifadeci_b6bdd6', 'İstifadəçi') };
const countryLabel = (code?: string | null) => { if (!code) return '—'; const item = countries.find(entry => entry.isoAlpha2 === code); return item ? `${countryFlag(code)} ${item.name}`.trim() : code; };

type Dialog = { kind: 'detail' | 'edit' | 'role' | 'password'; user: AdminUserRow } | null;

const AdminUsers = ({ onNavigate }: { onNavigate?: (section: string) => void }) => {
  const { toast } = useToast();
  const client = useQueryClient();
  const [filters, setFilters] = useState<UserFilters>(emptyUserFilters);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [blockUser, setBlockUser] = useState<AdminUserRow | null>(null);
  const update = (patch: Partial<UserFilters>) => { setFilters(previous => ({ ...previous, ...patch })); setPage(0); };

  const list = useQuery({ queryKey: ['admin-users-page', filters, page, sort], queryFn: () => fetchUsersPage(filters, page, sort), placeholderData: keepPreviousData, ...ADMIN_QUERY, staleTime: 30_000 });
  const counts = useQuery({ queryKey: ['admin-users-counts'], queryFn: fetchUserCounts, ...ADMIN_QUERY });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['admin-users-page'] }); void client.invalidateQueries({ queryKey: ['admin-user-detail'] }); };

  const columns = useMemo<Column<AdminUserRow>[]>(() => [
    { key: 'name', header: tr('adminusers_istifadeci_b6bdd6', 'İstifadəçi'), sortable: true, mobile: 'title', cell: user => (
      <span className="ak-cell-user"><Avatar name={user.name} src={user.avatar_url} /><span className="min-w-0"><span className="ak-cell-main">{user.name || 'Adsız'}</span><span className="ak-cell-sub">{user.email || '—'}</span></span></span>) },
    { key: 'stage', header: tr('adminusers_merhele_0e09aa', 'Mərhələ'), cell: user => <StatusPill tone={(user.life_stage && STAGES[user.life_stage]?.tone) || 'neutral'}>{stageLabel(user.life_stage)}</StatusPill> },
    { key: 'premium', header: 'Premium', cell: user => user.is_premium ? <StatusPill tone="accent" title={user.premium_until ? `Bitmə: ${fmtDate(user.premium_until)}` : 'Ömürlük'}>Premium</StatusPill> : <span className="ak-cell-sub">Pulsuz</span> },
    { key: 'role', header: 'Rol', cell: user => user.role === 'user' ? <span className="ak-cell-sub">{ROLE_LABEL.user}</span> : <StatusPill tone={user.role === 'admin' ? 'danger' : 'info'}>{ROLE_LABEL[user.role]}</StatusPill> },
    { key: 'country', header: 'Ölkə', cell: user => <span className="ak-cell-sub">{countryLabel(user.country_code)}</span> },
    { key: 'partner', header: 'Partner kodu', mobile: 'hidden', cell: user => <span className="ak-mono">{user.partner_code || '—'}</span> },
    { key: 'created_at', header: 'Qeydiyyat', sortable: true, align: 'end', cell: user => <span className="ak-num">{fmtDate(user.created_at)}</span> },
  ], []);

  return (
    <Page testId="admin-users">
      <PageHeader title={tr('adminusers_istifadeciler_1dd7b9', 'İstifadəçilər')} subtitle={tr('adminusers_butun_istifadecileri_idare_edin_42b284', 'Bütün istifadəçiləri idarə edin')}
        meta={counts.data && <StatusPill tone="neutral" dot={false}>{fmtNumber(counts.data.total)} {tr('adminusers_istifadeci_84a198', 'istifadəçi')}</StatusPill>}
        actions={<Btn onClick={() => onNavigate?.('subscriptions')}><Crown size={15} />Premium hüquqları</Btn>} />
      <Section flush>
        <div className="px-4 pb-3 grid gap-2.5">
          <Toolbar end={<>
            <SelectFilter label="Premium filtri" value={filters.premium} onChange={value => update({ premium: value as UserFilters['premium'] })}
              options={[{ value: 'all', label: 'Premium: hamısı' }, { value: 'premium', label: `Premium${counts.data ? ` (${fmtNumber(counts.data.premium)})` : ''}` }, { value: 'free', label: 'Pulsuz' }]} />
            <SelectFilter label="Rol filtri" value={filters.role} onChange={value => update({ role: value as UserFilters['role'] })}
              options={[{ value: 'all', label: 'Rol: hamısı' }, { value: 'admin', label: 'Admin' }, { value: 'moderator', label: 'Moderator' }]} />
            <SelectFilter label="Ölkə filtri" value={filters.country} onChange={value => update({ country: value })}
              options={[{ value: '', label: 'Ölkə: hamısı' }, ...countries.map(item => ({ value: item.isoAlpha2, label: `${countryFlag(item.isoAlpha2)} ${item.name}`.trim() }))]} />
          </>}>
            <SearchInput value={filters.search} onChange={value => update({ search: value })} placeholder={tr('adminusers_ad_ve_ya_email_ile_axtar_335c5a', 'Ad və ya email ilə axtar...')} label="İstifadəçi axtar" />
          </Toolbar>
          <FilterChips label="Mərhələ" value={filters.stage} onChange={value => update({ stage: value })}
            options={[{ value: 'all', label: 'Hamısı' }, ...Object.entries(STAGES).map(([value, item]) => ({ value, label: item.label })), { value: 'none', label: 'Seçilməyib' }]} />
        </div>
        <DataTable testId="admin-users-table" rowTestId="admin-user-row" columns={columns} rows={list.data?.rows} rowKey={user => user.id}
          loading={list.isLoading} fetching={list.isFetching && !list.isLoading} error={list.isError ? list.error : null} onRetry={() => void list.refetch()}
          page={page} total={list.data?.total ?? 0} pageSize={USERS_PAGE_SIZE} onPageChange={setPage} sort={sort} onSortChange={next => { setSort(next); setPage(0); }}
          onRowClick={user => setDialog({ kind: 'detail', user })}
          empty={<EmptyState icon={<Users size={20} />} title={tr('adminusers_i_stifadeci_tapilmadi_4e2156', 'İstifadəçi tapılmadı')} description="Filtrləri dəyişin və ya axtarışı təmizləyin." />}
          actions={[
            { label: 'Ətraflı', icon: <UserRound size={14} />, onSelect: user => setDialog({ kind: 'detail', user }) },
            { label: tr('adminusers_redakte_et_66cf3b', 'Redaktə et'), icon: <Edit size={14} />, onSelect: user => setDialog({ kind: 'edit', user }) },
            { label: tr('adminusers_rol_teyin_et_41b431', 'Rol təyin et'), icon: <Shield size={14} />, onSelect: user => setDialog({ kind: 'role', user }) },
            { label: tr('adminusers_sifreni_deyis_a48972', 'Şifrəni dəyiş'), icon: <KeyRound size={14} />, onSelect: user => setDialog({ kind: 'password', user }) },
            { label: tr('adminusers_blokla', 'Blokla'), icon: <Ban size={14} />, danger: true, separatorBefore: true, onSelect: user => setBlockUser(user) },
          ]} />
      </Section>

      {dialog?.kind === 'detail' && <UserDetailDrawer user={dialog.user} onClose={() => setDialog(null)} onAction={kind => kind === 'block' ? setBlockUser(dialog.user) : setDialog({ kind, user: dialog.user })} onNavigate={onNavigate} />}
      {dialog?.kind === 'edit' && <EditUserDrawer user={dialog.user} onClose={() => setDialog(null)} onSaved={refresh} toast={toast} />}
      {dialog?.kind === 'role' && <RoleDrawer user={dialog.user} onClose={() => setDialog(null)} onSaved={refresh} toast={toast} />}
      {dialog?.kind === 'password' && <PasswordDrawer user={dialog.user} onClose={() => setDialog(null)} toast={toast} />}
      {/* İstifadəçini blokla (community/tam, müddət + səbəb) */}
      <BlockUserDialog open={!!blockUser} onOpenChange={open => { if (!open) setBlockUser(null); }} userId={blockUser?.user_id || null} userName={blockUser?.name || null} />
    </Page>
  );
};

type ToastFn = ReturnType<typeof useToast>['toast'];

function UserDetailDrawer({ user, onClose, onAction, onNavigate }: { user: AdminUserRow; onClose: () => void; onAction: (kind: 'edit' | 'role' | 'password' | 'block') => void; onNavigate?: (section: string) => void }) {
  const [tab, setTab] = useState<'profile' | 'subscription' | 'children' | 'roles'>('profile');
  const detail = useQuery({ queryKey: ['admin-user-detail', user.user_id], queryFn: () => fetchUserDetail(user.user_id), ...ADMIN_QUERY });
  const profile = (detail.data?.profile ?? user) as Record<string, unknown>;
  const text = (key: string) => (profile[key] === null || profile[key] === undefined || profile[key] === '' ? '—' : String(profile[key]));
  return (
    <SideDrawer open onOpenChange={open => { if (!open) onClose(); }} size="lg" testId="admin-user-drawer"
      title={<span className="flex items-center gap-2.5"><Avatar name={user.name} src={user.avatar_url} size={34} /><span className="min-w-0"><span className="block truncate">{user.name || 'Adsız'}</span><span className="ak-cell-sub">{user.email || '—'}</span></span></span>}
      footer={<>
        <Btn onClick={() => onAction('edit')}><Edit size={14} />Redaktə</Btn>
        <Btn onClick={() => onAction('role')}><Shield size={14} />Rol</Btn>
        <Btn onClick={() => onAction('password')}><KeyRound size={14} />Şifrə</Btn>
        <Btn variant="danger" onClick={() => onAction('block')}><Ban size={14} />Blokla</Btn>
      </>}>
      <AdminTabs value={tab} onChange={setTab} items={[{ value: 'profile', label: 'Profil' }, { value: 'subscription', label: 'Abunəlik' },
        { value: 'children', label: 'Uşaqlar', count: detail.data?.children.length }, { value: 'roles', label: 'Rollar' }]} />
      {detail.isError && <ErrorState compact onRetry={() => void detail.refetch()} />}
      {tab === 'profile' && <DescriptionList items={[
        ['Mərhələ', <StatusPill key="s" tone={(user.life_stage && STAGES[user.life_stage]?.tone) || 'neutral'}>{stageLabel(user.life_stage)}</StatusPill>],
        ['Ölkə', countryLabel(user.country_code)], ['Qeydiyyat', fmtDateTime(user.created_at)],
        ['Son aktivlik', detail.isLoading ? '…' : fmtDateTime(detail.data?.last_seen ?? null)],
        ['Doğuş tarixi (təxmini)', text('due_date')], ['Körpənin doğum tarixi', text('baby_birth_date')], ['Partner kodu', <span key="p" className="ak-mono">{user.partner_code || '—'}</span>],
        ['Sifarişlər', detail.data?.orders ?? '—'], ['Dəstək müraciətləri', detail.data?.support_tickets ?? '—'],
        ['QayğıCash balansı', detail.data?.qaygicash ? `${fmtMinor(detail.data.qaygicash.available_minor)} · gözləmədə ${fmtMinor(detail.data.qaygicash.pending_minor)}` : '—'],
        ['User ID', <span key="u" className="ak-mono">{user.user_id}</span>],
      ]} />}
      {tab === 'subscription' && (
        <div className="grid gap-3">
          <DescriptionList items={[
            ['Premium', user.is_premium ? <StatusPill key="p" tone="accent">Aktiv</StatusPill> : 'Pulsuz'],
            ['Premium bitmə', user.is_premium ? (user.premium_until ? fmtDate(user.premium_until) : 'Ömürlük / mağaza') : '—'], ['Nişan', user.badge_type || '—'],
          ]} />
          {detail.isLoading ? <SkeletonRows rows={2} columns={3} /> : detail.data?.subscriptions.length ? (
            <div className="grid gap-2">{detail.data.subscriptions.map((sub, index) => (
              <div key={String(sub.id ?? index)} className="ak-card-row">
                <div className="flex items-center gap-2 flex-wrap"><strong>{String(sub.plan_type ?? sub.product_id ?? 'Plan')}</strong><StatusPill tone={sub.status === 'active' ? 'success' : sub.status === 'cancelled' ? 'warning' : 'neutral'}>{String(sub.status ?? '—')}</StatusPill>{sub.is_trial ? <StatusPill tone="info">Trial</StatusPill> : null}</div>
                <p className="ak-cell-sub mt-1">Başlanğıc {fmtDate(sub.started_at as string)} · bitmə {fmtDate(sub.expires_at as string)}{sub.cancelled_at ? ` · ləğv ${fmtDate(sub.cancelled_at as string)}` : ''}</p>
              </div>))}</div>
          ) : <EmptyState compact title="Mağaza abunəliyi qeydə alınmayıb" description={detail.data?.source === 'fallback' ? 'admin_user_detail_v1 tətbiq olunanda tam tarixçə görünəcək.' : undefined} />}
          <Btn onClick={() => onNavigate?.('subscriptions')}><Crown size={14} />Premium ver / ləğv et</Btn>
        </div>
      )}
      {tab === 'children' && (detail.isLoading ? <SkeletonRows rows={2} columns={3} /> : detail.data?.children.length ? (
        <div className="grid gap-2">{detail.data.children.map(child => (
          <div key={child.id} className="ak-card-row flex items-center justify-between gap-3">
            <span><strong>{child.name}</strong><span className="ak-cell-sub">{child.birth_date ? `Doğum: ${fmtDate(child.birth_date)}` : child.due_date ? `Gözlənilən: ${fmtDate(child.due_date)}` : '—'}{child.gender ? ` · ${child.gender === 'girl' || child.gender === 'female' ? 'qız' : child.gender === 'boy' || child.gender === 'male' ? 'oğlan' : child.gender}` : ''}</span></span>
            {child.is_active === false && <StatusPill>Arxiv</StatusPill>}
          </div>))}</div>
      ) : <EmptyState compact title="Uşaq profili yoxdur" />)}
      {tab === 'roles' && (
        <div className="grid gap-3">
          <div className="flex gap-2 flex-wrap">{(detail.data?.roles.length ? detail.data.roles : [user.role]).map(role => <StatusPill key={role} tone={role === 'admin' ? 'danger' : role === 'moderator' ? 'info' : 'neutral'}>{ROLE_LABEL[role as AppRole] ?? role}</StatusPill>)}</div>
          <Btn onClick={() => onAction('role')}><Shield size={14} />Rolu dəyiş</Btn>
        </div>
      )}
    </SideDrawer>
  );
}

function EditUserDrawer({ user, onClose, onSaved, toast }: { user: AdminUserRow; onClose: () => void; onSaved: () => void; toast: ToastFn }) {
  const [name, setName] = useState(user.name ?? ''), [stage, setStage] = useState(user.life_stage || '');
  const [saving, setSaving] = useState(false);
  const dirty = name !== (user.name ?? '') || stage !== (user.life_stage || '');
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ name, life_stage: stage || null }).eq('id', user.id);
      if (error) throw error;
      toast({ title: tr('adminusers_ugurlu_7fe64c', 'Uğurlu'), description: tr('adminusers_i_stifadeci_melumatlari_yenile_b7069b', 'İstifadəçi məlumatları yeniləndi') });
      onSaved(); onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({ title: tr('adminusers_xeta_3cdbb6', 'Xəta'), description: tr('adminusers_istifadeci_yenilene_bilmedi_62887d', 'İstifadəçi yenilənə bilmədi'), variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return (
    <SideDrawer open onOpenChange={open => { if (!open) onClose(); }} title={tr('adminusers_istifadecini_redakte_et_f6c153', 'İstifadəçini Redaktə Et')} description={user.email ?? undefined}
      dirty={dirty} saving={saving} onSave={save} saveDisabled={!dirty}>
      <Field label="Ad">{id => <input id={id} className="ak-input" value={name} onChange={event => setName(event.target.value)} />}</Field>
      <Field label={tr('adminusers_merhele_0e09aa', 'Mərhələ')}>{id => (
        <select id={id} className="ak-select w-full" value={stage} onChange={event => setStage(event.target.value)}>
          <option value="" disabled>{tr('adminusers_merhele_secin_a3f9bb', 'Mərhələ seçin')}</option>
          {Object.entries(STAGES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>)}</Field>
    </SideDrawer>
  );
}

function RoleDrawer({ user, onClose, onSaved, toast }: { user: AdminUserRow; onClose: () => void; onSaved: () => void; toast: ToastFn }) {
  const [role, setRole] = useState<AppRole>(user.role), [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      // Same write as before: update the existing role row, or insert one if the user has none.
      const { data: existing, error: readError } = await supabase.from('user_roles').select('user_id').eq('user_id', user.user_id).limit(1);
      if (readError) throw readError;
      if (existing?.length) {
        const { error } = await supabase.from('user_roles').update({ role }).eq('user_id', user.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert([{ user_id: user.user_id, role }]);
        if (error) throw error;
      }
      toast({ title: tr('adminusers_ugurlu_7fe64c', 'Uğurlu'), description: `${user.name} üçün ${ROLE_LABEL[role]} rolu təyin edildi` });
      onSaved(); onClose();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast({ title: tr('adminusers_xeta_3cdbb6', 'Xəta'), description: tr('adminusers_rol_teyin_edile_bilmedi_8ddf00', 'Rol təyin edilə bilmədi'), variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return (
    <SideDrawer open onOpenChange={open => { if (!open) onClose(); }} title={tr('adminusers_rol_teyin_et_ec751c', 'Rol Təyin Et')} description={`${user.name} · ${user.email ?? ''}`}
      dirty={role !== user.role} saving={saving} onSave={save} saveLabel={tr('adminusers_rolu_teyin_et_e61864', 'Rolu Təyin Et')} saveDisabled={role === user.role}>
      <div className="grid gap-2" role="radiogroup" aria-label={tr('adminusers_rol_secin_7dccbd', 'Rol seçin')}>
        {([['user', <User key="u" size={16} />], ['moderator', <Shield key="m" size={16} />], ['admin', <Crown key="a" size={16} />]] as Array<[AppRole, JSX.Element]>).map(([value, icon]) => (
          <label key={value} className="ak-card-row flex items-center gap-3 cursor-pointer" data-selected={role === value}>
            <input type="radio" name="role" className="ak-check" checked={role === value} onChange={() => setRole(value)} />{icon}<strong>{ROLE_LABEL[value]}</strong>
          </label>
        ))}
      </div>
      <Notice tone="warning">{tr('adminusers_admin_rollu_istifadeciler_butu_789e17', '⚠️ Admin rollu istifadəçilər bütün sistem funksiyalarına tam giriş əldə edəcək.')}</Notice>
    </SideDrawer>
  );
}

function PasswordDrawer({ user, onClose, toast }: { user: AdminUserRow; onClose: () => void; toast: ToastFn }) {
  const [newPassword, setNewPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState(''), [show, setShow] = useState(false), [saving, setSaving] = useState(false);
  const mismatch = !!confirmPassword && newPassword !== confirmPassword, short = !!newPassword && newPassword.length < 8;
  const save = async () => {
    if (newPassword.length < 8) { toast({ title: tr('adminusers_xeta_3cdbb6', 'Xəta'), description: tr('adminusers_sifre_en_azi_8_simvol_olmalidir_f7dd87', 'Şifrə ən azı 8 simvol olmalıdır'), variant: 'destructive' }); return; }
    if (newPassword !== confirmPassword) { toast({ title: tr('adminusers_xeta_3cdbb6', 'Xəta'), description: tr('adminusers_sifreler_uygun_gelmir_af4b84', 'Şifrələr uyğun gəlmir'), variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-change-user-password', { body: { user_id: user.user_id, new_password: newPassword } });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
      toast({ title: tr('adminusers_ugurlu_7fe64c', 'Uğurlu'), description: `${user.name} üçün şifrə yeniləndi` });
      setNewPassword(''); setConfirmPassword(''); onClose();
    } catch (err) {
      console.error('Error changing password:', err);
      toast({ title: tr('adminusers_xeta_3cdbb6', 'Xəta'), description: (err as Error)?.message || tr('adminusers_sifre_yenilene_bilmedi_4ba698', 'Şifrə yenilənə bilmədi'), variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return (
    <SideDrawer open onOpenChange={open => { if (!open) onClose(); }} title={tr('adminusers_istifadecinin_sifresini_deyis_15d6c7', 'İstifadəçinin şifrəsini dəyiş')} description={`${user.name} · ${user.email ?? ''}`}
      dirty={!!newPassword || !!confirmPassword} saving={saving} onSave={save} saveLabel={saving ? tr('adminusers_yenilenir_3017dc', 'Yenilənir...') : tr('adminusers_sifreni_deyis_1d1a1f', 'Şifrəni Dəyiş')}
      saveDisabled={!newPassword || !confirmPassword}>
      <Field label={tr('adminusers_yeni_sifre_8f04c6', 'Yeni şifrə')} error={short ? 'Ən azı 8 simvol' : undefined}>{id => (
        <div className="relative">
          <input id={id} className="ak-input pe-10" type={show ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder={tr('adminusers_en_azi_8_simvol_168104', 'Ən azı 8 simvol')} />
          <button type="button" className="ak-icon-btn absolute end-1 top-1/2 -translate-y-1/2" aria-label={show ? 'Gizlət' : 'Göstər'} onClick={() => setShow(!show)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>)}</Field>
      <Field label={tr('adminusers_sifreni_tesdiqle_6b3e17', 'Şifrəni təsdiqlə')} error={mismatch ? tr('adminusers_sifreler_uygun_gelmir_af4b84', 'Şifrələr uyğun gəlmir') : undefined}>{id => (
        <input id={id} className="ak-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder={tr('adminusers_yeni_sifreni_tekrar_daxil_edin_3c87dd', 'Yeni şifrəni təkrar daxil edin')} />)}</Field>
      <Notice tone="warning">{tr('adminusers_i_stifadeci_yeni_sifre_ile_yen_60d0cc', '⚠️ İstifadəçi yeni şifrə ilə yenidən daxil olmalı olacaq.')}</Notice>
    </SideDrawer>
  );
}

export default AdminUsers;
