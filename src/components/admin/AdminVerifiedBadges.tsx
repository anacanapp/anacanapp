import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays, addMonths, addYears } from 'date-fns';
import { VerifiedTick, isVerifiedActive } from '../community/UserBadge';

interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  verified_until: string | null;
}

type DurationOption = '7_days' | '1_month' | '3_months' | '1_year' | 'permanent';

const AdminVerifiedBadges = () => {
  const { toast } = useToast();
  const [emailQuery, setEmailQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [foundUser, setFoundUser] = useState<ProfileRow | null>(null);
  const [duration, setDuration] = useState<DurationOption>('permanent');
  const [saving, setSaving] = useState(false);

  const [verifiedList, setVerifiedList] = useState<ProfileRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // NOT: `is_verified`/`verified_until` supabase/duzelis/Duzelis10.sql ilə əlavə
  // olunub — istifadəçi bu SQL-i işlətmədən öncə (və generated types.ts yenilənmədən
  // öncə) TS bu sütunları tanımır, ona görə `as any` ilə keçirik (kodun özü isə
  // tam düzgündür, real DB-də bu sütunlar mövcud olan kimi işləyəcək).
  const fetchVerifiedList = async () => {
    setLoadingList(true);
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('id, user_id, name, email, avatar_url, is_verified, verified_until')
      .eq('is_verified', true)
      .order('name', { ascending: true });
    if (!error) setVerifiedList((data || []) as ProfileRow[]);
    setLoadingList(false);
  };

  useEffect(() => {
    fetchVerifiedList();
  }, []);

  const handleSearch = async () => {
    const email = emailQuery.trim().toLowerCase();
    if (!email) return;
    setSearching(true);
    setSearched(false);
    setFoundUser(null);
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('id, user_id, name, email, avatar_url, is_verified, verified_until')
      .ilike('email', email)
      .maybeSingle();
    setSearching(false);
    setSearched(true);
    if (error) {
      toast({ title: 'Xəta', description: error.message, variant: 'destructive' });
      return;
    }
    setFoundUser((data as ProfileRow) || null);
    setDuration('permanent');
  };

  const grantVerified = async () => {
    if (!foundUser) return;
    setSaving(true);
    const now = new Date();
    let verifiedUntil: string | null = null;
    switch (duration) {
      case '7_days': verifiedUntil = addDays(now, 7).toISOString(); break;
      case '1_month': verifiedUntil = addMonths(now, 1).toISOString(); break;
      case '3_months': verifiedUntil = addMonths(now, 3).toISOString(); break;
      case '1_year': verifiedUntil = addYears(now, 1).toISOString(); break;
      case 'permanent': verifiedUntil = null; break;
    }

    const { error } = await (supabase as any)
      .from('profiles')
      .update({ is_verified: true, verified_until: verifiedUntil })
      .eq('id', foundUser.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Xəta', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Uğurlu ✅', description: `${foundUser.name} üçün mavi tik verildi` });
    setFoundUser({ ...foundUser, is_verified: true, verified_until: verifiedUntil });
    fetchVerifiedList();
  };

  const revokeVerified = async (u: ProfileRow) => {
    if (!confirm(`${u.name} üçün mavi tiki ləğv etmək istəyirsiniz?`)) return;
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ is_verified: false, verified_until: null })
      .eq('id', u.id);

    if (error) {
      toast({ title: 'Xəta', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Ləğv edildi' });
    if (foundUser?.id === u.id) setFoundUser({ ...u, is_verified: false, verified_until: null });
    fetchVerifiedList();
  };

  const durationLabel: Record<DurationOption, string> = {
    '7_days': '7 gün',
    '1_month': '1 ay',
    '3_months': '3 ay',
    '1_year': '1 il',
    permanent: 'Daimi',
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,149,246,0.12)' }}>
          <VerifiedTick size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mavi Tik</h1>
          <p className="text-sm text-muted-foreground">Community-də təsdiqlənmiş hesab nişanı (Instagram tipli)</p>
        </div>
      </div>

      {/* Search by email */}
      <div className="bg-card rounded-xl p-5 border border-border mb-6">
        <p className="text-sm font-medium mb-3">İstifadəçini email ilə tapın</p>
        <div className="flex gap-2">
          <Input
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            placeholder="istifadeci@nümunə.com"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching || !emailQuery.trim()}>
            {searching ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Search className="w-4 h-4 me-2" />}
            Axtar
          </Button>
        </div>

        {searched && !foundUser &&
        <p className="text-sm text-destructive mt-3">Bu email ilə istifadəçi tapılmadı</p>
        }

        {foundUser &&
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0 overflow-hidden">
                {foundUser.avatar_url ?
              <img src={foundUser.avatar_url} alt="" className="w-full h-full object-cover" /> :
              (foundUser.name?.charAt(0) || '?').toUpperCase()
              }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold truncate">{foundUser.name}</p>
                  {isVerifiedActive(foundUser.is_verified, foundUser.verified_until) && <VerifiedTick size={15} />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{foundUser.email}</p>
              </div>
            </div>

            {foundUser.is_verified ?
          <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {foundUser.verified_until ?
              `Bitmə tarixi: ${format(new Date(foundUser.verified_until), 'dd.MM.yyyy')}` :
              'Daimi mavi tik'}
                </p>
                <Button variant="destructive" size="sm" onClick={() => revokeVerified(foundUser)}>
                  <X className="w-4 h-4 me-1" /> Ləğv et
                </Button>
              </div> :

          <div className="flex items-center gap-2">
                <Select value={duration} onValueChange={(v: any) => setDuration(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(durationLabel) as DurationOption[]).map((d) =>
                <SelectItem key={d} value={d}>{durationLabel[d]}</SelectItem>
                )}
                  </SelectContent>
                </Select>
                <Button onClick={grantVerified} disabled={saving} style={{ background: '#0095F6' }} className="text-white hover:opacity-90 flex-shrink-0">
                  {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <VerifiedTick size={14} className="me-2" />}
                  Mavi Tik Ver
                </Button>
              </div>
          }
          </motion.div>
        }
      </div>

      {/* Currently verified users */}
      <div>
        <h2 className="text-base font-bold mb-3">Təsdiqlənmiş istifadəçilər ({verifiedList.length})</h2>
        {loadingList ?
        <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div> :
        verifiedList.length === 0 ?
        <p className="text-sm text-muted-foreground">Hələ heç bir istifadəçiyə mavi tik verilməyib</p> :

        <div className="space-y-2">
            {verifiedList.map((u) =>
          <div key={u.id} className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary flex-shrink-0 overflow-hidden">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.name?.charAt(0) || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <VerifiedTick size={13} />
                    {!isVerifiedActive(u.is_verified, u.verified_until) &&
                <span className="text-[10px] font-bold text-destructive/70">(bitib)</span>
                }
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.verified_until ? `Bitmə: ${format(new Date(u.verified_until), 'dd.MM.yyyy')}` : 'Daimi'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => revokeVerified(u)} className="text-destructive flex-shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
          )}
          </div>
        }
      </div>
    </div>
  );
};

export default AdminVerifiedBadges;
