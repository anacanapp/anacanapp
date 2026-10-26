import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Wrench, Search, Save, RefreshCw, ChevronDown, ChevronUp,
  Power, PowerOff, Eye, EyeOff, Lock, Unlock, Crown, Edit2, X, Check,
  Star, Zap } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminUsageStats from './AdminUsageStats';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface ToolConfig {
  id: string;
  tool_id: string;
  name: string;
  name_az: string | null;
  icon: string;
  life_stages: string[];
  sort_order: number;
  flow_order: number;
  bump_order: number;
  mommy_order: number;
  is_active: boolean;
  flow_active: boolean;
  bump_active: boolean;
  mommy_active: boolean;
  flow_locked: boolean;
  bump_locked: boolean;
  mommy_locked: boolean;
  is_premium: boolean;
  premium_type: string;
  premium_limit: number;
  display_name_az: string | null;
  description_az: string | null;
  is_hero: boolean;
  hero_order: number;
  hero_gradient: string | null;
  hero_subtitle: string | null;
  hero_badge: string | null;
  is_quick_access: boolean;
  quick_access_order: number;
  quick_access_gradient: string | null;
}

const categoryLabels: Record<string, string> = {
  flow: 'Flow (Tsikl)',
  bump: tr("admintools_bump_hamilelik_f698da", "Bump (Hamil\u0259lik)"),
  mommy: tr("admintools_mommy_analiq_bd48e3", "Mommy (Anal\u0131q)")
};

const premiumTypeLabels: Record<string, string> = {
  none: 'Yoxdur',
  limited_total: tr("admintools_i_lk_x_istifade_ca2621", "\u0130lk X istifad\u0259"),
  limited_monthly: tr("admintools_ayliq_x_limit_908d8f", "Ayl\u0131q X limit"),
  premium_only: tr("admintools_yalniz_premium_bde702", "Yaln\u0131z Premium")
};

const AdminTools = () => {
    const localize = useAdminLocalize();
  const [activeCategory, setActiveCategory] = useState<'flow' | 'bump' | 'mommy'>('bump');
  const [search, setSearch] = useState('');
  const [localTools, setLocalTools] = useState<ToolConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolConfig | null>(null);
  const [premiumModal, setPremiumModal] = useState<ToolConfig | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tools
  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['admin-tool-configs'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('tool_configs').
      select('*').
      order('sort_order');
      if (error) throw error;
      return data as ToolConfig[];
    }
  });

  // Initialize local tools when data loads
  useEffect(() => {
    if (tools.length > 0) {
      setLocalTools(tools);
    }
  }, [tools]);

  // Get order field for current category
  const getOrderField = (category: string): keyof ToolConfig => {
    switch (category) {
      case 'flow':return 'flow_order';
      case 'bump':return 'bump_order';
      case 'mommy':return 'mommy_order';
      default:return 'sort_order';
    }
  };

  // Get active field for current category
  const getActiveField = (category: string): keyof ToolConfig => {
    switch (category) {
      case 'flow':return 'flow_active';
      case 'bump':return 'bump_active';
      case 'mommy':return 'mommy_active';
      default:return 'is_active';
    }
  };

  // Get locked field for current category
  const getLockedField = (category: string): keyof ToolConfig => {
    switch (category) {
      case 'flow':return 'flow_locked';
      case 'bump':return 'bump_locked';
      case 'mommy':return 'mommy_locked';
      default:return 'flow_locked';
    }
  };

  // Filter and sort tools for current category - show ALL tools in admin (not filtered by life_stages)
  const categoryTools = localTools.
  filter((t) => !search ||
  (localize(t, 'name')).toLowerCase().includes(search.toLowerCase()) ||
  t.tool_id.toLowerCase().includes(search.toLowerCase())
  ).
  sort((a, b) => {
    const orderField = getOrderField(activeCategory);
    return (a[orderField] as number) - (b[orderField] as number);
  });

  // Toggle phase-specific active status
  const togglePhaseActive = (tool: ToolConfig) => {
    const activeField = getActiveField(activeCategory);
    const newTools = localTools.map((t) => {
      if (t.id === tool.id) {
        return { ...t, [activeField]: !t[activeField] };
      }
      return t;
    });
    setLocalTools(newTools);
    setHasChanges(true);
  };

  // Toggle phase-specific locked status
  const togglePhaseLocked = (tool: ToolConfig) => {
    const lockedField = getLockedField(activeCategory);
    const newTools = localTools.map((t) => {
      if (t.id === tool.id) {
        return { ...t, [lockedField]: !t[lockedField] };
      }
      return t;
    });
    setLocalTools(newTools);
    setHasChanges(true);
  };

  // Toggle global active status
  const toggleGlobalActive = (tool: ToolConfig) => {
    const newTools = localTools.map((t) => {
      if (t.id === tool.id) {
        const newActive = !t.is_active;
        return {
          ...t,
          is_active: newActive,
          flow_active: newActive ? t.flow_active : false,
          bump_active: newActive ? t.bump_active : false,
          mommy_active: newActive ? t.mommy_active : false
        };
      }
      return t;
    });
    setLocalTools(newTools);
    setHasChanges(true);
  };

  // Move tool up
  const moveUp = (tool: ToolConfig) => {
    const orderField = getOrderField(activeCategory);
    const currentIndex = categoryTools.findIndex((t) => t.id === tool.id);
    if (currentIndex <= 0) return;

    const prevTool = categoryTools[currentIndex - 1];
    const newTools = localTools.map((t) => {
      if (t.id === tool.id) {
        return { ...t, [orderField]: prevTool[orderField] as number };
      }
      if (t.id === prevTool.id) {
        return { ...t, [orderField]: tool[orderField] as number };
      }
      return t;
    });

    setLocalTools(newTools);
    setHasChanges(true);
  };

  // Move tool down
  const moveDown = (tool: ToolConfig) => {
    const orderField = getOrderField(activeCategory);
    const currentIndex = categoryTools.findIndex((t) => t.id === tool.id);
    if (currentIndex >= categoryTools.length - 1) return;

    const nextTool = categoryTools[currentIndex + 1];
    const newTools = localTools.map((t) => {
      if (t.id === tool.id) {
        return { ...t, [orderField]: nextTool[orderField] as number };
      }
      if (t.id === nextTool.id) {
        return { ...t, [orderField]: tool[orderField] as number };
      }
      return t;
    });

    setLocalTools(newTools);
    setHasChanges(true);
  };

  // Update premium settings
  const updatePremiumSettings = (isPremium: boolean, premiumType: string, premiumLimit: number) => {
    if (!premiumModal) return;

    const newTools = localTools.map((t) => {
      if (t.id === premiumModal.id) {
        return {
          ...t,
          is_premium: isPremium,
          premium_type: premiumType,
          premium_limit: premiumLimit
        };
      }
      return t;
    });
    setLocalTools(newTools);
    setHasChanges(true);
    setPremiumModal(null);
  };

  // Update tool display info
  const updateToolDisplayInfo = (data: {displayName: string;description: string;heroGradient: string;heroSubtitle: string;heroBadge: string;heroOrder: number;quickAccessGradient: string;quickAccessOrder: number;}) => {
    if (!editingTool) return;

    const newTools = localTools.map((t) => {
      if (t.id === editingTool.id) {
        return {
          ...t,
          display_name_az: data.displayName,
          description_az: data.description,
          hero_gradient: data.heroGradient,
          hero_subtitle: data.heroSubtitle,
          hero_badge: data.heroBadge,
          hero_order: data.heroOrder,
          quick_access_gradient: data.quickAccessGradient,
          quick_access_order: data.quickAccessOrder
        };
      }
      return t;
    });
    setLocalTools(newTools);
    setHasChanges(true);
    setEditingTool(null);
  };

  // Fields this screen's bulk save is actually allowed to touch.
  const SAVED_FIELDS = [
    'flow_order', 'bump_order', 'mommy_order',
    'is_active', 'flow_active', 'bump_active', 'mommy_active',
    'flow_locked', 'bump_locked', 'mommy_locked',
    'is_premium', 'premium_type', 'premium_limit',
    'display_name_az', 'description_az',
    'is_hero', 'hero_order', 'is_quick_access', 'quick_access_order',
    'quick_access_gradient', 'hero_gradient', 'hero_subtitle', 'hero_badge'
  ] as const;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // NOT: əvvəllər HƏR sətir (localTools-dakı bütün ~sıra) qeydsiz-şərtsiz
      // yenidən yazılırdı - hətta admin sadəcə BİR alətin sırasını dəyişəndə
      // belə. Bu, `AdminMarketplace.tsx`-in `tool_configs.is_active`
      // (second-hand-market üçün) hədəflənmiş, tək-sütunlu update-i ilə
      // yarışa girirdi: marketplace admin-i bazarı aç/bağla edəndən sonra,
      // bu ekranda əlaqəsiz bir dəyişiklik saxlananda, köhnə keşlənmiş
      // `localTools` dəyəri həmin marketplace dəyişikliyini SƏSSİZCƏ geri
      // qaytarırdı. İndi yalnız HƏQİQƏTƏN dəyişmiş sətirlər üçün UPDATE
      // göndərilir - dəyişməyən sətirlərə toxunulmur.
      const originalById = new Map(tools.map((t) => [t.id, t]));
      const changedTools = localTools.filter((tool) => {
        const original = originalById.get(tool.id);
        if (!original) return false;
        return SAVED_FIELDS.some((field) => tool[field as keyof ToolConfig] !== original[field as keyof ToolConfig]);
      });

      for (const tool of changedTools) {
        const { error } = await supabase.
        from('tool_configs').
        update({
          flow_order: tool.flow_order,
          bump_order: tool.bump_order,
          mommy_order: tool.mommy_order,
          is_active: tool.is_active,
          flow_active: tool.flow_active,
          bump_active: tool.bump_active,
          mommy_active: tool.mommy_active,
          flow_locked: tool.flow_locked,
          bump_locked: tool.bump_locked,
          mommy_locked: tool.mommy_locked,
          is_premium: tool.is_premium,
          premium_type: tool.premium_type,
          premium_limit: tool.premium_limit,
          display_name_az: tool.display_name_az,
          description_az: tool.description_az,
          is_hero: tool.is_hero,
          hero_order: tool.hero_order,
          is_quick_access: tool.is_quick_access,
          quick_access_order: tool.quick_access_order,
          quick_access_gradient: tool.quick_access_gradient,
          hero_gradient: tool.hero_gradient,
          hero_subtitle: tool.hero_subtitle,
          hero_badge: tool.hero_badge
        }).
        eq('id', tool.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tool-configs'] });
      queryClient.invalidateQueries({ queryKey: ['tool-configs'] });
      setHasChanges(false);
      toast({ title: tr("admintools_yadda_saxlanildi_cf4f4a", "Yadda saxlanıldı"), description: tr("admintools_alet_ayarlari_yenilendi_044855", "Alət ayarları yeniləndi") });
    },
    onError: (error) => {
      toast({
        title: tr("admintools_xeta_3cdbb6", "Xəta"),
        description: tr("admintools_deyisiklikler_saxlanila_bilmedi_ecf8b6", "Dəyişikliklər saxlanıla bilmədi"),
        variant: 'destructive'
      });
      console.error('Save error:', error);
    }
  });

  // Reset changes
  const resetChanges = () => {
    setLocalTools(tools);
    setHasChanges(false);
  };

  const activeField = getActiveField(activeCategory);
  const lockedField = getLockedField(activeCategory);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            {tr("admintools_aletler_i_daresi_affdd0", "Al\u0259tl\u0259r \u0130dar\u0259si")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tr("admintools_aletleri_siralayin_kilidleyin__0ce74a", "Al\u0259tl\u0259ri s\u0131ralay\u0131n, kilidl\u0259yin, premium edin")}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges &&
          <>
              <Button variant="outline" size="sm" onClick={resetChanges}>
                <RefreshCw className="w-4 h-4 me-1" />
                {tr("admintools_legv_et_b5e49c", "L\u0259\u011Fv et")}
              </Button>
              <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}>
              
                <Save className="w-4 h-4 me-1" />
                {saveMutation.isPending ? tr("admintools_saxlanir_9ea540", "Saxlan\u0131r...") : 'Yadda saxla'}
              </Button>
            </>
          }
        </div>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={tr("admintools_alet_axtar_1f976c", "Alət axtar...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9" />
        
      </div>

      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flow">Flow</TabsTrigger>
          <TabsTrigger value="bump">Bump</TabsTrigger>
          <TabsTrigger value="mommy">Mommy</TabsTrigger>
        </TabsList>

        {['flow', 'bump', 'mommy'].map((category) =>
        <TabsContent key={category} value={category} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{categoryLabels[category]}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {categoryTools.filter((t) => t[activeField as keyof ToolConfig]).length} aktiv
                    </Badge>
                    <Badge variant="outline">{categoryTools.length} {tr("admintools_alet_9a099a", "al\u0259t")}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ?
              <div className="text-center py-8 text-muted-foreground">{tr("admintools_yuklenir_5557de", "Yüklənir...")}</div> :
              categoryTools.length === 0 ?
              <div className="text-center py-8 text-muted-foreground">
                    {tr("admintools_bu_kateqoriyada_alet_yoxdur_6c04fc", "Bu kateqoriyada al\u0259t yoxdur")}
                  </div> :

              <div className="space-y-2">
                    {categoryTools.map((tool, index) => {
                  const isPhaseActive = tool[activeField as keyof ToolConfig] as boolean;
                  const isPhaseLocked = tool[lockedField as keyof ToolConfig] as boolean;
                  return (
                    <motion.div
                      key={tool.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      !tool.is_active ?
                      'bg-muted/30 border-border/30 opacity-50' :
                      !isPhaseActive ?
                      'bg-muted/50 border-border/50' :
                      'bg-card border-border'}`
                      }>
                      
                          {/* Order controls */}
                          <div className="flex flex-col gap-1">
                            <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveUp(tool)}
                          disabled={index === 0}>
                          
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveDown(tool)}
                          disabled={index === categoryTools.length - 1}>
                          
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {/* Order number */}
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          
                          {/* Tool info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {tool.display_name_az || tool.name_az || tool.name}
                              </p>
                              {tool.is_premium &&
                          <Crown className="w-4 h-4 text-amber-500" />
                          }
                              {tool.is_hero &&
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-violet-50 text-violet-600 border-violet-200">Hero</Badge>
                          }
                              {tool.is_quick_access &&
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200">QA</Badge>
                          }
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              ID: {tool.tool_id}
                            </p>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Hero toggle */}
                            <Button
                          variant={tool.is_hero ? 'default' : 'ghost'}
                          size="icon"
                          className={`h-7 w-7 ${tool.is_hero ? 'bg-violet-500 hover:bg-violet-600' : ''}`}
                          onClick={() => {
                            const newTools = localTools.map((t) => t.id === tool.id ? { ...t, is_hero: !t.is_hero } : t);
                            setLocalTools(newTools);
                            setHasChanges(true);
                          }}
                          title="Hero banner">
                          
                              <Star className="w-3.5 h-3.5" />
                            </Button>

                            {/* Quick Access toggle */}
                            <Button
                          variant={tool.is_quick_access ? 'default' : 'ghost'}
                          size="icon"
                          className={`h-7 w-7 ${tool.is_quick_access ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                          onClick={() => {
                            const newTools = localTools.map((t) => t.id === tool.id ? { ...t, is_quick_access: !t.is_quick_access } : t);
                            setLocalTools(newTools);
                            setHasChanges(true);
                          }}
                          title={tr("admintools_suretli_giris_bcd978", "Sürətli giriş")}>
                          
                              <Zap className="w-3.5 h-3.5" />
                            </Button>

                            {/* Edit button */}
                            <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingTool(tool)}>
                          
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            {/* Premium button */}
                            <Button
                          variant={tool.is_premium ? 'default' : 'ghost'}
                          size="icon"
                          className={`h-8 w-8 ${tool.is_premium ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                          onClick={() => setPremiumModal(tool)}>
                          
                              <Crown className="w-4 h-4" />
                            </Button>

                            {/* Lock toggle */}
                            <Button
                          variant={isPhaseLocked ? 'destructive' : 'outline'}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => togglePhaseLocked(tool)}
                          disabled={!tool.is_active}>
                          
                              {isPhaseLocked ?
                          <Lock className="w-4 h-4" /> :

                          <Unlock className="w-4 h-4" />
                          }
                            </Button>
                            
                            {/* Phase-specific toggle */}
                            <div className="flex items-center gap-2">
                              <Switch
                            checked={isPhaseActive}
                            onCheckedChange={() => togglePhaseActive(tool)}
                            disabled={!tool.is_active} />
                          
                            </div>
                            
                            {/* Global toggle */}
                            <Button
                          variant={tool.is_active ? 'default' : 'secondary'}
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => toggleGlobalActive(tool)}>
                          
                              {tool.is_active ?
                          <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="text-xs">Aktiv</span>
                                </> :

                          <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span className="text-xs">Deaktiv</span>
                                </>
                          }
                            </Button>
                          </div>
                        </motion.div>);

                })}
                  </div>
              }
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span>{tr("admintools_aktiv_alet_butun_phase_lerde_gorune_bile_ffe606", "Aktiv - alət bütün phase-lərdə görünə bilər")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-destructive" />
          <span>{tr("admintools_kilidli_alet_premium_teleb_edir_9bfa45", "Kilidli - alət premium tələb edir")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          <span>{tr("admintools_premium_limit_ve_ya_premium_only_2ed4c5", "Premium - limit və ya premium-only")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Edit2 className="w-4 h-4" />
          <span>{tr("admintools_redakte_ad_ve_aciqlamani_deyisin_e632f7", "Redaktə - ad və açıqlamanı dəyişin")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-violet-500" />
          <span>{tr("admintools_hero_boyuk_banner_kimi_goster_6a6f9f", "Hero - böyük banner kimi göstər")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          <span>{tr("admintools_qa_suretli_giris_sirasinda_goster_38995c", "QA - sürətli giriş sırasında göstər")}</span>
        </div>
      </div>

      {/* Edit Tool Dialog */}
      <Dialog open={!!editingTool} onOpenChange={() => setEditingTool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("admintools_aleti_redakte_et_c9886f", "Aləti Redaktə Et")}</DialogTitle>
          </DialogHeader>
          {editingTool &&
          <EditToolForm
            tool={editingTool}
            onSave={updateToolDisplayInfo}
            onCancel={() => setEditingTool(null)} />

          }
        </DialogContent>
      </Dialog>

      {/* Premium Settings Dialog */}
      <Dialog open={!!premiumModal} onOpenChange={() => setPremiumModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("admintools_premium_ayarlari_19bdd3", "Premium Ayarları")}</DialogTitle>
          </DialogHeader>
          {premiumModal &&
          <PremiumSettingsForm
            tool={premiumModal}
            onSave={updatePremiumSettings}
            onCancel={() => setPremiumModal(null)} />

          }
        </DialogContent>
      </Dialog>

      <AdminUsageStats
        eventNames={['tool_opened', 'tool_used']}
        title={tr("admintools_alet_istifade_statistikasi_78b2a7", "🔧 Alət İstifadə Statistikası")}
        showEventData
        showUsers />
      
    </div>);

};

// Edit Tool Form Component
interface EditToolFormData {
  displayName: string;
  description: string;
  heroGradient: string;
  heroSubtitle: string;
  heroBadge: string;
  heroOrder: number;
  quickAccessGradient: string;
  quickAccessOrder: number;
}

const EditToolForm = ({
  tool,
  onSave,
  onCancel




}: {tool: ToolConfig;onSave: (data: EditToolFormData) => void;onCancel: () => void;}) => {
  const [displayName, setDisplayName] = useState(tool.display_name_az || tool.name_az || tool.name);
  const [description, setDescription] = useState(tool.description_az || '');
  const [heroGradient, setHeroGradient] = useState(tool.hero_gradient || 'from-primary to-primary/80');
  const [heroSubtitle, setHeroSubtitle] = useState(tool.hero_subtitle || '');
  const [heroBadge, setHeroBadge] = useState(tool.hero_badge || '');
  const [heroOrder, setHeroOrder] = useState(tool.hero_order || 0);
  const [quickAccessGradient, setQuickAccessGradient] = useState(tool.quick_access_gradient || 'from-primary to-primary/80');
  const [quickAccessOrder, setQuickAccessOrder] = useState(tool.quick_access_order || 0);

  const gradientPresets = [
  { label: 'Primary', value: 'from-primary to-primary/80' },
  { label: tr("admintools_yasil_b257f4", "Yaşıl"), value: 'from-emerald-500 to-teal-600' },
  { label: 'Mavi', value: 'from-blue-500 to-indigo-600' },
  { label: tr("admintools_benovseyi_047412", "Bənövşəyi"), value: 'from-purple-500 to-violet-600' },
  { label: tr("admintools_cehrayi_cf1224", "Çəhrayı"), value: 'from-pink-500 to-rose-600' },
  { label: tr("admintools_narinci_5160ef", "Narıncı"), value: 'from-orange-500 to-amber-600' },
  { label: tr("admintools_qirmizi_ea111d", "Qırmızı"), value: 'from-red-500 to-rose-600' },
  { label: 'Teal', value: 'from-teal-500 to-cyan-600' },
  { label: tr("admintools_goy_yasil_20e443", "Göy-yaşıl"), value: 'from-cyan-500 to-blue-600' }];


  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      {/* Basic Info */}
      <div>
        <Label>{tr("admintools_gorunen_ad_az_991e41", "Görünən Ad (AZ)")}</Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={tr("admintools_alet_adi_e90435", "Alət adı")} />
        
      </div>
      <div>
        <Label>{tr("admintools_aciqlama_az_86f364", "Açıqlama (AZ)")}</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tr("admintools_alet_haqqinda_qisa_aciqlama_dfbbda", "Alət haqqında qısa açıqlama")}
          rows={2} />
        
      </div>

      {/* Hero Settings */}
      {tool.is_hero &&
      <div className="border rounded-lg p-3 space-y-3 bg-violet-50/50 dark:bg-violet-900/10">
          <p className="text-sm font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
            <Star className="w-4 h-4" /> {tr("admintools_hero_banner_ayarlari_9ad26d", "Hero Banner Ayarlar\u0131")}
          </p>
          
          <div>
            <Label className="text-xs">{tr("admintools_hero_sirasi_eef2b1", "Hero Sırası")}</Label>
            <Input
            type="number"
            min={0}
            value={heroOrder}
            onChange={(e) => setHeroOrder(parseInt(e.target.value) || 0)}
            className="h-8" />
          
          </div>

          <div>
            <Label className="text-xs">{tr("admintools_hero_alt_yazi_26258f", "Hero Alt Yazı")}</Label>
            <Input
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
            placeholder={tr("admintools_banner_alt_yazisi_58550f", "Banner alt yazısı")}
            className="h-8" />
          
          </div>

          <div>
            <Label className="text-xs">Hero Badge (etiket)</Label>
            <Input
            value={heroBadge}
            onChange={(e) => setHeroBadge(e.target.value)}
            placeholder={tr("admintools_mes_yeni_populyar_3cb8a9", "Məs: YENİ, ✨ Populyar")}
            className="h-8" />
          
          </div>

          <div>
            <Label className="text-xs">{tr("admintools_gradient_rengi_b5a4b4", "Gradient Rəngi")}</Label>
            <Select value={heroGradient} onValueChange={setHeroGradient}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gradientPresets.map((g) =>
              <SelectItem key={g.value} value={g.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded bg-gradient-to-r ${g.value}`} />
                      {g.label}
                    </div>
                  </SelectItem>
              )}
              </SelectContent>
            </Select>
            <div className={`mt-1.5 h-6 rounded-lg bg-gradient-to-r ${heroGradient}`} />
          </div>
        </div>
      }

      {/* Quick Access Settings */}
      {tool.is_quick_access &&
      <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <Zap className="w-4 h-4" /> {tr("admintools_suretli_giris_ayarlari_d0c050", "S\xFCr\u0259tli Giri\u015F Ayarlar\u0131")}
          </p>
          
          <div>
            <Label className="text-xs">{tr("admintools_suretli_giris_sirasi_5e7ffc", "Sürətli Giriş Sırası")}</Label>
            <Input
            type="number"
            min={0}
            value={quickAccessOrder}
            onChange={(e) => setQuickAccessOrder(parseInt(e.target.value) || 0)}
            className="h-8" />
          
          </div>

          <div>
            <Label className="text-xs">{tr("admintools_gradient_rengi_b5a4b4", "Gradient Rəngi")}</Label>
            <Select value={quickAccessGradient} onValueChange={setQuickAccessGradient}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gradientPresets.map((g) =>
              <SelectItem key={g.value} value={g.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded bg-gradient-to-r ${g.value}`} />
                      {g.label}
                    </div>
                  </SelectItem>
              )}
              </SelectContent>
            </Select>
            <div className={`mt-1.5 h-6 rounded-lg bg-gradient-to-r ${quickAccessGradient}`} />
          </div>
        </div>
      }

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 me-1" />
          {tr("admintools_legv_et_b5e49c", "L\u0259\u011Fv et")}
        </Button>
        <Button onClick={() => onSave({ displayName, description, heroGradient, heroSubtitle, heroBadge, heroOrder, quickAccessGradient, quickAccessOrder })}>
          <Check className="w-4 h-4 me-1" />
          Yadda saxla
        </Button>
      </DialogFooter>
    </div>);

};

// Premium Settings Form Component
const PremiumSettingsForm = ({
  tool,
  onSave,
  onCancel




}: {tool: ToolConfig;onSave: (isPremium: boolean, type: string, limit: number) => void;onCancel: () => void;}) => {
  const [isPremium, setIsPremium] = useState(tool.is_premium);
  const [premiumType, setPremiumType] = useState(tool.premium_type || 'none');
  const [premiumLimit, setPremiumLimit] = useState(tool.premium_limit || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{tr("admintools_premium_alet_9456e3", "Premium Alət")}</Label>
        <Switch
          checked={isPremium}
          onCheckedChange={setIsPremium} />
        
      </div>

      {isPremium &&
      <>
          <div>
            <Label>{tr("admintools_premium_novu_d85e42", "Premium Növü")}</Label>
            <Select value={premiumType} onValueChange={setPremiumType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tr("admintools_secin_4f7bd7", "Seçin...")}</SelectItem>
                <SelectItem value="limited_total">{tr("admintools_ilk_x_istifade_pulsuz_a870aa", "İlk X istifadə pulsuz")}</SelectItem>
                <SelectItem value="limited_monthly">{tr("admintools_ayliq_x_istifade_pulsuz_7a3cf0", "Aylıq X istifadə pulsuz")}</SelectItem>
                <SelectItem value="premium_only">{tr("admintools_yalniz_premium_istifadeciler_d5a0aa", "Yalnız Premium istifadəçilər")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(premiumType === 'limited_total' || premiumType === 'limited_monthly') &&
        <div>
              <Label>
                {premiumType === 'limited_total' ? tr("admintools_pulsuz_istifade_limiti_82ad58", "Pulsuz istifad\u0259 limiti") : tr("admintools_ayliq_pulsuz_limit_6692b5", "Ayl\u0131q pulsuz limit")

            }
              </Label>
              <Input
            type="number"
            min={0}
            value={premiumLimit}
            onChange={(e) => setPremiumLimit(parseInt(e.target.value) || 0)}
            placeholder={tr("admintools_mes_3_399873", "Məs: 3")} />
          
              <p className="text-xs text-muted-foreground mt-1">
                {premiumType === 'limited_total' ? tr("admintools_i_stifadeci_bu_qeder_defe_puls_da5855", "\u0130stifad\u0259\xE7i bu q\u0259d\u0259r d\u0259f\u0259 pulsuz istifad\u0259 ed\u0259 bil\u0259r") : tr("admintools_i_stifadeci_her_ay_bu_qeder_de_05d7d7", "\u0130stifad\u0259\xE7i h\u0259r ay bu q\u0259d\u0259r d\u0259f\u0259 pulsuz istifad\u0259 ed\u0259 bil\u0259r")

            }
              </p>
            </div>
        }

          {premiumType === 'premium_only' &&
        <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              {tr("admintools_bu_alet_yalniz_premium_abuneli_2cc13e", "Bu al\u0259t yaln\u0131z Premium abun\u0259liyi olan istifad\u0259\xE7il\u0259r t\u0259r\u0259find\u0259n istifad\u0259 edil\u0259 bil\u0259r.")}
            </p>
        }
        </>
      }

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 me-1" />
          {tr("admintools_legv_et_b5e49c", "L\u0259\u011Fv et")}
        </Button>
        <Button onClick={() => onSave(isPremium, premiumType, premiumLimit)}>
          <Check className="w-4 h-4 me-1" />
          Yadda saxla
        </Button>
      </DialogFooter>
    </div>);

};

export default AdminTools;