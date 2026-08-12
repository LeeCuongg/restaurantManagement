import { describe, it, expect } from "vitest";
import { formatShare } from "@/lib/billing/report-format";

describe("formatShare — tỷ trọng trong các khối cơ cấu (REPORT-02/08)", () => {
  it("làm tròn về số nguyên như thường", () => {
    expect(formatShare(2_800_000, 10_000_000)).toBe("28%");
    expect(formatShare(10_000_000, 10_000_000)).toBe("100%");
    expect(formatShare(1_260_000, 10_000_000)).toBe("13%");
    expect(formatShare(5_000, 1_000_000)).toBe("1%"); // 0,5% → làm tròn lên
  });

  it("phần quá nhỏ thì nới thập phân để ra SỐ ĐÚNG, không hiện 0%", () => {
    // Ca thật: Rượu 50.000đ trong kỳ 12.135.000đ = 0,412% — trước đây hiện "0%".
    expect(formatShare(50_000, 12_135_000)).toBe("0,4%");
    expect(formatShare(4_000, 10_000_000)).toBe("0,04%");
  });

  it("chỉ đúng 0đ mới là 0%", () => {
    expect(formatShare(0, 1_000_000)).toBe("0%");
  });

  it("nhỏ hơn 0,005% → nói rõ là dưới ngưỡng thay vì in số 0 sai", () => {
    expect(formatShare(1, 1_000_000_000)).toBe("<0,01%");
  });

  it("tổng bằng 0 hoặc âm → 0%, không chia cho 0", () => {
    expect(formatShare(100, 0)).toBe("0%");
    expect(formatShare(100, -5)).toBe("0%");
  });
});
