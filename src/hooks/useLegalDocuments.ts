import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LegalDocument {
  id: string;
  document_type: string;
  title: string;
  title_az: string | null;
  content: string;
  content_az: string | null;
  version: string | null;
  effective_date: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export const useLegalDocuments = () => {
  return useQuery({
    queryKey: ['legal-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('is_active', true)
        .order('document_type');

      if (error) {
        console.error('Error fetching legal documents:', error);
        return [];
      }

      return data as LegalDocument[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

export const useLegalDocument = (documentType: string) => {
  const { data: documents = [] } = useLegalDocuments();
  return documents.find(d => d.document_type === documentType);
};

export const useAllLegalDocuments = () => {
  return useQuery({
    queryKey: ['legal-documents-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .order('document_type');

      if (error) {
        console.error('Error fetching all legal documents:', error);
        return [];
      }

      return data as LegalDocument[];
    },
  });
};

export const useUpdateLegalDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LegalDocument> & { id: string }) => {
      const { error } = await supabase
        .from('legal_documents')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-documents'] });
      queryClient.invalidateQueries({ queryKey: ['legal-documents-all'] });
    },
  });
};

export const useCreateLegalDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: Omit<LegalDocument, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('legal_documents')
        .insert(doc);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-documents'] });
      queryClient.invalidateQueries({ queryKey: ['legal-documents-all'] });
    },
  });
};
