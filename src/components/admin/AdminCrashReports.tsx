import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Trash2, RefreshCw, Smartphone, Monitor, Apple } from 'lucide-react';
import { toast } from 'sonner';

interface CrashReport {
  id: string;
  user_id: string | null;
  error_message: string;
  error_stack: string | null;
  component_stack: string | null;
  url: string | null;
  user_agent: string | null;
  app_version: string | null;
  platform: string | null;
  extra_data: any;
  created_at: string;
}

const AdminCrashReports = () => {
  const [reports, setReports] = useState<CrashReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchReports = async () => {
    setLoading(true);
    let query = supabase.
    from('crash_reports').
    select('*').
    order('created_at', { ascending: false }).
    limit(200);

    if (filter !== 'all') {
      query = query.eq('platform', filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(tr("admincrashreports_crash_reportlari_yuklenmedi_d4ba13", "Crash reportlar\u0131 y\xFCkl\u0259nm\u0259di"));
    } else {
      setReports(data as any[] || []);
    }
    setLoading(false);
  };

  useEffect(() => {fetchReports();}, [filter]);

  const deleteReport = async (id: string) => {
    await supabase.from('crash_reports').delete().eq('id', id);
    setReports((r) => r.filter((x) => x.id !== id));
    toast.success('Silindi');
  };

  const deleteAll = async () => {
    if (!confirm(tr("admincrashreports_butun_crash_reportlari_silinsi_4f4311", "B\xFCt\xFCn crash reportlar\u0131 silinsin?"))) return;
    await supabase.from('crash_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setReports([]);
    toast.success(tr("admincrashreports_hamisi_silindi_3b8089", "Ham\u0131s\u0131 silindi"));
  };

  const platformIcon = (p: string | null) => {
    if (p === 'android') return <Smartphone className="w-4 h-4 text-green-500" />;
    if (p === 'ios') return <Apple className="w-4 h-4 text-gray-500" />;
    return <Monitor className="w-4 h-4 text-blue-500" />;
  };

  const grouped = reports.reduce<Record<string, CrashReport[]>>((acc, r) => {
    const key = r.error_message.slice(0, 100);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Crash Reports ({reports.length})
        </h2>
        <div className="flex gap-2">
          {['all', 'android', 'ios', 'web'].map((f) =>
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'}
          onClick={() => setFilter(f)}>
              {f === 'all' ? tr("admincrashreports_hamisi_c73c4d", "Ham\u0131s\u0131") : f}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={fetchReports}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={deleteAll}>
            <Trash2 className="w-4 h-4 me-1" /> {tr("admincrashreports_hamisini_sil_f6a3d6", "Ham\u0131s\u0131n\u0131 sil")}
          </Button>
        </div>
      </div>

      {loading ?
      <p className="text-muted-foreground">{tr("admincrashreports_yuklenir_5557de", "Yüklənir...")}</p> :
      reports.length === 0 ?
      <Card><CardContent className="py-8 text-center text-muted-foreground">Crash report yoxdur 🎉</CardContent></Card> :

      <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2">
            {Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).map(([msg, items]) =>
          <Card key={msg} className="cursor-pointer" onClick={() => setExpandedId(expandedId === msg ? null : msg)}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {platformIcon(items[0].platform)}
                      <CardTitle className="text-sm font-medium truncate">{msg}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">{items.length}x</Badge>
                      <Badge variant="outline">{items[0].app_version || '?'}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(items[0].created_at).toLocaleDateString('az')}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                {expandedId === msg &&
            <CardContent className="pt-0 px-4 pb-4 space-y-3">
                    {items.slice(0, 5).map((r) =>
              <div key={r.id} className="border rounded p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('az')}</span>
                          <div className="flex items-center gap-2">
                            <span>{r.platform}</span>
                            <Button size="sm" variant="ghost" onClick={(e) => {e.stopPropagation();deleteReport(r.id);}}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {r.url && <div><strong>URL:</strong> {r.url}</div>}
                        {r.user_id && <div><strong>User:</strong> {r.user_id.slice(0, 8)}...</div>}
                        {r.error_stack &&
                <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto max-h-32 whitespace-pre-wrap">
                            {r.error_stack}
                          </pre>
                }
                        {r.extra_data &&
                <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
                            {JSON.stringify(r.extra_data, null, 2)}
                          </pre>
                }
                      </div>
              )}
                    {items.length > 5 && <p className="text-xs text-muted-foreground">+{items.length - 5} daha...</p>}
                  </CardContent>
            }
              </Card>
          )}
          </div>
        </ScrollArea>
      }
    </div>);

};

export default AdminCrashReports;