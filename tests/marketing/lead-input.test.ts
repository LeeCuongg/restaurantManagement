import { describe, it, expect } from "vitest";
import { normalizeLeadInput, NOTE_MAX } from "@/lib/marketing/lead-input";
import { NAME_MAX } from "@/lib/orders/guest-contact";

const ok = (v: ReturnType<typeof normalizeLeadInput>) => {
  if (!v.ok) throw new Error(`mong đợi hợp lệ, nhận lỗi ở ô ${v.field}`);
  return v.value;
};

describe("normalizeLeadInput — hợp lệ (MKT-02)", () => {
  it("giữ nguyên tên và SĐT chuẩn", () => {
    expect(ok(normalizeLeadInput({ name: "Nguyễn Văn A", phone: "0912345678" }))).toEqual({
      name: "Nguyễn Văn A",
      phone: "0912345678",
      note: null,
    });
  });

  it("đổi +84 và bỏ khoảng trắng trong SĐT", () => {
    expect(ok(normalizeLeadInput({ name: "Chị Mai", phone: "+84 912 345 678" })).phone).toBe("0912345678");
    expect(ok(normalizeLeadInput({ name: "Chị Mai", phone: "0912.345.678" })).phone).toBe("0912345678");
  });

  it("nhận số cố định 11 chữ số", () => {
    expect(ok(normalizeLeadInput({ name: "Quán Bún", phone: "02838223344" })).phone).toBe("02838223344");
  });

  it("cắt khoảng trắng thừa hai đầu tên", () => {
    expect(ok(normalizeLeadInput({ name: "  Anh Dũng  ", phone: "0987654321" })).name).toBe("Anh Dũng");
  });

  it("ghi chú rỗng → null, không lưu chuỗi trắng", () => {
    expect(ok(normalizeLeadInput({ name: "Anh Dũng", phone: "0987654321", note: "   " })).note).toBeNull();
  });

  it("cắt tên và ghi chú theo giới hạn", () => {
    const v = ok(normalizeLeadInput({ name: "A".repeat(120), phone: "0912345678", note: "b".repeat(900) }));
    expect(v.name).toHaveLength(NAME_MAX);
    expect(v.note).toHaveLength(NOTE_MAX);
  });
});

describe("normalizeLeadInput — từ chối (MKT-02)", () => {
  it("tên dưới 2 ký tự → lỗi ở ô tên", () => {
    const v = normalizeLeadInput({ name: "A", phone: "0912345678" });
    expect(v).toMatchObject({ ok: false, field: "name" });
  });

  it("tên toàn khoảng trắng → lỗi ở ô tên", () => {
    expect(normalizeLeadInput({ name: "   ", phone: "0912345678" })).toMatchObject({ ok: false, field: "name" });
  });

  it.each(["123", "", "abcdefghij", "1912345678", "091234567890123"])(
    "SĐT %s không hợp lệ → lỗi ở ô SĐT",
    (phone) => {
      expect(normalizeLeadInput({ name: "Nguyễn Văn A", phone })).toMatchObject({ ok: false, field: "phone" });
    }
  );

  it("báo lỗi tên TRƯỚC lỗi SĐT khi sai cả hai", () => {
    expect(normalizeLeadInput({ name: "", phone: "123" })).toMatchObject({ ok: false, field: "name" });
  });
});
