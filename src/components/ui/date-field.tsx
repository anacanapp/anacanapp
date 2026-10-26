import * as React from "react";
import { Input } from "@/components/ui/input";

export interface DateFieldProps
  extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /** Boş olanda göstərilən placeholder (default: dd/mm/yyyy). */
  placeholder?: string;
  /** Placeholder-in sol kənardan məsafəsi (px) — input-un öz padding-inə uyğunlaşdırmaq üçün. */
  placeholderInset?: number;
}

/**
 * Paylaşılan input[type=date] wrapper — overflow + boş-vəziyyət düzəlişi ilə.
 *
 * Kök səbəb (2 hissəli bug): (1) native input[type=date] bəzi mobil
 * brauzer/WebView kombinasiyalarında öz genişliyini böyüdüb valideyn
 * konteynerdən kənara çıxa bilir; (2) boş olanda iOS-da heç nə göstərmir,
 * Android-də isə native "gg.aa.iiii" görünüşü platformalar arası
 * uyğunsuzdur. Bu komponent hər iki problemi həll edir:
 *   - width:100% + minWidth:0 + maxWidth:100% + box-sizing:border-box +
 *     appearance:none ilə daşmanı bloklayır.
 *   - boş olanda mətn rəngini transparent edib öz "dd/mm/yyyy" placeholder
 *     span-ını göstərir (bütün platformalarda eyni görünüş).
 *
 * Original nümunə: PremiumOnboarding.tsx-dəki yerli DateField (toxunulmayıb,
 * .a-input xüsusi CSS class-ından istifadə edir). Bu versiya isə mövcud
 * shadcn <Input>-u wrap edir ki, çağıran tərəflərin indiki Tailwind
 * className/style-ı 1:1 saxlanılsın (sıfır vizual reqressiya).
 */
export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  ({ value, onChange, style, placeholder, placeholderInset = 12, ...props }, ref) => (
    <div style={{ position: "relative", width: "100%" }}>
      <Input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...style,
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
          WebkitAppearance: "none",
          appearance: "none",
          color: value ? style?.color : "transparent",
        }}
        {...props}
      />
      {!value && (
        <span
          style={{
            position: "absolute",
            insetInlineStart: placeholderInset,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: (style?.fontSize as number | string | undefined) ?? 14,
            color: "var(--a-ink-faint)",
            pointerEvents: "none",
          }}
        >
          {placeholder ?? "dd/mm/yyyy"}
        </span>
      )}
    </div>
  )
);
DateField.displayName = "DateField";
