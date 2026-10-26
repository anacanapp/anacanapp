import { useState } from 'react';
import { tr } from '@/lib/tr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Brain, Smile, Wind, Volume2, Phone } from 'lucide-react';
import {
  useAdminEPDSQuestions,
  useAdminMoodLevels,
  useAdminBreathingExercises,
  useAdminNoiseThresholds,
  useAdminMentalHealthResources,
  EPDSQuestion,
  MoodLevel,
  BreathingExercise,
  NoiseThreshold,
  MentalHealthResourceAdmin } from
'@/hooks/useAdminMentalHealth';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminMentalHealth = () => {
    const localize = useAdminLocalize();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{tr("adminmentalhealth_mental_saglamliq_idareetmesi_1b85ab", "Mental SaÄŸlamlÄ±q Ä°darÉ™etmÉ™si")}</h2>
        <p className="text-muted-foreground">{tr("adminmentalhealth_epds_suallari_ehval_nefes_mesqleri_ses_h_577a68", "EPDS suallarÄ±, É™hval, nÉ™fÉ™s mÉ™ÅŸqlÉ™ri, sÉ™s hÉ™dlÉ™ri vÉ™ dÉ™stÉ™k resurslarÄ±")}</p>
      </div>

      <Tabs defaultValue="epds" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="epds" className="flex items-center gap-1 text-xs">
            <Brain className="w-3.5 h-3.5" />
            EPDS
          </TabsTrigger>
          <TabsTrigger value="mood" className="flex items-center gap-1 text-xs">
            <Smile className="w-3.5 h-3.5" />
            {tr("adminmentalhealth_ehval_0457f9", "\u018Fhval")}
          </TabsTrigger>
          <TabsTrigger value="breathing" className="flex items-center gap-1 text-xs">
            <Wind className="w-3.5 h-3.5" />
            {tr("adminmentalhealth_nefes_8302eb", "N\u0259f\u0259s")}
          </TabsTrigger>
          <TabsTrigger value="noise" className="flex items-center gap-1 text-xs">
            <Volume2 className="w-3.5 h-3.5" />
            {tr("adminmentalhealth_ses_9b06b5", "S\u0259s")}
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-1 text-xs">
            <Phone className="w-3.5 h-3.5" />
            Resurslar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="epds"><EPDSTab /></TabsContent>
        <TabsContent value="mood"><MoodTab /></TabsContent>
        <TabsContent value="breathing"><BreathingTab /></TabsContent>
        <TabsContent value="noise"><NoiseTab /></TabsContent>
        <TabsContent value="resources"><ResourcesTab /></TabsContent>
      </Tabs>
    </div>);

};

// EPDS Tab
const EPDSTab = () => {
  const localize = useAdminLocalize();
  const { data: questions = [], create, update, remove } = useAdminEPDSQuestions();
  const [editItem, setEditItem] = useState<EPDSQuestion | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (data: Partial<EPDSQuestion>) => {
    if (editItem) {
      update.mutate({ id: editItem.id, ...data });
    } else {
      create.mutate(data);
    }
    setIsOpen(false);
    setEditItem(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{tr("adminmentalhealth_epds_suallari_d747b9", "EPDS Suallar\u0131 (")}{questions.length})</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditItem(null)}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminmentalhealth_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem ? tr("adminmentalhealth_suali_redakte_et_566483", "Sual\u0131 redakt\u0259 et") : 'Yeni sual'}</DialogTitle>
            </DialogHeader>
            <EPDSForm item={editItem} onSave={handleSave} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>â„–</TableHead>
              <TableHead>Sual (AZ)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">{tr("adminmentalhealth_emeliyyatlar_54d70c", "ÆmÉ™liyyatlar")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((q) =>
            <TableRow key={q.id}>
                <TableCell>{q.question_number}</TableCell>
                <TableCell className="max-w-md truncate">{localize(q, 'question_text')}</TableCell>
                <TableCell>
                  <Badge variant={q.is_active ? 'default' : 'secondary'}>
                    {q.is_active ? 'Aktiv' : 'Deaktiv'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {setEditItem(q);setIsOpen(true);}}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(q.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>);

};

const EPDSForm = ({ item, onSave }: {item: EPDSQuestion | null;onSave: (data: Partial<EPDSQuestion>) => void;}) => {
  const [formData, setFormData] = useState({
    question_number: item?.question_number || 1,
    question_text: item?.question_text || '',
    question_text_az: item?.question_text_az || '',
    options: item?.options || [{ value: 0, text: '', text_az: '' }],
    is_reverse_scored: item?.is_reverse_scored || false,
    is_active: item?.is_active ?? true,
    sort_order: item?.sort_order || 0
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Sual â„–</Label>
          <Input type="number" value={formData.question_number} onChange={(e) => setFormData({ ...formData, question_number: parseInt(e.target.value) })} />
        </div>
        <div>
          <Label>{tr("adminmentalhealth_sira_421c5f", "SÄ±ra")}</Label>
          <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label>Sual (EN)</Label>
        <Textarea value={formData.question_text} onChange={(e) => setFormData({ ...formData, question_text: e.target.value })} />
      </div>
      <div>
        <Label>Sual (AZ)</Label>
        <LocalizedTextarea formData={formData} setFormData={setFormData} field="question_text" label="Question_text" />
      </div>
      <div className="flex items-center gap-4">
        <Switch checked={formData.is_reverse_scored} onCheckedChange={(v) => setFormData({ ...formData, is_reverse_scored: v })} />
        <Label>{tr("adminmentalhealth_tersine_hesablanir_dfe11e", "TÉ™rsinÉ™ hesablanÄ±r")}</Label>
        <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
        <Label>Aktiv</Label>
      </div>
      <Button onClick={() => onSave(formData)} className="w-full">Yadda saxla</Button>
    </div>);

};

// Mood Tab
const MoodTab = () => {
  const localize = useAdminLocalize();
  const { data: moods = [], create, update, remove } = useAdminMoodLevels();
  const [editItem, setEditItem] = useState<MoodLevel | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (data: Partial<MoodLevel>) => {
    if (editItem) {
      update.mutate({ id: editItem.id, ...data });
    } else {
      create.mutate(data);
    }
    setIsOpen(false);
    setEditItem(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{tr("adminmentalhealth_ehval_seviyyeleri_14cb93", "\u018Fhval S\u0259viyy\u0259l\u0259ri (")}{moods.length})</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditItem(null)}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminmentalhealth_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? tr("adminmentalhealth_redakte_et_66cf3b", "Redakt\u0259 et") : tr("adminmentalhealth_yeni_ehval_0878ad", "Yeni \u0259hval")}</DialogTitle>
            </DialogHeader>
            <MoodForm item={editItem} onSave={handleSave} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4">
          {moods.map((m) =>
          <Card key={m.id} className="text-center p-4">
              <div className="text-4xl mb-2">{m.emoji}</div>
              <div className="font-medium">{localize(m, 'label')}</div>
              <div className="text-sm text-muted-foreground">{tr("adminmentalhealth_deyer_a656ba", "D\u0259y\u0259r:")} {m.mood_value}</div>
              <div className="flex gap-1 mt-2 justify-center">
                <Button variant="ghost" size="icon" onClick={() => {setEditItem(m);setIsOpen(true);}}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>);

};

const MoodForm = ({ item, onSave }: {item: MoodLevel | null;onSave: (data: Partial<MoodLevel>) => void;}) => {
  const [formData, setFormData] = useState({
    mood_value: item?.mood_value || 1,
    label: item?.label || '',
    label_az: item?.label_az || '',
    emoji: item?.emoji || 'ðŸ˜Š',
    color: item?.color || '#22c55e',
    is_active: item?.is_active ?? true,
    sort_order: item?.sort_order || 0
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{tr("adminmentalhealth_deyer_1_5_24b5f4", "DÉ™yÉ™r (1-5)")}</Label>
          <Input type="number" min={1} max={5} value={formData.mood_value} onChange={(e) => setFormData({ ...formData, mood_value: parseInt(e.target.value) })} />
        </div>
        <div>
          <Label>Emoji</Label>
          <Input value={formData.emoji} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Etiket (EN)</Label>
          <Input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} />
        </div>
        <div>
          <Label>Etiket (AZ)</Label>
          <LocalizedInput formData={formData} setFormData={setFormData} field="label" label="Label" />
        </div>
      </div>
      <div>
        <Label>{tr("adminmentalhealth_reng_8c6bc5", "RÉ™ng")}</Label>
        <Input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
      </div>
      <Button onClick={() => onSave(formData)} className="w-full">Yadda saxla</Button>
    </div>);

};

// Breathing Tab
const BreathingTab = () => {
  const localize = useAdminLocalize();
  const { data: exercises = [], create, update, remove } = useAdminBreathingExercises();
  const [editItem, setEditItem] = useState<BreathingExercise | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (data: Partial<BreathingExercise>) => {
    if (editItem) {
      update.mutate({ id: editItem.id, ...data });
    } else {
      create.mutate(data);
    }
    setIsOpen(false);
    setEditItem(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{tr("adminmentalhealth_nefes_mesqleri_734549", "N\u0259f\u0259s M\u0259\u015Fql\u0259ri (")}{exercises.length})</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditItem(null)}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminmentalhealth_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editItem ? tr("adminmentalhealth_redakte_et_66cf3b", "Redakt\u0259 et") : tr("adminmentalhealth_yeni_mesq_c48429", "Yeni m\u0259\u015Fq")}</DialogTitle>
            </DialogHeader>
            <BreathingForm item={editItem} onSave={handleSave} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>{tr("adminmentalhealth_nefes_al_50ff18", "NÉ™fÉ™s al")}</TableHead>
              <TableHead>Saxla</TableHead>
              <TableHead>{tr("adminmentalhealth_nefes_ver_6ccae7", "NÉ™fÉ™s ver")}</TableHead>
              <TableHead>{tr("adminmentalhealth_dovrler_24f55e", "DÃ¶vrlÉ™r")}</TableHead>
              <TableHead>{tr("adminmentalhealth_emeliyyatlar_54d70c", "ÆmÉ™liyyatlar")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercises.map((e) =>
            <TableRow key={e.id}>
                <TableCell>{localize(e, 'name')}</TableCell>
                <TableCell>{e.inhale_seconds}s</TableCell>
                <TableCell>{e.hold_seconds}s</TableCell>
                <TableCell>{e.exhale_seconds}s</TableCell>
                <TableCell>{e.total_cycles}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {setEditItem(e);setIsOpen(true);}}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(e.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>);

};

const BreathingForm = ({ item, onSave }: {item: BreathingExercise | null;onSave: (data: Partial<BreathingExercise>) => void;}) => {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    name_az: item?.name_az || '',
    description: item?.description || '',
    description_az: item?.description_az || '',
    icon: item?.icon || 'Wind',
    color: item?.color || '#8b5cf6',
    inhale_seconds: item?.inhale_seconds || 4,
    hold_seconds: item?.hold_seconds || 0,
    exhale_seconds: item?.exhale_seconds || 4,
    hold_after_exhale_seconds: item?.hold_after_exhale_seconds || 0,
    total_cycles: item?.total_cycles || 4,
    is_active: item?.is_active ?? true,
    sort_order: item?.sort_order || 0
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Ad (EN)</Label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div>
          <Label>Ad (AZ)</Label>
          <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Name" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label>{tr("adminmentalhealth_nefes_al_s_197780", "NÉ™fÉ™s al (s)")}</Label>
          <Input type="number" value={formData.inhale_seconds} onChange={(e) => setFormData({ ...formData, inhale_seconds: parseInt(e.target.value) })} />
        </div>
        <div>
          <Label>Saxla (s)</Label>
          <Input type="number" value={formData.hold_seconds} onChange={(e) => setFormData({ ...formData, hold_seconds: parseInt(e.target.value) })} />
        </div>
        <div>
          <Label>{tr("adminmentalhealth_nefes_ver_s_119735", "NÉ™fÉ™s ver (s)")}</Label>
          <Input type="number" value={formData.exhale_seconds} onChange={(e) => setFormData({ ...formData, exhale_seconds: parseInt(e.target.value) })} />
        </div>
        <div>
          <Label>{tr("adminmentalhealth_dovr_ce797b", "DÃ¶vr")}</Label>
          <Input type="number" value={formData.total_cycles} onChange={(e) => setFormData({ ...formData, total_cycles: parseInt(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label>{tr("adminmentalhealth_tesvir_az_2c237a", "TÉ™svir (AZ)")}</Label>
        <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Description" />
      </div>
      <Button onClick={() => onSave(formData)} className="w-full">Yadda saxla</Button>
    </div>);

};

// Noise Tab
const NoiseTab = () => {
  const localize = useAdminLocalize();
  const { data: thresholds = [], create, update, remove } = useAdminNoiseThresholds();
  const [editItem, setEditItem] = useState<NoiseThreshold | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (data: Partial<NoiseThreshold>) => {
    if (editItem) {
      update.mutate({ id: editItem.id, ...data });
    } else {
      create.mutate(data);
    }
    setIsOpen(false);
    setEditItem(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{tr("adminmentalhealth_ses_kuy_heddleri_30f7f8", "S\u0259s-K\xFCy H\u0259ddl\u0259ri (")}{thresholds.length})</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditItem(null)}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminmentalhealth_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? tr("adminmentalhealth_redakte_et_66cf3b", "Redakt\u0259 et") : tr("adminmentalhealth_yeni_hedd_143001", "Yeni h\u0259dd")}</DialogTitle>
            </DialogHeader>
            <NoiseForm item={editItem} onSave={handleSave} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr("adminmentalhealth_acar_644193", "AÃ§ar")}</TableHead>
              <TableHead>{tr("adminmentalhealth_araliq_db_a88377", "AralÄ±q (dB)")}</TableHead>
              <TableHead>Etiket</TableHead>
              <TableHead>Emoji</TableHead>
              <TableHead>{tr("adminmentalhealth_emeliyyatlar_54d70c", "ÆmÉ™liyyatlar")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {thresholds.map((t) =>
            <TableRow key={t.id}>
                <TableCell>{t.threshold_key}</TableCell>
                <TableCell>{t.min_db} - {t.max_db || 'âˆž'} dB</TableCell>
                <TableCell>{localize(t, 'label')}</TableCell>
                <TableCell>{t.emoji}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {setEditItem(t);setIsOpen(true);}}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>);

};

const NoiseForm = ({ item, onSave }: {item: NoiseThreshold | null;onSave: (data: Partial<NoiseThreshold>) => void;}) => {
  const [formData, setFormData] = useState({
    threshold_key: item?.threshold_key || '',
    min_db: item?.min_db || 0,
    max_db: item?.max_db || null,
    label: item?.label || '',
    label_az: item?.label_az || '',
    color: item?.color || '#22c55e',
    emoji: item?.emoji || 'ðŸ˜Š',
    description_az: item?.description_az || '',
    is_active: item?.is_active ?? true,
    sort_order: item?.sort_order || 0
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>{tr("adminmentalhealth_acar_mes_silent_quiet_9eed69", "AÃ§ar (mÉ™s: silent, quiet)")}</Label>
        <Input value={formData.threshold_key} onChange={(e) => setFormData({ ...formData, threshold_key: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Min dB</Label>
          <Input type="number" value={formData.min_db} onChange={(e) => setFormData({ ...formData, min_db: parseInt(e.target.value) })} />
        </div>
        <div>
          <Label>Max dB</Label>
          <Input type="number" value={formData.max_db || ''} onChange={(e) => setFormData({ ...formData, max_db: e.target.value ? parseInt(e.target.value) : null })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Etiket (EN)</Label>
          <Input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} />
        </div>
        <div>
          <Label>Etiket (AZ)</Label>
          <LocalizedInput formData={formData} setFormData={setFormData} field="label" label="Label" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{tr("adminmentalhealth_reng_8c6bc5", "RÉ™ng")}</Label>
          <Input type="color" value={formData.color || '#22c55e'} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
        </div>
        <div>
          <Label>Emoji</Label>
          <Input value={formData.emoji} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>{tr("adminmentalhealth_tesvir_az_2c237a", "TÉ™svir (AZ)")}</Label>
        <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Description" />
      </div>
      <Button onClick={() => onSave(formData)} className="w-full">Yadda saxla</Button>
    </div>);

};

export default AdminMentalHealth;

// Resources Tab
const ResourcesTab = () => {
  const { data: resources = [], create, update, remove } = useAdminMentalHealthResources();
  const [editItem, setEditItem] = useState<MentalHealthResourceAdmin | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    name_az: '',
    description: '',
    description_az: '',
    resource_type: 'hotline',
    phone: '',
    website: '',
    address: '',
    address_az: '',
    is_emergency: false,
    is_active: true,
    sort_order: 0
  });

  const handleEdit = (item: MentalHealthResourceAdmin) => {
    setEditItem(item);
    setFormData({
      name: item.name,
      name_az: item.name_az,
      description: item.description || '',
      description_az: item.description_az || '',
      resource_type: item.resource_type,
      phone: item.phone || '',
      website: item.website || '',
      address: item.address || '',
      address_az: item.address_az || '',
      is_emergency: item.is_emergency || false,
      is_active: item.is_active ?? true,
      sort_order: item.sort_order || 0
    });
    setIsOpen(true);
  };

  const handleSave = () => {
    if (editItem) {
      update.mutate({ id: editItem.id, ...formData });
    } else {
      create.mutate(formData);
    }
    setIsOpen(false);
    setEditItem(null);
    setFormData({ name: '', name_az: '', description: '', description_az: '', resource_type: 'hotline', phone: '', website: '', address: '', address_az: '', is_emergency: false, is_active: true, sort_order: 0 });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{tr("adminmentalhealth_tecili_yardim_destek_resurslari_1ed147", "TÉ™cili YardÄ±m & DÉ™stÉ™k ResurslarÄ±")}</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => {setEditItem(null);setFormData({ name: '', name_az: '', description: '', description_az: '', resource_type: 'hotline', phone: '', website: '', address: '', address_az: '', is_emergency: false, is_active: true, sort_order: 0 });}}>
              <Plus className="w-4 h-4 me-1" /> {tr("adminmentalhealth_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem ? tr("adminmentalhealth_redakte_et_66cf3b", "Redakt\u0259 et") : 'Yeni Resurs'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Ad (EN)</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><Label>Ad (AZ)</Label><LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{tr("adminmentalhealth_tesvir_en_c64521", "TÉ™svir (EN)")}</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                <div><Label>{tr("adminmentalhealth_tesvir_az_2c237a", "TÉ™svir (AZ)")}</Label><LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Description" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Telefon</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><Label>Sayt</Label><Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{tr("adminmentalhealth_unvan_en_18f4d9", "Ãœnvan (EN)")}</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                <div><Label>{tr("adminmentalhealth_unvan_az_9434ac", "Ãœnvan (AZ)")}</Label><LocalizedInput formData={formData} setFormData={setFormData} field="address" label="Address" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tip</Label><Input value={formData.resource_type} onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })} placeholder="hotline, clinic, support" /></div>
                <div><Label>{tr("adminmentalhealth_sira_421c5f", "SÄ±ra")}</Label><Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.is_emergency} onCheckedChange={(v) => setFormData({ ...formData, is_emergency: v })} />
                  <Label>{tr("adminmentalhealth_tecili_ab784b", "TÉ™cili")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                  <Label>Aktiv</Label>
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">Yadda saxla</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad (AZ)</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>{tr("adminmentalhealth_tecili_ab784b", "TÉ™cili")}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{tr("adminmentalhealth_emeliyyat_580469", "ÆmÉ™liyyat")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((r) =>
            <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name_az}</TableCell>
                <TableCell>{r.phone || 'â€”'}</TableCell>
                <TableCell><Badge variant="outline">{r.resource_type}</Badge></TableCell>
                <TableCell>{r.is_emergency ? <Badge className="bg-red-500">{tr("adminmentalhealth_tecili_ab784b", "TÉ™cili")}</Badge> : 'â€”'}</TableCell>
                <TableCell>{r.is_active ? <Badge className="bg-green-500">Aktiv</Badge> : <Badge variant="secondary">Deaktiv</Badge>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(r)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500" onClick={() => remove.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>);

};