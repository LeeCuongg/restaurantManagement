import { describe, it, expect } from "vitest";
import { formatShare } from "@/lib/billing/report-format";

describe("formatShare — tỷ trọng trong các khối cơ cấu (REPORT-02/08)", () => {
  it("giữ tỷ lệ thật với 2 chữ số thập phân, không làm tròn về số nguyên", () => {
    // Số thật của qt-food ngày 12/08: 3.440.000đ trong 12.135.000đ = 28,348…%
    expect(formatShare(3_440_000, 12_135_000)).toBe("28,35%");
    expect(formatShare(2_025_000, 12_135_000)).toBe("16,69%");
    expect(formatShare(210_000, 12_135_000)).toBe("1,73%");
    expect(formatShare(50_000, 12_135_000)).toBe("0,41%");
  });

  it("tròn trăm phần trăm vẫn giữ 2 số lẻ cho đồng nhất cột", () => {
    expect(formatShare(10_000_000, 10_000_000)).toBe("100,00%");
    expect(formatShare(2_500_000, 10_000_000)).toBe("25,00%");
  });

  it("0đ → 0,00%", () => {
    expect(formatShare(0, 1_000_000)).toBe("0,00%");
  });

  it("phần cực nhỏ vẫn ra số khác 0, không bao giờ in 0,00% cho dòng có tiền", () => {
    expect(formatShare(1, 1_000_000)).toBe("0,0001%"); // 2 số lẻ ra 0,00 → nới lên 4
    expect(formatShare(1, 100_000_000)).toBe("0,000001%"); // nới tiếp lên 6
  });

  it("nhỏ hơn cả ngưỡng 6 số lẻ → nói rõ dưới ngưỡng, không in số 0 sai", () => {
    expect(formatShare(1, 1_000_000_000)).toBe("<0,000001%");
  });

  it("tổng bằng 0 hoặc âm → 0%, không chia cho 0", () => {
    expect(formatShare(100, 0)).toBe("0%");
    expect(formatShare(100, -5)).toBe("0%");
  });
});
