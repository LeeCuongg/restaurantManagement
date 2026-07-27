"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { groupMoney, moneyDigits } from "@/lib/orders/cart";
import { Input } from "./input";

/**
 * Ô nhập TIỀN (VND) — hiện dấu chấm ngăn nghìn ngay khi gõ: 45000 → 45.000. Nhân viên đọc số tiền
 * dài (500.000) không phải đếm số 0, đỡ nhập nhầm gấp 10 lần.
 *
 * Dùng type="text" + inputMode="numeric": <input type="number"> KHÔNG cho chèn dấu chấm (trình
 * duyệt coi là số không hợp lệ và trả về chuỗi rỗng). Chỉ nhận chữ số — VND không có phần lẻ.
 *
 * - <MoneyInput> — dạng controlled (state number), dùng trong dialog POS.
 * - <MoneyField> — dạng form (server action): input hiện số có chấm, kèm hidden input giữ số thô
 *   để phía server đọc formData như cũ, không phải sửa parse.
 */

type BaseProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

export function MoneyInput({
  value,
  onChange,
  className,
  ...rest
}: BaseProps & { value: number; onChange: (value: number) => void }) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value ? groupMoney(String(value)) : ""}
      onChange={(e) => onChange(Number(moneyDigits(e.target.value) || 0))}
      className={cn(
        "h-11 w-full rounded-md border border-hairline px-md text-base tabular-nums text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm",
        className
      )}
    />
  );
}

export function MoneyField({
  name,
  defaultValue = "",
  className,
  ...rest
}: BaseProps & { name: string; defaultValue?: string | number }) {
  const [digits, setDigits] = React.useState(() => moneyDigits(String(defaultValue)));
  return (
    <>
      {/* Server action đọc ô ẩn này → vẫn nhận "45000" chứ không phải "45.000". */}
      <input type="hidden" name={name} value={digits} />
      <Input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={groupMoney(digits)}
        onChange={(e) => setDigits(moneyDigits(e.target.value))}
        className={cn("tabular-nums", className)}
      />
    </>
  );
}
