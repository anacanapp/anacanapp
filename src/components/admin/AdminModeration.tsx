import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Search, MessageSquare, Ban, Trash2, AlertTriangle, Check, Flag, XCircle, CheckCircle, Image, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow, format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import BlockUserDialog from '@/components/moderation/BlockUserDialog';
import { moderationText } from '@/lib/community-moderation-i18n';
import ModeratorActionDialog from '@/components/moderation/ModeratorActionDialog';
import { moderatorError, type ModeratorTarget } from '@/lib/moderator';
import { useUserStore } from '@/store/userStore';

interface Post {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  is_active: boolean;
  likes_count: number;
  comments_count: number;
  media_urls?: string[] | null;
  author?: {name: string;avatar_url?: string | null;};
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  post_id: string;
  created_at: string;
  is_active: boolean;
  author?: {name: string;avatar_url?: string | null;};
}

interface BlockedUser {
  id: string;
  user_id: string;
  blocked_by: string;
  reason: string;
  block_type: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  user?: {name: string;avatar_url?: string | null;};
}

interface Report {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  post?: {content: string;user_id: string;media_urls?: string[] | null;};
  reporter?: {name: string;avatar_url?: string | null;};
  postAuthor?: {name: string;avatar_url?: string | null;};
}

const AdminModeration = ({ onNavigate }: { onNavigate?: (section: string) => void }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'reports' | 'posts' | 'comments' | 'blocks'>('reports');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockUserId, setBlockUserId] = useState<string>('');
  const [removeTarget, setRemoveTarget] = useState<{ target: ModeratorTarget; reportId?: string } | null>(null);

  const fetchReports = async () => {
    // Use type assertion for new table not yet in generated types
    // DÜZƏLİŞ: limitsiz idi — post_reports 1000-i keçəndə moderasiya
    // növbəsi yalnız ilk 1000 şikayəti göstərirdi.
    const data = await fetchAllRows((from, to) =>
      (supabase as any).from('post_reports').select('*').order('created_at', { ascending: false }).range(from, to)
    );

    if (data) {
      // Fetch post info including media_urls
      const postIds = [...new Set(data.map((r: any) => r.post_id))];
      const reporterIds = [...new Set(data.map((r: any) => r.reporter_id))];

      const { data: postsData } = await supabase.
      from('community_posts').
      select('id, content, user_id, media_urls').
      in('id', postIds as string[]);

      // Get all user IDs (reporters + post authors)
      const postAuthorIds = (postsData || []).map((p: any) => p.user_id);
      const allUserIds = [...new Set([...reporterIds, ...postAuthorIds])] as string[];

      // Fetch from public_profile_cards (bypasses RLS)
      const profileMap = await getPublicProfileCards(allUserIds);

      const reportsWithData = data.map((report: any) => {
        const post = postsData?.find((p: any) => p.id === report.post_id);
        return {
          ...report,
          post,
          reporter: profileMap[report.reporter_id] || null,
          postAuthor: post ? profileMap[post.user_id] || null : null
        };
      });
      setReports(reportsWithData);
    }
  };

  const fetchPosts = async () => {
    const { data, error } = await supabase.
    from('community_posts').
    select('*').
    order('created_at', { ascending: false }).
    limit(100);

    if (!error && data) {
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const profileMap = await getPublicProfileCards(userIds);

      setPosts(data.map((p) => ({
        ...p,
        author: profileMap[p.user_id] || { name: tr("adminmoderation_istifadeci_b6bdd6", "İstifadəçi"), avatar_url: null }
      })));
    }
  };

  const fetchComments = async () => {
    const { data, error } = await supabase.
    from('post_comments').
    select('*').
    order('created_at', { ascending: false }).
    limit(100);

    if (!error && data) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const profileMap = await getPublicProfileCards(userIds);

      setComments(data.map((c) => ({
        ...c,
        author: profileMap[c.user_id] || { name: tr("adminmoderation_istifadeci_b6bdd6", "İstifadəçi"), avatar_url: null }
      })));
    }
  };

  const fetchBlocks = async () => {
    const data = await fetchAllRows((from, to) =>
      supabase.from('user_blocks').select('*').order('created_at', { ascending: false }).range(from, to)
    );

    if (data) {
      const userIds = data.map((b) => b.user_id);
      const profileMap = await getPublicProfileCards(userIds);

      const blocksWithUsers = data.map((block) => ({
        ...block,
        user: profileMap[block.user_id] || { name: tr("adminmoderation_istifadeci_b6bdd6", "İstifadəçi"), avatar_url: null }
      }));
      setBlocks(blocksWithUsers);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchReports(), fetchPosts(), fetchComments(), fetchBlocks()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReportAction = async (reportId: string, action: 'reviewed' | 'dismissed', postId?: string) => {
    if (action === 'reviewed' && postId) {
      const report = reports.find(value => value.id === reportId);
      if (report?.post) setRemoveTarget({ target: { kind: 'post', id: postId, userId: report.post.user_id,
        content: report.post.content, name: report.postAuthor?.name }, reportId });
      return;
    }
    const { error } = await (supabase as any).rpc('moderator_report_decide_v1', {
      p_report: reportId, p_decision: action, p_request: crypto.randomUUID(),
    });
    if (error) {
      toast({ title: moderatorError(error, useUserStore.getState().language), variant: 'destructive' });
      return;
    }
    toast({ title: tr("adminmoderation_ugurlu_7fe64c", "Uğurlu") });
    fetchReports();
    fetchPosts();
  };

  const deletePost = async (postId: string) => {
    const post = posts.find(value => value.id === postId);
    if (post) setRemoveTarget({ target: { kind: 'post', id: post.id, userId: post.user_id, content: post.content, name: post.author?.name } });
  };

  const deleteComment = async (commentId: string) => {
    const comment = comments.find(value => value.id === commentId);
    if (comment) setRemoveTarget({ target: { kind: 'comment', id: comment.id, userId: comment.user_id, content: comment.content, name: comment.author?.name } });
  };

  const unblockUser = async (blockId: string) => {
    if (!confirm(tr("adminmoderation_bu_istifadecinin_blokunu_acmaq_b0d1f5", "Bu istifad\u0259\xE7inin blokunu a\xE7maq ist\u0259yirsiniz?"))) return;

    const block = blocks.find(value => value.id === blockId);
    if (!block) return;
    const { error } = await (supabase as any).rpc('moderator_user_action_v1', {
      p_user: block.user_id, p_action: 'unrestrict', p_reason: 'other', p_detail: '',
      p_options: { restriction_id: blockId }, p_request: crypto.randomUUID(),
    });

    if (error) {
      toast({ title: tr("adminmoderation_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: tr("adminmoderation_ugurlu_7fe64c", "Uğurlu"), description: tr("adminmoderation_blok_acildi_d339d9", "Blok açıldı") });
      fetchBlocks();
    }
  };

  const openBlockModal = (userId: string) => {
    setBlockUserId(userId);
    setShowBlockModal(true);
  };

  const pendingReports = reports.filter((r) => r.status === 'pending');
  const filteredPosts = posts.filter((p) =>
  p.content?.toLowerCase().includes(search.toLowerCase()) ||
  p.author?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredComments = comments.filter((c) =>
  c.content?.toLowerCase().includes(search.toLowerCase()) ||
  c.author?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      {removeTarget && <ModeratorActionDialog target={removeTarget.target} action="remove" onClose={() => setRemoveTarget(null)} onDone={() => {
        const reportId = removeTarget.reportId;
        if (reportId) void handleReportAction(reportId, 'reviewed');
        void fetchData();
      }} />}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Moderasiya</h1>
        </div>
        {pendingReports.length > 0 &&
        <Badge variant="destructive" className="text-sm px-3 py-1">
            {pendingReports.length} {tr("adminmoderation_yeni_sikayet_9571c6", "yeni \u015Fikay\u0259t")}
          </Badge>
        }
      </div>

      {onNavigate && <Button variant="outline" className="mb-4 min-h-11 h-auto whitespace-normal" onClick={() => onNavigate('ad-moderation')}>
        <AlertTriangle size={16} />{moderationText('title')}
      </Button>}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full mb-6">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            <span className="hidden sm:inline">{tr("adminmoderation_sikayetler_4ad77f", "Şikayətlər")}</span>
            {pendingReports.length > 0 &&
            <Badge variant="destructive" className="ms-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingReports.length}
              </Badge>
            }
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Postlar</span>
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{tr("adminmoderation_serhler_30d5d9", "Şərhlər")}</span>
          </TabsTrigger>
          <TabsTrigger value="blocks" className="flex items-center gap-2">
            <Ban className="w-4 h-4" />
            <span className="hidden sm:inline">Bloklar</span>
          </TabsTrigger>
        </TabsList>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Axtar..."
              className="ps-10" />
            
          </div>
        </div>

        {loading ?
        <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div> :

        <>
            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-3">
              {reports.length === 0 ?
            <div className="text-center py-12 text-muted-foreground">
                  <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{tr("adminmoderation_hec_bir_sikayet_yoxdur_a67bd4", "Heç bir şikayət yoxdur")}</p>
                </div> :

            reports.map((report) =>
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-card rounded-xl p-4 border ${
              report.status === 'pending' ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border'}`
              }>
              
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                report.status === 'pending' ?
                'bg-amber-100 text-amber-600' :
                report.status === 'reviewed' ?
                'bg-green-100 text-green-600' :
                'bg-muted text-muted-foreground'}`
                }>
                        <Flag className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant={
                    report.status === 'pending' ? 'default' :
                    report.status === 'reviewed' ? 'secondary' : 'outline'
                    }>
                            {report.status === 'pending' ? tr("adminmoderation_gozleyir_9ac18a", "G\xF6zl\u0259yir") :
                      report.status === 'reviewed' ? tr("adminmoderation_yoxlanildi_fc524b", "Yoxlan\u0131ld\u0131") : tr("adminmoderation_redd_edildi_c40149", "R\u0259dd edildi")}
                          </Badge>
                          <Badge variant="outline">{report.reason}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: getCurrentDateLocale() })}
                          </span>
                        </div>

                        {/* Reporter info */}
                        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {report.reporter?.avatar_url ?
                      <img src={report.reporter.avatar_url} alt="" className="w-full h-full object-cover" /> :

                      <span className="text-blue-600 font-bold text-sm">
                                {report.reporter?.name?.charAt(0) || 'İ'}
                              </span>
                      }
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{tr("adminmoderation_sikayet_eden_17501b", "Şikayət edən:")}</span>
                            <span className="font-medium">{report.reporter?.name || tr("adminmoderation_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}</span>
                          </div>
                        </div>
                        
                        {/* Post and author info */}
                        {report.post &&
                  <div className="bg-muted/50 rounded-lg p-4 border border-border">
                            {/* Post author */}
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {report.postAuthor?.avatar_url ?
                        <img src={report.postAuthor.avatar_url} alt="" className="w-full h-full object-cover" /> :

                        <span className="text-primary font-bold text-sm">
                                    {report.postAuthor?.name?.charAt(0) || 'İ'}
                                  </span>
                        }
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">{tr("adminmoderation_post_muellifi_f1677f", "Post müəllifi:")}</span>
                                <span className="font-medium">{report.postAuthor?.name || tr("adminmoderation_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}</span>
                              </div>
                            </div>
                            
                            {/* Post content - full display */}
                            <p className="text-sm whitespace-pre-wrap mb-3">{report.post.content}</p>
                            
                            {/* Post media */}
                            {report.post.media_urls && report.post.media_urls.length > 0 &&
                    <div className="grid grid-cols-2 gap-2 mt-3">
                                {report.post.media_urls.map((url, idx) => {
                        const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
                        return (
                          <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                                      {isVideo ?
                            <div className="w-full h-full flex items-center justify-center">
                                          <video src={url} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <Video className="w-8 h-8 text-white" />
                                          </div>
                                        </div> :

                            <img src={url} alt="" className="w-full h-full object-cover" />
                            }
                                    </div>);

                      })}
                              </div>
                    }
                          </div>
                  }

                        {/* Report description if any */}
                        {report.description &&
                  <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">{tr("adminmoderation_elave_qeyd_58e864", "Əlavə qeyd:")}</p>
                            <p className="text-sm">{report.description}</p>
                          </div>
                  }
                      </div>
                      {report.status === 'pending' &&
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleReportAction(report.id, 'reviewed', report.post_id)}
                    className="text-green-600 hover:bg-green-100"
                    title={tr("adminmoderation_sikayeti_qebul_et_ve_postu_sil_45452a", "Şikayəti qəbul et və postu sil")}>
                    
                            <CheckCircle className="w-5 h-5" />
                          </Button>
                          <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleReportAction(report.id, 'dismissed')}
                    className="text-red-600 hover:bg-red-100"
                    title={tr("adminmoderation_sikayeti_redd_et_184bc2", "Şikayəti rədd et")}>
                    
                            <XCircle className="w-5 h-5" />
                          </Button>
                        </div>
                }
                    </div>
                  </motion.div>
            )
            }
            </TabsContent>

            <TabsContent value="posts" className="space-y-3">
              {filteredPosts.map((post) =>
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl p-4 border border-border">
              
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {post.author?.avatar_url ?
                  <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" /> :

                  <span className="font-bold text-primary">{post.author?.name?.charAt(0) || 'İ'}</span>
                  }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{post.author?.name || tr("adminmoderation_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: getCurrentDateLocale() })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-2 whitespace-pre-wrap">{post.content}</p>
                      
                      {/* Post media */}
                      {post.media_urls && post.media_urls.length > 0 &&
                  <div className="grid grid-cols-2 gap-2 mb-2">
                          {post.media_urls.slice(0, 4).map((url, idx) => {
                      const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
                      return (
                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                                {isVideo ?
                          <div className="w-full h-full flex items-center justify-center">
                                    <video src={url} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <Video className="w-6 h-6 text-white" />
                                    </div>
                                  </div> :

                          <img src={url} alt="" className="w-full h-full object-cover" />
                          }
                              </div>);

                    })}
                        </div>
                  }
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>❤️ {post.likes_count || 0}</span>
                        <span>💬 {post.comments_count || 0}</span>
                        {post.media_urls && post.media_urls.length > 0 &&
                    <span className="flex items-center gap-1">
                            <Image className="w-3 h-3" /> {post.media_urls.length}
                          </span>
                    }
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openBlockModal(post.user_id)}>
                    
                        <Ban className="w-4 h-4 text-amber-500" />
                      </Button>
                      <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePost(post.id)}>
                    
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
            )}
            </TabsContent>

            <TabsContent value="comments" className="space-y-3">
              {filteredComments.map((comment) =>
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl p-4 border border-border">
              
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {comment.author?.name?.charAt(0) || 'İ'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{comment.author?.name || tr("adminmoderation_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: getCurrentDateLocale() })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openBlockModal(comment.user_id)}>
                    
                        <Ban className="w-4 h-4 text-amber-500" />
                      </Button>
                      <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteComment(comment.id)}>
                    
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
            )}
            </TabsContent>

            <TabsContent value="blocks" className="space-y-3">
              {blocks.map((block) =>
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-card rounded-xl p-4 border ${block.is_active ? 'border-red-200' : 'border-border'}`}>
              
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                block.is_active ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`
                }>
                      <Ban className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{block.user?.name || tr("adminmoderation_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}</span>
                        <Badge variant={block.is_active ? 'destructive' : 'secondary'}>
                          {block.is_active ? 'Aktiv' : tr("adminmoderation_acilib_1f71a5", "A\xE7\u0131l\u0131b")}
                        </Badge>
                        <Badge variant="outline">{block.block_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">ID: {block.user_id.substring(0, 8)}...</p>
                      <p className="text-sm text-red-600 mt-1">{tr("adminmoderation_sebeb_e614c3", "S\u0259b\u0259b:")} {block.reason}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {block.expires_at ?
                    `${tr("adminmoderation_bitme", "Bitmə:")} ${format(new Date(block.expires_at), 'dd.MM.yyyy HH:mm')}` :
                    tr("adminmoderation_daimi", "Daimi")}
                      </p>
                    </div>
                    {block.is_active &&
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unblockUser(block.id)}>
                  
                        <Check className="w-4 h-4 me-1" />
                        {tr("adminmoderation_bloku_ac_b83fbb", "Bloku A\xE7")}
                      </Button>
                }
                  </div>
                </motion.div>
            )}
            </TabsContent>
          </>
        }
      </Tabs>

      {/* Block User Modal — paylaşılan dialog (müddət + səbəb + növ) */}
      <BlockUserDialog
        open={showBlockModal}
        onOpenChange={setShowBlockModal}
        userId={blockUserId || null}
        onDone={fetchBlocks} />
    </div>);

};

export default AdminModeration;
