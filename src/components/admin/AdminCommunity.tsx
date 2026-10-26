import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Users, Plus, Search, Edit2, Trash2, Save, X,
  Filter, Eye, EyeOff } from
'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AdminUsageStats from './AdminUsageStats';

interface AdminGroup {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  cover_image_url: string | null;
  icon_emoji: string | null;
  is_active: boolean;
  is_auto_join: boolean;
  auto_join_criteria: Record<string, any> | null;
  member_count: number;
  created_at: string;
}

const GROUP_TYPES = [
{ value: 'birth_month', label: tr("admincommunity_dogum_ayi_47ddbd", "Doğum ayı") },
{ value: 'gender', label: 'Cins' },
{ value: 'multiples', label: tr("admincommunity_ekizler_14f521", "Əkizlər") },
{ value: 'pregnancy_month', label: tr("admincommunity_hamilelik_ayi_f43286", "Hamiləlik ayı") },
{ value: 'general', label: tr("admincommunity_umumi_1b5521", "Ümumi") }];


const AdminCommunity = () => {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Community header texts per life stage
  const [headerTexts, setHeaderTexts] = useState({
    flow: '',
    bump: '',
    mommy: ''
  });
  const [headerSaving, setHeaderSaving] = useState(false);

  useEffect(() => {
    const fetchHeaders = async () => {
      const { data } = await supabase.
      from('app_settings').
      select('*').
      in('key', ['community_header_flow', 'community_header_bump', 'community_header_mommy']);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s: any) => {
          const stage = s.key.replace('community_header_', '');
          map[stage] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        });
        setHeaderTexts({
          flow: map.flow || '',
          bump: map.bump || '',
          mommy: map.mommy || ''
        });
      }
    };
    fetchHeaders();
  }, []);

  const saveHeaders = async () => {
    setHeaderSaving(true);
    try {
      for (const stage of ['flow', 'bump', 'mommy'] as const) {
        await supabase.
        from('app_settings').
        update({ value: headerTexts[stage] }).
        eq('key', `community_header_${stage}`);
      }
      toast({ title: tr("admincommunity_basliq_metnleri_yenilendi_e71981", "Başlıq mətnləri yeniləndi ✓") });
    } catch {
      toast({ title: tr("admincommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } finally {
      setHeaderSaving(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    group_type: 'general',
    icon_emoji: '👥',
    is_active: true,
    is_auto_join: false,
    auto_join_criteria: {} as Record<string, any>
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase.
      from('community_groups').
      select('*').
      order('group_type', { ascending: true }).
      order('name', { ascending: true });

      if (error) throw error;
      setGroups(data as AdminGroup[] || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({ title: tr("admincommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      description: '',
      group_type: 'general',
      icon_emoji: '👥',
      is_active: true,
      is_auto_join: false,
      auto_join_criteria: {}
    });
    setIsModalOpen(true);
  };

  const openEditModal = (group: AdminGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      group_type: group.group_type,
      icon_emoji: group.icon_emoji || '👥',
      is_active: group.is_active,
      is_auto_join: group.is_auto_join,
      auto_join_criteria: group.auto_join_criteria || {}
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: tr("admincommunity_qrup_adi_teleb_olunur_adfa43", "Qrup adı tələb olunur"), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingGroup) {
        // Update
        const { error } = await supabase.
        from('community_groups').
        update({
          name: formData.name,
          description: formData.description || null,
          group_type: formData.group_type,
          icon_emoji: formData.icon_emoji,
          is_active: formData.is_active,
          is_auto_join: formData.is_auto_join,
          auto_join_criteria: formData.auto_join_criteria,
          updated_at: new Date().toISOString()
        }).
        eq('id', editingGroup.id);

        if (error) throw error;
        toast({ title: tr("admincommunity_qrup_yenilendi_d0267d", "Qrup yeniləndi ✅") });
      } else {
        // Create
        const { error } = await supabase.
        from('community_groups').
        insert({
          name: formData.name,
          description: formData.description || null,
          group_type: formData.group_type,
          icon_emoji: formData.icon_emoji,
          is_active: formData.is_active,
          is_auto_join: formData.is_auto_join,
          auto_join_criteria: formData.auto_join_criteria
        });

        if (error) throw error;
        toast({ title: tr("admincommunity_qrup_yaradildi_071e0d", "Qrup yaradıldı ✅") });
      }

      setIsModalOpen(false);
      fetchGroups();
    } catch (error) {
      console.error('Error saving group:', error);
      toast({ title: tr("admincommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm(tr("admincommunity_bu_qrupu_silmek_istediyinize_e_b145db", "Bu qrupu silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;

    try {
      const { error } = await supabase.
      from('community_groups').
      delete().
      eq('id', groupId);

      if (error) throw error;
      toast({ title: 'Qrup silindi' });
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({ title: tr("admincommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const toggleActive = async (group: AdminGroup) => {
    try {
      const { error } = await supabase.
      from('community_groups').
      update({ is_active: !group.is_active, updated_at: new Date().toISOString() }).
      eq('id', group.id);

      if (error) throw error;
      fetchGroups();
    } catch (error) {
      console.error('Error toggling active:', error);
      toast({ title: tr("admincommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const filteredGroups = groups.filter((group) => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || group.group_type === filterType;
    return matchesSearch && matchesType;
  });

  const groupsByType = filteredGroups.reduce((acc, group) => {
    if (!acc[group.group_type]) acc[group.group_type] = [];
    acc[group.group_type].push(group);
    return acc;
  }, {} as Record<string, AdminGroup[]>);

  return (
    <div className="space-y-6">
      {/* Community Header Texts per Life Stage */}
      <Card className="p-4">
        <h3 className="font-bold text-foreground mb-3">{tr("admincommunity_cemiyyet_basliq_metnleri_fazalara_gore_aa4c16", "📝 Cəmiyyət Başlıq Mətnləri (Fazalara görə)")}</h3>
        <div className="space-y-3">
          {[
          { key: 'flow' as const, label: '🩸 Menstruasiya', placeholder: tr("admincommunity_diger_qadinlar_ile_elaqede_olun_c330c7", "Digər qadınlar ilə əlaqədə olun") },
          { key: 'bump' as const, label: tr("admincommunity_hamilelik_c61caf", "🤰 Hamiləlik"), placeholder: tr("admincommunity_diger_hamile_analar_ile_elaqede_olun_1ad833", "Digər hamilə analar ilə əlaqədə olun") },
          { key: 'mommy' as const, label: tr("admincommunity_analiq_e28953", "👩‍👧 Analıq"), placeholder: tr("admincommunity_diger_analar_ile_elaqede_olun_4830a3", "Digər analar ilə əlaqədə olun") }].
          map((stage) =>
          <div key={stage.key} className="flex items-center gap-3">
              <span className="text-sm font-medium w-32 flex-shrink-0">{stage.label}</span>
              <Input
              value={headerTexts[stage.key]}
              onChange={(e) => setHeaderTexts((prev) => ({ ...prev, [stage.key]: e.target.value }))}
              placeholder={stage.placeholder}
              className="flex-1" />
            
            </div>
          )}
          <Button onClick={saveHeaders} disabled={headerSaving} size="sm" className="gap-2">
            <Save className="w-4 h-4" />
            {headerSaving ? tr("admincommunity_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : 'Yadda saxla'}
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("admincommunity_cemiyyet_qruplari_cbaa40", "Cəmiyyət Qrupları")}</h1>
          <p className="text-muted-foreground">{tr("admincommunity_community_qruplarini_idare_edin_1a966b", "Community qruplarını idarə edin")}</p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Qrup
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Qrup axtar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10" />
            
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 me-2" />
              <SelectValue placeholder="Tip filteri" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr("admincommunity_hamisi_c73c4d", "Hamısı")}</SelectItem>
              {GROUP_TYPES.map((type) =>
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{tr("admincommunity_umumi_qruplar_38d8db", "Ümumi qruplar")}</p>
          <p className="text-2xl font-bold">{groups.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Aktiv qruplar</p>
          <p className="text-2xl font-bold text-green-500">
            {groups.filter((g) => g.is_active).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{tr("admincommunity_avtomatik_qosulma_1af00d", "Avtomatik qoşulma")}</p>
          <p className="text-2xl font-bold text-primary">
            {groups.filter((g) => g.is_auto_join).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{tr("admincommunity_umumi_uzv_ed3652", "Ümumi üzv")}</p>
          <p className="text-2xl font-bold text-violet-500">
            {groups.reduce((sum, g) => sum + (g.member_count || 0), 0)}
          </p>
        </Card>
      </div>

      {/* Groups List */}
      {loading ?
      <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div> :

      <div className="space-y-6">
          {Object.entries(groupsByType).map(([type, typeGroups]) =>
        <div key={type}>
              <h3 className="text-lg font-semibold mb-3 capitalize">
                {GROUP_TYPES.find((t) => t.value === type)?.label || type}
              </h3>
              <div className="grid gap-3">
                {typeGroups.map((group) =>
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}>
              
                    <Card className={`p-4 ${!group.is_active ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                          {group.icon_emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold truncate">{group.name}</h4>
                            {!group.is_active && <Badge variant="secondary">Deaktiv</Badge>}
                            {group.is_auto_join && <Badge className="bg-primary/10 text-primary">Auto-join</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {group.description || tr("admincommunity_aciqlama_yoxdur_a604ef", "A\xE7\u0131qlama yoxdur")}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {group.member_count || 0} {tr("admincommunity_uzv_3f0dbc", "\xFCzv")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(group)}>
                      
                            {group.is_active ?
                      <Eye className="w-4 h-4 text-green-500" /> :

                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                      }
                          </Button>
                          <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(group)}>
                      
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(group.id)}>
                      
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
            )}
              </div>
            </div>
        )}
        </div>
      }

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? tr("admincommunity_qrupu_redakte_et_0865bb", "Qrupu Redakt\u0259 Et") : 'Yeni Qrup Yarat'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-20">
                <label className="text-sm font-medium mb-2 block">Emoji</label>
                <Input
                  value={formData.icon_emoji}
                  onChange={(e) => setFormData({ ...formData, icon_emoji: e.target.value })}
                  className="text-center text-2xl"
                  maxLength={4} />
                
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">{tr("admincommunity_qrup_adi_3ca22e", "Qrup adı")}</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={tr("admincommunity_qrup_adini_daxil_edin_a15074", "Qrup adını daxil edin")} />
                
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{tr("admincommunity_aciqlama_c33d69", "Açıqlama")}</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={tr("admincommunity_qrup_haqqinda_qisa_melumat_ef7e85", "Qrup haqqında qısa məlumat")}
                rows={3} />
              
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Qrup tipi</label>
              <Select
                value={formData.group_type}
                onValueChange={(value) => setFormData({ ...formData, group_type: value })}>
                
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map((type) =>
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Aktiv</p>
                <p className="text-sm text-muted-foreground">{tr("admincommunity_qrup_istifadecilere_gorunsun_c16afa", "Qrup istifadəçilərə görünsün")}</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{tr("admincommunity_avtomatik_qosulma_1af00d", "Avtomatik qoşulma")}</p>
                <p className="text-sm text-muted-foreground">{tr("admincommunity_istifadeciler_avtomatik_qosulsun_dda827", "İstifadəçilər avtomatik qoşulsun")}</p>
              </div>
              <Switch
                checked={formData.is_auto_join}
                onCheckedChange={(checked) => setFormData({ ...formData, is_auto_join: checked })} />
              
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              <X className="w-4 h-4 me-2" />
              {tr("admincommunity_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ?
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin me-2" /> :

              <Save className="w-4 h-4 me-2" />
              }
              {editingGroup ? tr("admincommunity_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminUsageStats
        eventNames={['community_post_created', 'community_post_liked']}
        title={tr("admincommunity_icma_istifade_statistikasi_90d30c", "👥 İcma İstifadə Statistikası")}
        showEventData
        showUsers />
      
    </div>);

};

export default AdminCommunity;