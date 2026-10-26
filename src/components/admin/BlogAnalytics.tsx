import { useMemo } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  TrendingUp, Eye, Heart, MessageCircle, Bookmark,
  BarChart3, Calendar, Award } from
'lucide-react';
import { BlogPost } from '@/hooks/useBlog';
import { format, subDays, isAfter } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar } from
'recharts';

interface BlogAnalyticsProps {
  posts: BlogPost[];
}

const BlogAnalytics = ({ posts }: BlogAnalyticsProps) => {
  const analytics = useMemo(() => {
    // Total stats
    const totalViews = posts.reduce((sum, p) => sum + (p.view_count || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + ((p as any).likes_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + ((p as any).comments_count || 0), 0);
    const totalSaves = posts.reduce((sum, p) => sum + ((p as any).saves_count || 0), 0);

    // Top 5 most viewed
    const topViewed = [...posts].
    sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).
    slice(0, 5);

    // Weekly trend (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayPosts = posts.filter((p) => {
        const postDate = new Date(p.created_at);
        return format(postDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      });

      weeklyData.push({
        day: format(date, 'EEE', { locale: getCurrentDateLocale() }),
        posts: dayPosts.length,
        views: dayPosts.reduce((sum, p) => sum + (p.view_count || 0), 0)
      });
    }

    // Category distribution
    const categoryStats: Record<string, number> = {};
    posts.forEach((p) => {
      categoryStats[p.category] = (categoryStats[p.category] || 0) + 1;
    });

    const categoryData = Object.entries(categoryStats).
    map(([name, count]) => ({ name, count })).
    sort((a, b) => b.count - a.count);

    // Recent week views
    const weekAgo = subDays(new Date(), 7);
    const recentPosts = posts.filter((p) => isAfter(new Date(p.created_at), weekAgo));
    const weeklyViews = recentPosts.reduce((sum, p) => sum + (p.view_count || 0), 0);

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalSaves,
      topViewed,
      weeklyData,
      categoryData,
      weeklyViews,
      publishedCount: posts.filter((p) => p.is_published).length,
      draftCount: posts.filter((p) => !p.is_published).length
    };
  }, [posts]);

  const statCards = [
  {
    label: tr("bloganalytics_umumi_baxis_f27f07", "Ümumi Baxış"),
    value: analytics.totalViews.toLocaleString(),
    icon: Eye,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    label: tr("bloganalytics_beyenmeler_7c86a6", "Bəyənmələr"),
    value: analytics.totalLikes.toLocaleString(),
    icon: Heart,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10'
  },
  {
    label: tr("bloganalytics_serhler_30d5d9", "Şərhlər"),
    value: analytics.totalComments.toLocaleString(),
    icon: MessageCircle,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  {
    label: tr("bloganalytics_saxlanilanlar_8882c1", "Saxlanılanlar"),
    value: analytics.totalSaves.toLocaleString(),
    icon: Bookmark,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  }];


  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, index) =>
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-card rounded-xl border border-border p-4">
          
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        )}
      </div>

      {/* Weekly Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border p-4">
        
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">{tr("bloganalytics_heftelik_trend_e734f8", "Həftəlik Trend")}</h3>
          <span className="text-xs text-muted-foreground ms-auto">
            {tr("bloganalytics_bu_hefte_60eb9f", "Bu h\u0259ft\u0259:")} {analytics.weeklyViews} {tr("bloganalytics_baxis_d4da3e", "bax\u0131\u015F")}
          </span>
        </div>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }} />
              
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }} />
              
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} />
              
              <Line
                type="monotone"
                dataKey="views"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
                name={tr("bloganalytics_baxis_b54d29", "Bax\u0131\u015F")} />
              
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Viewed Articles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-4">
          
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-foreground">{tr("bloganalytics_en_cox_oxunanlar_d68b0f", "Ən Çox Oxunanlar")}</h3>
          </div>
          
          <div className="space-y-3">
            {analytics.topViewed.map((post, index) =>
            <div key={post.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
              index === 0 ?
              'bg-amber-500 text-white' :
              index === 1 ?
              'bg-slate-400 text-white' :
              index === 2 ?
              'bg-amber-700 text-white' :
              'bg-muted text-muted-foreground'}`
              }>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.view_count?.toLocaleString() || 0} {tr("bloganalytics_baxis_d4da3e", "bax\u0131\u015F")}
                  </p>
                </div>
              </div>
            )}
            
            {analytics.topViewed.length === 0 &&
            <p className="text-sm text-muted-foreground text-center py-4">{tr("bloganalytics_hele_meqale_yoxdur_b92aa5", "Hələ məqalə yoxdur")}</p>
            }
          </div>
        </motion.div>

        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-xl border border-border p-4">
          
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">{tr("bloganalytics_kateqoriya_paylanmasi_6a4800", "Kateqoriya Paylanması")}</h3>
          </div>
          
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.categoryData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false} />
                
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} />
                
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  name={tr("bloganalytics_meqale_sayi_8121ea", "M\u0259qal\u0259 say\u0131")} />
                
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Publication Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card rounded-xl border border-border p-4">
        
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">{tr("bloganalytics_nesr_statistikasi_8d2fed", "Nəşr Statistikası")}</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{analytics.publishedCount}</p>
            <p className="text-sm text-emerald-600">{tr("bloganalytics_derc_edilib_88064f", "Dərc edilib")}</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{analytics.draftCount}</p>
            <p className="text-sm text-amber-600">Qaralama</p>
          </div>
        </div>
      </motion.div>
    </div>);

};

export default BlogAnalytics;