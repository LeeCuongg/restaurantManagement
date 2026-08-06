"use client";

import { useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

/**
 * Chọn ảnh (client): validate ≤10MB + loại (png/jpeg/webp) TRƯỚC khi gửi, báo lỗi
 * tại chỗ, preview. File hợp lệ đi kèm form (name="image") — server re-validate.
 * Ảnh sai bị reset khỏi input nên không gửi lên. Dùng chung cho món & logo.
 */
export function ImageUpload({
  name = "image",
  currentUrl = null,
  label = "Ảnh (≤10MB, PNG/JPEG/WebP)",
  shape = "rect",
}: {
  name?: string;
  currentUrl?: string | null;
  label?: string;
  /** "cover" = preview ngang 16:9 cho ảnh bìa (khung vuông không phản ánh đúng khung hiển thị). */
  shape?: "rect" | "circle" | "cover";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(currentUrl);
      return;
    }
    if (!ACCEPT.includes(file.type)) {
      setError("Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.");
      e.target.value = "";
      setPreview(currentUrl);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.");
      e.target.value = "";
      setPreview(currentUrl);
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  const box =
    shape === "circle"
      ? "h-16 w-16 rounded-full"
      : shape === "cover"
        ? "h-20 w-36 rounded-md"
        : "h-20 w-20 rounded-md";

  return (
    <div className="flex flex-col gap-xxs text-sm text-slate">
      <span>{label}</span>
      <div className="flex items-center gap-md">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Xem trước"
            className={`${box} shrink-0 border border-hairline-soft object-cover`}
          />
        ) : (
          <span
            className={`grid ${box} shrink-0 place-items-center border border-dashed border-hairline-strong text-xs text-muted`}
          >
            Chưa có
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={ACCEPT.join(",")}
          onChange={onChange}
          className="block w-full text-sm text-slate file:mr-md file:rounded-md file:border file:border-hairline-strong file:bg-surface file:px-md file:py-xs file:text-sm file:text-ink hover:file:bg-cream"
        />
      </div>
      {error && (
        <span role="alert" className="text-xs text-status-late">
          {error}
        </span>
      )}
    </div>
  );
}
