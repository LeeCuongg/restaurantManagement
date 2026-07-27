import { describe, expect, it } from "vitest";
import { groupMoney, moneyDigits } from "@/lib/orders/cart";

/** Ô nhập tiền phải chịu được thao tác thật của thu ngân: gõ, dán, xoá, gõ nhầm ký tự. */
describe("moneyDigits", () => {
  it("chỉ giữ chữ số", () => {
    expect(moneyDigits("45000")).toBe("45000");
    expect(moneyDigits("45.000")).toBe("45000"); // gõ tiếp trên chuỗi đã có chấm
    expect(moneyDigits("45.000đ")).toBe("45000"); // dán từ chỗ khác
    expect(moneyDigits("abc")).toBe("");
  });

  it("bỏ số 0 thừa ở đầu nhưng giữ được số 0 đơn lẻ", () => {
    expect(moneyDigits("0045")).toBe("45");
    expect(moneyDigits("0")).toBe("0");
  });

  it("chặn chuỗi quá dài (dán nhầm)", () => {
    expect(moneyDigits("1234567890123456")).toHaveLength(12);
  });
});

describe("groupMoney", () => {
  it("chấm ngăn nghìn kiểu Việt Nam", () => {
    expect(groupMoney("45000")).toBe("45.000");
    expect(groupMoney("500000")).toBe("500.000");
    expect(groupMoney("1020000")).toBe("1.020.000");
  });

  it("số ngắn và rỗng giữ nguyên", () => {
    expect(groupMoney("999")).toBe("999");
    expect(groupMoney("")).toBe(""); // để placeholder còn hiện
  });

  it("gõ từng phím ra đúng chuỗi hiển thị", () => {
    const typed = ["4", "45", "450", "4500", "45000"].map((s) => groupMoney(moneyDigits(s)));
    expect(typed).toEqual(["4", "45", "450", "4.500", "45.000"]);
  });
});
