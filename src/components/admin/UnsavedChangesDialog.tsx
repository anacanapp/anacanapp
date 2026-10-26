import { tr } from "@/lib/tr";import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
'@/components/ui/alert-dialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onSave?: () => void;
  title?: string;
  description?: string;
}

const UnsavedChangesDialog = ({
  open,
  onOpenChange,
  onDiscard,
  onSave,
  title = tr("unsavedchangesdialog_yadda_saxlanilmamis_deyisiklik_45ae2f", "Yadda saxlan\u0131lmam\u0131\u015F d\u0259yi\u015Fiklikl\u0259r"),
  description = tr("unsavedchangesdialog_edilen_deyisiklikler_yadda_sax_d7b24f", "Edil\u0259n d\u0259yi\u015Fiklikl\u0259r yadda saxlan\u0131lmay\u0131b. \xC7\u0131xmaq ist\u0259yirsiniz?")
}: UnsavedChangesDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </motion.div>
            <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-3">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {tr("unsavedchangesdialog_qayit_43a09f", "Qay\u0131t")}
          </AlertDialogCancel>
          {onSave &&
          <AlertDialogAction
            onClick={() => {
              onSave();
              onOpenChange(false);
            }}
            className="bg-primary hover:bg-primary/90">
            
              Yadda saxla
            </AlertDialogAction>
          }
          <AlertDialogAction
            onClick={() => {
              onDiscard();
              onOpenChange(false);
            }}
            className="bg-destructive hover:bg-destructive/90">
            {tr("unsavedchangesdialog_deyisiklikleri_at_9475e4", "D\u0259yi\u015Fiklikl\u0259ri at")}
          
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>);

};

export default UnsavedChangesDialog;