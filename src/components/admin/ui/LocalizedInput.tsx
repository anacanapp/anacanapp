import { Input } from '@/components/ui/input';
import { useAdminLanguage } from '@/contexts/AdminLanguageContext';

interface LocalizedInputProps {
  formData: any;
  setFormData: (data: any) => void;
  field: string;
  label?: string;
  placeholder?: string;
  type?: string;
  className?: string;
}

export function LocalizedInput({ 
  formData, 
  setFormData, 
  field, 
  label, 
  placeholder, 
  type = "text",
  className 
}: LocalizedInputProps) {
  const { adminLanguage } = useAdminLanguage();
  
  // For 'az' we check if field_az exists in the initial form data (or object).
  // If so, we bind to field_az, otherwise base field.
  const isAzProp = `${field}_az` in formData;
  const actualKey = adminLanguage === 'az' ? (isAzProp ? `${field}_az` : field) : `${field}_${adminLanguage}`;
  
  // Show a tiny language badge next to the label
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
      <Input
        type={type}
        value={formData[actualKey] || ''}
        onChange={(e) => setFormData({ ...formData, [actualKey]: e.target.value })}
        placeholder={placeholder || label}
      />
    </div>
  );
}
