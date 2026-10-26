import { createContext, useContext, useState, ReactNode } from 'react';
import { isAppLanguage, type AppLanguageCode } from '@/lib/app-languages';

type AdminLanguage = AppLanguageCode;

interface AdminLanguageContextType {
  adminLanguage: AdminLanguage;
  setAdminLanguage: (lang: AdminLanguage) => void;
}

const AdminLanguageContext = createContext<AdminLanguageContextType | undefined>(undefined);

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  // Try to load from localStorage or default to 'az'
  const getInitialLanguage = (): AdminLanguage => {
    try {
      const stored = localStorage.getItem('anacan_admin_language');
      if (stored && isAppLanguage(stored)) {
        return stored;
      }
    } catch (e) {}
    return 'az';
  };

  const [adminLanguage, setAdminLanguageState] = useState<AdminLanguage>(getInitialLanguage);

  const setAdminLanguage = (lang: AdminLanguage) => {
    setAdminLanguageState(lang);
    try {
      localStorage.setItem('anacan_admin_language', lang);
    } catch (e) {}
  };

  return (
    <AdminLanguageContext.Provider value={{ adminLanguage, setAdminLanguage }}>
      {children}
    </AdminLanguageContext.Provider>
  );
}

export function useAdminLanguage() {
  const context = useContext(AdminLanguageContext);
  if (context === undefined) {
    throw new Error('useAdminLanguage must be used within an AdminLanguageProvider');
  }
  return context;
}

export function useAdminLocalize() {
  const { adminLanguage } = useAdminLanguage();
  
  return (row: any, field: string): string => {
    if (!row) return '';
    if (adminLanguage === 'az') {
      return row[`${field}_az`] || row[field] || '';
    }
    return row[`${field}_${adminLanguage}`] || row[field] || row[`${field}_az`] || '';
  };
}
