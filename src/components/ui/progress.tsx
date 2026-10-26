import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";
import { useIsRtl } from "@/lib/rtl";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  const isRtl = useIsRtl();
  // RTL: dolum sağdan-sola getsin deyə translateX işarəsi tərsinə çevrilir
  // (LTR: soldan dolur, indiator sola sürüşür; RTL: sağdan dolur, sağa sürüşür).
  const shift = isRtl ? 100 - (value || 0) : -(100 - (value || 0));
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(${shift}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
