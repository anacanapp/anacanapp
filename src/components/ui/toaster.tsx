import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useIsRtl } from "@/lib/rtl";

export function Toaster() {
  const { toasts } = useToast();
  const isRtl = useIsRtl();

  return (
    // RTL: swipe-to-dismiss + proqramlı bağlanma animasiyası əks tərəfə keçir (physical left)
    <ToastProvider swipeDirection={isRtl ? "left" : "right"}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
