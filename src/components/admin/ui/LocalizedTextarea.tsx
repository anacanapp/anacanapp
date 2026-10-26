import { Textarea } from '@/components/ui/textarea';
import { useAdminLanguage } from '@/contexts/AdminLanguageContext';

interface LocalizedTextareaProps {
  formData: any;
  setFormData: (data: any) => void;
  field: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function LocalizedTextarea({ 
  formData, 
  setFormData, 
  field, 
  label, 
  placeholder, 
  rows = 3,
  className 
}: LocalizedTextareaProps) {
  const { adminLanguage } = useAdminLanguage();
  
  const isAzProp = `${field}_az` in formData;
  const actualKey = adminLanguage === 'az' ? (isAzProp ? `${field}_az` : field) : `${field}_${adminLanguage}`;
  
  const langBadge = adminLanguage.toUpperCase();
  
  return (
    <div className={`space-y-2 ${className || ''}`}>
      {label && (
        <label className="text-sm font-medium flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-bold">
            {langBadge}
          </span>
        </label>
      )}
      <Textarea
        value={formData[actualKey] || ''}
        onChange={(e) => setFormData({ ...formData, [actualKey]: e.target.value })}
        placeholder={placeholder || label}
        rows={rows}
      />
    </div>
  );
}
