import { useState, useMemo } from 'react';
import { tr } from '@/lib/tr';
import { DEEPLINK_ROUTES, generateDeeplink, DeeplinkRoute } from '@/lib/deeplink';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Link, ExternalLink, Search, Smartphone, Globe } from 'lucide-react';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminDeeplinks = () => {
    const localize = useAdminLocalize();
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<'universal' | 'scheme'>('universal');
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});

  const categories = useMemo(() => {
    const cats: Record<string, DeeplinkRoute[]> = {};
    DEEPLINK_ROUTES.forEach((r) => {
      if (!cats[r.category]) cats[r.category] = [];
      cats[r.category].push(r);
    });
    return cats;
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    const result: Record<string, DeeplinkRoute[]> = {};
    Object.entries(categories).forEach(([cat, routes]) => {
      const filtered = routes.filter((r) =>
      localize(r, 'label') ||
      r.pattern.toLowerCase().includes(q) ||
      r.key.toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[cat] = filtered;
    });
    return result;
  }, [categories, search]);

  // Extract param placeholders from pattern
  const getParams = (pattern: string): string[] => {
    const matches = pattern.match(/\{([^}]+)\}/g);
    return matches ? matches.map((m) => m.replace(/[{}]/g, '')) : [];
  };

  const getParamValue = (routeKey: string, paramName: string) => {
    return paramValues[routeKey]?.[paramName] || '';
  };

  const setParamValue = (routeKey: string, paramName: string, value: string) => {
    setParamValues((prev) => ({
      ...prev,
      [routeKey]: { ...prev[routeKey], [paramName]: value }
    }));
  };

  const getGeneratedLink = (route: DeeplinkRoute) => {
    const params = getParams(route.pattern);
    const values: Record<string, string> = {};
    params.forEach((p) => {
      values[p] = getParamValue(route.key, p) || `{${p}}`;
    });
    return generateDeeplink(route.pattern, values, format);
  };

  const copyLink = (route: DeeplinkRoute) => {
    const link = getGeneratedLink(route);
    navigator.clipboard.writeText(link);
    toast.success(tr("admindeeplinks_link_kopyalandi_63c33e", "Link kopyaland\u0131!"), { description: link });
  };

  const categoryEmojis: Record<string, string> = {
    'Əsas': '🏠',
    'Alətlər': '🔧',
    'Ekranlar': '📱',
    'Məzmun': '📝',
    'Mesajlar': '💬',
    'İcma': '👥',
    'Digər': '📋'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Link className="w-6 h-6 text-primary" />
            {tr("admindeeplinks_deeplink_i_dareetmesi_64da6a", "Deeplink \u0130dar\u0259etm\u0259si")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {tr("admindeeplinks_butun_deeplink_marsrutlarini_b_d5f795", "B\xFCt\xFCn deeplink mar\u015Frutlar\u0131n\u0131 burada g\xF6r\u0259 v\u0259 istifad\u0259 ed\u0259 bil\u0259rsiniz")}
          </p>
        </div>

        {/* Format toggle */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <Button
            size="sm"
            variant={format === 'universal' ? 'default' : 'ghost'}
            onClick={() => setFormat('universal')}
            className="gap-1.5">
            
            <Globe className="w-3.5 h-3.5" />
            Universal
          </Button>
          <Button
            size="sm"
            variant={format === 'scheme' ? 'default' : 'ghost'}
            onClick={() => setFormat('scheme')}
            className="gap-1.5">
            
            <Smartphone className="w-3.5 h-3.5" />
            anacan://
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Deeplink axtar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9" />
        
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm">Universal Links</span>
            </div>
            <code className="text-xs text-blue-700 dark:text-blue-400">https://app.anacan.az/tool/baby-names</code>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-sm">Custom Scheme</span>
            </div>
            <code className="text-xs text-purple-700 dark:text-purple-400">anacan://tool/baby-names</code>
          </CardContent>
        </Card>
      </div>

      {/* Route categories */}
      {Object.entries(filteredCategories).map(([category, routes]) =>
      <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span>{categoryEmojis[category] || '📎'}</span>
              {category}
              <Badge variant="secondary" className="ms-auto">{routes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routes.map((route) => {
            const params = getParams(route.pattern);
            const generatedLink = getGeneratedLink(route);

            return (
              <div
                key={route.key}
                className="border rounded-lg p-3 space-y-2 hover:border-primary/50 transition-colors">
                
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{route.label_az}</div>
                      <div className="text-xs text-muted-foreground">{route.description_az}</div>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono shrink-0">
                      {route.pattern}
                    </Badge>
                  </div>

                  {/* Param inputs */}
                  {params.length > 0 &&
                <div className="flex flex-wrap gap-2">
                      {params.map((param) =>
                  <Input
                    key={param}
                    placeholder={param}
                    value={getParamValue(route.key, param)}
                    onChange={(e) => setParamValue(route.key, param, e.target.value)}
                    className="h-8 text-xs max-w-[200px]" />

                  )}
                    </div>
                }

                  {/* Generated link + copy */}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded overflow-x-auto whitespace-nowrap">
                      {generatedLink}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyLink(route)} className="h-8 gap-1 shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                      Kopyala
                    </Button>
                  </div>
                </div>);

          })}
          </CardContent>
        </Card>
      )}

      {Object.keys(filteredCategories).length === 0 &&
      <div className="text-center py-12 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{tr("admindeeplinks_netice_tapilmadi_4b1b52", "Nəticə tapılmadı")}</p>
        </div>
      }
    </div>);

};

export default AdminDeeplinks;