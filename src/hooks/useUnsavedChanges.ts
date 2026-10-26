import { useState, useEffect, useCallback, useRef } from 'react';

interface UseUnsavedChangesOptions<T> {
  initialData?: T;
  onSave?: (data: T) => Promise<void>;
  autoSaveDraft?: boolean;
  draftKey?: string;
}

/**
 * Hook to manage unsaved changes with draft auto-save support
 * Prevents accidental data loss when navigating away
 */
export const useUnsavedChanges = <T extends Record<string, any>>({
  initialData,
  onSave,
  autoSaveDraft = true,
  draftKey
}: UseUnsavedChangesOptions<T> = {}) => {
  const [formData, setFormData] = useState<T | undefined>(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const initialDataRef = useRef<T | undefined>(initialData);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (autoSaveDraft && draftKey) {
      try {
        const savedDraft = localStorage.getItem(`admin_draft_${draftKey}`);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          setFormData(parsed);
          setHasChanges(true);
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, [autoSaveDraft, draftKey]);

  // Update form data and track changes
  const updateFormData = useCallback((updates: Partial<T> | ((prev: T | undefined) => T)) => {
    setFormData(prev => {
      const newData = typeof updates === 'function' 
        ? updates(prev)
        : { ...prev, ...updates } as T;
      
      // Check if data has actually changed from initial
      const changed = JSON.stringify(newData) !== JSON.stringify(initialDataRef.current);
      setHasChanges(changed);
      
      // Auto-save draft
      if (autoSaveDraft && draftKey && changed) {
        try {
          localStorage.setItem(`admin_draft_${draftKey}`, JSON.stringify(newData));
        } catch (e) {
          console.error('Failed to save draft:', e);
        }
      }
      
      return newData;
    });
  }, [autoSaveDraft, draftKey]);

  // Reset to initial data
  const resetForm = useCallback((newInitialData?: T) => {
    const dataToUse = newInitialData ?? initialDataRef.current;
    initialDataRef.current = dataToUse;
    setFormData(dataToUse);
    setHasChanges(false);
    
    // Clear draft
    if (autoSaveDraft && draftKey) {
      localStorage.removeItem(`admin_draft_${draftKey}`);
    }
  }, [autoSaveDraft, draftKey]);

  // Save changes
  const saveChanges = useCallback(async () => {
    if (!onSave || !formData) return;
    
    setIsSaving(true);
    try {
      await onSave(formData);
      initialDataRef.current = formData;
      setHasChanges(false);
      
      // Clear draft on successful save
      if (autoSaveDraft && draftKey) {
        localStorage.removeItem(`admin_draft_${draftKey}`);
      }
    } finally {
      setIsSaving(false);
    }
  }, [formData, onSave, autoSaveDraft, draftKey]);

  // Clear draft manually
  const clearDraft = useCallback(() => {
    if (draftKey) {
      localStorage.removeItem(`admin_draft_${draftKey}`);
    }
    setHasChanges(false);
  }, [draftKey]);

  // Check for draft on load
  const hasDraft = useCallback((): boolean => {
    if (!draftKey) return false;
    return !!localStorage.getItem(`admin_draft_${draftKey}`);
  }, [draftKey]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  return {
    formData,
    setFormData: updateFormData,
    hasChanges,
    isSaving,
    saveChanges,
    resetForm,
    clearDraft,
    hasDraft
  };
};

export default useUnsavedChanges;
