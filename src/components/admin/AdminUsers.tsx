import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Search, Filter, MoreVertical, Shield, User, Ban, Edit, Crown, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
'@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import BlockUserDialog from '@/components/moderation/BlockUserDialog';

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  life_stage: string | null;
  partner_code: string | null;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
}

const AdminUsers = () => {
    const localize = useAdminLocalize();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'user'>('user');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchUserRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      // DÜZƏLİŞ: limitsiz `.select('*')` profiles 1000-i keçəndə (bizdə
      // qat-qat çoxdur) YALNIZ ilk 1000 istifadəçini gətirirdi — bu, ƏSAS
      // İstifadəçi İdarəetmə səhifəsi olduğu üçün ən kritik nümunələrdən biri idi.
      const data = await fetchAllRows<UserProfile>((from, to) =>
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).range(from, to)
      );
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: tr("adminusers_xeta_3cdbb6", "Xəta"),
        description: tr("adminusers_istifadeciler_yuklene_bilmedi_3c369d", "İstifadəçilər yüklənə bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRoles = async () => {
    try {
      const data = await fetchAllRows<UserRole>((from, to) =>
        supabase.from('user_roles').select('user_id, role').range(from, to)
      );
      setUserRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const getUserRole = (userId: string): 'admin' | 'moderator' | 'user' => {
    const role = userRoles.find((r) => r.user_id === userId);
    if (role?.role === 'admin') return 'admin';
    if (role?.role === 'moderator') return 'moderator';
    return 'user';
  };

  const handleUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      const { error } = await supabase.
      from('profiles').
      update(updates).
      eq('id', userId);

      if (error) throw error;

      toast({
        title: tr("adminusers_ugurlu_7fe64c", "Uğurlu"),
        description: tr("adminusers_i_stifadeci_melumatlari_yenile_b7069b", "\u0130stifad\u0259\xE7i m\u0259lumatlar\u0131 yenil\u0259ndi")
      });

      fetchUsers();
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: tr("adminusers_xeta_3cdbb6", "Xəta"),
        description: tr("adminusers_istifadeci_yenilene_bilmedi_62887d", "İstifadəçi yenilənə bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;

    try {
      // Check if user already has a role entry
      const existingRole = userRoles.find((r) => r.user_id === selectedUser.user_id);

      if (existingRole) {
        // Update existing role
        const { error } = await supabase.
        from('user_roles').
        update({ role: selectedRole }).
        eq('user_id', selectedUser.user_id);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase.
        from('user_roles').
        insert([{ user_id: selectedUser.user_id, role: selectedRole }]);

        if (error) throw error;
      }

      toast({
        title: tr("adminusers_ugurlu_7fe64c", "Uğurlu"),
        description: `${selectedUser.name} üçün ${getRoleLabel(selectedRole)} rolu təyin edildi`
      });

      fetchUserRoles();
      setRoleDialogOpen(false);
    } catch (error) {
      console.error('Error assigning role:', error);
      toast({
        title: tr("adminusers_xeta_3cdbb6", "Xəta"),
        description: tr("adminusers_rol_teyin_edile_bilmedi_8ddf00", "Rol təyin edilə bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;
    if (newPassword.length < 8) {
      toast({ title: tr("adminusers_xeta_3cdbb6", "Xəta"), description: tr("adminusers_sifre_en_azi_8_simvol_olmalidir_f7dd87", "Şifrə ən azı 8 simvol olmalıdır"), variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: tr("adminusers_xeta_3cdbb6", "Xəta"), description: tr("adminusers_sifreler_uygun_gelmir_af4b84", "Şifrələr uyğun gəlmir"), variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-change-user-password', {
        body: { user_id: selectedUser.user_id, new_password: newPassword }
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: tr("adminusers_ugurlu_7fe64c", "Uğurlu"), description: `${selectedUser.name} üçün şifrə yeniləndi` });
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error changing password:', err);
      toast({ title: tr("adminusers_xeta_3cdbb6", "Xəta"), description: err?.message || tr("adminusers_sifre_yenilene_bilmedi_4ba698", "\u015Eifr\u0259 yenil\u0259n\u0259 bilm\u0259di"), variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const filteredUsers = users.filter((user) =>
  user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLifeStageLabel = (stage: string | null) => {
    switch (stage) {
      case 'flow':return 'Menstruasiya';
      case 'bump':return tr("adminusers_hamilelik_e86feb", "Hamil\u0259lik");
      case 'mommy':return tr("adminusers_analiq_9e762d", "Anal\u0131q");
      case 'partner':return 'Partnyor';
      default:return tr("adminusers_mueyyen_edilmeyib_2d0de2", "M\xFC\u0259yy\u0259n edilm\u0259yib");
    }
  };

  const getLifeStageColor = (stage: string | null) => {
    switch (stage) {
      case 'flow':return 'bg-pink-500/10 text-pink-500';
      case 'bump':return 'bg-purple-500/10 text-purple-500';
      case 'mommy':return 'bg-green-500/10 text-green-500';
      case 'partner':return 'bg-blue-500/10 text-blue-500';
      default:return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':return 'Admin';
      case 'moderator':return 'Moderator';
      default:return tr("adminusers_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i");
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'moderator':return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':return <Crown className="w-3 h-3" />;
      case 'moderator':return <Shield className="w-3 h-3" />;
      default:return <User className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminusers_istifadeciler_1dd7b9", "İstifadəçilər")}</h1>
          <p className="text-muted-foreground">{tr("adminusers_butun_istifadecileri_idare_edin_42b284", "Bütün istifadəçiləri idarə edin")}</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {users.length} {tr("adminusers_istifadeci_84a198", "istifad\u0259\xE7i")}
        </Badge>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={tr("adminusers_ad_ve_ya_email_ile_axtar_335c5a", "Ad və ya email ilə axtar...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10" />
            
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start p-4 font-medium text-muted-foreground">{tr("adminusers_istifadeci_b6bdd6", "İstifadəçi")}</th>
                <th className="text-start p-4 font-medium text-muted-foreground">{tr("adminusers_merhele_0e09aa", "Mərhələ")}</th>
                <th className="text-start p-4 font-medium text-muted-foreground">Rol</th>
                <th className="text-start p-4 font-medium text-muted-foreground">Partner Kodu</th>
                <th className="text-start p-4 font-medium text-muted-foreground">Tarix</th>
                <th className="text-end p-4 font-medium text-muted-foreground">{tr("adminusers_emeliyyatlar_54d70c", "Əməliyyatlar")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ?
              <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {tr("adminusers_yuklenir_5557de", "Y\xFCkl\u0259nir...")}
                  </td>
                </tr> :
              filteredUsers.length === 0 ?
              <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {tr("adminusers_i_stifadeci_tapilmadi_4e2156", "\u0130stifad\u0259\xE7i tap\u0131lmad\u0131")}
                  </td>
                </tr> :

              filteredUsers.map((user, index) => {
                const userRole = getUserRole(user.user_id);
                return (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-muted/30">
                    
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-bold">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={getLifeStageColor(user.life_stage)}>
                          {getLifeStageLabel(user.life_stage)}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={`${getRoleColor(userRole)} flex items-center gap-1 w-fit`}>
                          {getRoleIcon(userRole)}
                          {getRoleLabel(userRole)}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {user.partner_code || '-'}
                        </code>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('az-AZ')}
                      </td>
                      <td className="p-4 text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setEditDialogOpen(true);
                          }}>
                              <Edit className="w-4 h-4 me-2" />
                              {tr("adminusers_redakte_et_66cf3b", "Redakt\u0259 et")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setSelectedRole(getUserRole(user.user_id));
                            setRoleDialogOpen(true);
                          }}>
                              <Shield className="w-4 h-4 me-2" />
                              {tr("adminusers_rol_teyin_et_41b431", "Rol t\u0259yin et")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordDialogOpen(true);
                          }}>
                              <KeyRound className="w-4 h-4 me-2" />
                              {tr("adminusers_sifreni_deyis_a48972", "\u015Eifr\u0259ni d\u0259yi\u015F")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {/* Əvvəllər burada onClick-i OLMAYAN ölü "Sil" düyməsi var idi —
                                moderasiya üçün işlək "Blokla" ilə əvəzləndi */}
                            <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedUser(user);
                              setBlockDialogOpen(true);
                            }}>
                              <Ban className="w-4 h-4 me-2" />
                              {tr("adminusers_blokla", "Blokla")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>);

              })
              }
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("adminusers_istifadecini_redakte_et_f6c153", "İstifadəçini Redaktə Et")}</DialogTitle>
          </DialogHeader>
          {selectedUser &&
          <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Ad</label>
                <Input
                value={selectedUser.name}
                onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })} />
              
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminusers_merhele_0e09aa", "Mərhələ")}</label>
                <Select
                value={selectedUser.life_stage || ''}
                onValueChange={(value) => setSelectedUser({ ...selectedUser, life_stage: value })}>
                
                  <SelectTrigger>
                    <SelectValue placeholder={tr("adminusers_merhele_secin_a3f9bb", "Mərhələ seçin")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flow">Menstruasiya</SelectItem>
                    <SelectItem value="bump">{tr("adminusers_hamilelik_e86feb", "Hamiləlik")}</SelectItem>
                    <SelectItem value="mommy">{tr("adminusers_analiq_9e762d", "Analıq")}</SelectItem>
                    <SelectItem value="partner">Partnyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
              className="w-full"
              onClick={() => handleUpdateUser(selectedUser.id, {
                name: selectedUser.name,
                life_stage: selectedUser.life_stage
              })}>
              
                Yadda saxla
              </Button>
            </div>
          }
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("adminusers_rol_teyin_et_ec751c", "Rol Təyin Et")}</DialogTitle>
          </DialogHeader>
          {selectedUser &&
          <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">
                    {selectedUser.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{tr("adminusers_rol_secin_7dccbd", "Rol seçin")}</label>
                <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as 'admin' | 'moderator' | 'user')}>
                
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {tr("adminusers_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}
                      </div>
                    </SelectItem>
                    <SelectItem value="moderator">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        Moderator
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-red-500" />
                        Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {tr("adminusers_admin_rollu_istifadeciler_butu_789e17", "\u26A0\uFE0F Admin rollu istifad\u0259\xE7il\u0259r b\xFCt\xFCn sistem funksiyalar\u0131na tam giri\u015F \u0259ld\u0259 ed\u0259c\u0259k.")}
                </p>
              </div>

              <Button className="w-full" onClick={handleAssignRole}>
                {tr("adminusers_rolu_teyin_et_e61864", "Rolu T\u0259yin Et")}
              </Button>
            </div>
          }
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("adminusers_istifadecinin_sifresini_deyis_15d6c7", "İstifadəçinin şifrəsini dəyiş")}</DialogTitle>
          </DialogHeader>
          {selectedUser &&
          <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">
                    {selectedUser.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{tr("adminusers_yeni_sifre_8f04c6", "Yeni şifrə")}</label>
                <div className="relative">
                  <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={tr("adminusers_en_azi_8_simvol_168104", "Ən azı 8 simvol")}
                  className="pe-10" />
                
                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{tr("adminusers_sifreni_tesdiqle_6b3e17", "Şifrəni təsdiqlə")}</label>
                <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={tr("adminusers_yeni_sifreni_tekrar_daxil_edin_3c87dd", "Yeni şifrəni təkrar daxil edin")} />
              
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {tr("adminusers_i_stifadeci_yeni_sifre_ile_yen_60d0cc", "\u26A0\uFE0F \u0130stifad\u0259\xE7i yeni \u015Fifr\u0259 il\u0259 yenid\u0259n daxil olmal\u0131 olacaq.")}
                </p>
              </div>

              <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}>
              
                {changingPassword ? tr("adminusers_yenilenir_3017dc", "Yenil\u0259nir...") : tr("adminusers_sifreni_deyis_1d1a1f", "\u015Eifr\u0259ni D\u0259yi\u015F")}
              </Button>
            </div>
          }
        </DialogContent>
      </Dialog>

      {/* İstifadəçini blokla (community/tam, müddət + səbəb) */}
      <BlockUserDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        userId={selectedUser?.user_id || null}
        userName={selectedUser?.name || null} />
    </div>);

};

export default AdminUsers;