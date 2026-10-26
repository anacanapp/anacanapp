import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, Package, MoreVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
'@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  rating: number | null;
  stock: number;
  is_active: boolean;
  created_at: string;
}

const categories = [tr("adminproducts_hamilelik_e86feb", "Hamil\u0259lik"), tr("adminproducts_korpe_fa2b51", "K\xF6rp\u0259"), tr("adminproducts_analiq_9e762d", "Anal\u0131q"),



'Geyim', tr("adminproducts_beslenme_6014ad", "B\u0259sl\u0259nm\u0259"), tr("adminproducts_derman_8b4b27", "D\u0259rman")];




const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    image_url: '',
    category: '',
    stock: 0,
    is_active: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.
      from('products').
      select('*').
      order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingProduct) {
        const { error } = await supabase.
        from('products').
        update(formData).
        eq('id', editingProduct.id);

        if (error) throw error;
        toast({ title: tr("adminproducts_ugurlu_7fe64c", "Uğurlu"), description: tr("adminproducts_mehsul_yenilendi_294d27", "Məhsul yeniləndi") });
      } else {
        const { error } = await supabase.
        from('products').
        insert([formData]);

        if (error) throw error;
        toast({ title: tr("adminproducts_ugurlu_7fe64c", "Uğurlu"), description: tr("adminproducts_mehsul_elave_edildi_f09ac4", "Məhsul əlavə edildi") });
      }

      fetchProducts();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: tr("adminproducts_xeta_3cdbb6", "Xəta"),
        description: tr("adminproducts_mehsul_yadda_saxlanila_bilmedi_3ea27d", "Məhsul yadda saxlanıla bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.
      from('products').
      delete().
      eq('id', id);

      if (error) throw error;
      toast({ title: tr("adminproducts_ugurlu_7fe64c", "Uğurlu"), description: tr("adminproducts_mehsul_silindi_e284ab", "Məhsul silindi") });
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: tr("adminproducts_xeta_3cdbb6", "Xəta"),
        description: tr("adminproducts_mehsul_siline_bilmedi_84d362", "Məhsul silinə bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price,
      image_url: product.image_url || '',
      category: product.category,
      stock: product.stock,
      is_active: product.is_active
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      image_url: '',
      category: '',
      stock: 0,
      is_active: true
    });
  };

  const filteredProducts = products.filter((product) =>
  product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminproducts_mehsullar_24a4ce", "Məhsullar")}</h1>
          <p className="text-muted-foreground">{tr("adminproducts_magaza_mehsullarini_idare_edin_d82f10", "Mağaza məhsullarını idarə edin")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {tr("adminproducts_yeni_mehsul_cd3d1a", "Yeni M\u0259hsul")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? tr("adminproducts_mehsulu_redakte_et_0a1ac6", "M\u0259hsulu Redakt\u0259 Et") : tr("adminproducts_yeni_mehsul_cd3d1a", "Yeni M\u0259hsul")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Ad</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={tr("adminproducts_mehsul_adi_0495ad", "Məhsul adı")} />
                
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminproducts_tesvir_f85651", "Təsvir")}</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={tr("adminproducts_mehsul_tesviri_4d8420", "Məhsul təsviri")} />
                
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{tr("adminproducts_qiymet_ef61c0", "Qiymət (₼)")}</label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                  
                </div>
                <div>
                  <label className="text-sm font-medium">Stok</label>
                  <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })} />
                  
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Kateqoriya</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  
                  <SelectTrigger>
                    <SelectValue placeholder={tr("adminproducts_kateqoriya_secin_706eed", "Kateqoriya seçin")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) =>
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminproducts_sekil_url_d302df", "Şəkil URL")}</label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..." />
                
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Aktiv</label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                
              </div>
              <Button className="w-full" onClick={handleSubmit}>
                {editingProduct ? tr("adminproducts_yenile_570ce2", "Yenil\u0259") : tr("adminproducts_elave_et_6e1b9b", "\u018Flav\u0259 et")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tr("adminproducts_mehsul_axtar_580a05", "Məhsul axtar...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10" />
          
        </div>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ?
        Array(8).fill(0).map((_, i) =>
        <Card key={i} className="p-4 animate-pulse">
              <div className="aspect-square bg-muted rounded-lg mb-3" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </Card>
        ) :
        filteredProducts.length === 0 ?
        <Card className="col-span-full p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{tr("adminproducts_mehsul_tapilmadi_ff5957", "Məhsul tapılmadı")}</p>
          </Card> :

        filteredProducts.map((product, index) =>
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}>
          
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-muted relative">
                  {product.image_url ?
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover" /> :


              <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-muted-foreground" />
                    </div>
              }
                  {!product.is_active &&
              <Badge className="absolute top-2 start-2 bg-red-500">
                      Deaktiv
                    </Badge>
              }
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(product)}>
                          <Edit className="w-4 h-4 me-2" />
                          {tr("adminproducts_redakte_et_66cf3b", "Redakt\u0259 et")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(product.id)}>
                      
                          <Trash2 className="w-4 h-4 me-2" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold text-primary">
                      ₼{product.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Stok: {product.stock}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
        )
        }
      </div>
    </div>);

};

export default AdminProducts;