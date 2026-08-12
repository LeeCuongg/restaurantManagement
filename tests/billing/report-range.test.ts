import { describe, it, expect } from "vitest";
import {
  resolveRange,
  previousRange,
  shiftedQuery,
  pickGrain,
  deltaPct,
  parseDayStr,
  MAX_RANGE_DAYS,
} from "@/lib/billing/report-range";

/** Mốc cố định: 12:00 ngày 12/08/2026 giờ VN (thứ Tư). Tuần chứa nó bắt đầu 10/08. */
const NOW = new Date("2026-08-12T05:00:00.000Z");

describe("resolveRange — preset (REPORT-05)", () => {
  it("mặc định (không tham số) = tháng này, cắt tới hôm nay", () => {
    const r = resolveRange({}, NOW);
    expect(r.preset).toBe("month");
    expect(r.fromDay).toBe("2026-08-01");
    expect(r.toDay).toBe("2026-08-12"); // không kéo tới 31/08 — ngày chưa tới chỉ là cột 0
    expect(r.dayCount).toBe(12);
    expect(r.grain).toBe("day");
    expect(r.buckets).toHaveLength(12);
    expect(r.label).toBe("Tháng 8/2026 · đến 12/08");
    expect(r.canGoNext).toBe(false); // kỳ hiện tại — không có tương lai để xem
  });

  it("tháng đã trôi qua vẫn lấy trọn tháng", () => {
    const r = resolveRange({ preset: "month", offset: "-1" }, NOW);
    expect([r.fromDay, r.toDay]).toEqual(["2026-07-01", "2026-07-31"]);
    expect(r.dayCount).toBe(31);
    expect(r.label).toBe("Tháng 7/2026");
  });

  it("mốc UTC của tháng lệch đúng 7h (nửa mở)", () => {
    const r = resolveRange({ preset: "month" }, NOW);
    expect(r.fromUtc).toBe("2026-07-31T17:00:00.000Z");
    expect(r.toUtc).toBe("2026-08-12T17:00:00.000Z");
  });

  it("today → 1 ngày, độ mịn theo giờ, 24 cột", () => {
    const r = resolveRange({ preset: "today" }, NOW);
    expect(r.fromDay).toBe("2026-08-12");
    expect(r.toDay).toBe("2026-08-12");
    expect(r.grain).toBe("hour");
    expect(r.buckets).toHaveLength(24);
    expect(r.buckets[0].label).toBe("00:00");
    expect(r.buckets[0].ms).toBe(Date.parse("2026-08-11T17:00:00.000Z"));
    expect(r.label).toBe("Hôm nay · 12/08/2026");
  });

  it("today offset −1 = hôm qua, và cho phép bấm ›", () => {
    const r = resolveRange({ preset: "today", offset: "-1" }, NOW);
    expect(r.fromDay).toBe("2026-08-11");
    expect(r.label).toBe("Hôm qua · 11/08/2026");
    expect(r.canGoNext).toBe(true);
  });

  it("7d = 7 ngày gần nhất tính cả hôm nay", () => {
    const r = resolveRange({ preset: "7d" }, NOW);
    expect([r.fromDay, r.toDay]).toEqual(["2026-08-06", "2026-08-12"]);
    expect(r.dayCount).toBe(7);
    expect(r.grain).toBe("day");
  });

  it("30d = 30 ngày gần nhất", () => {
    const r = resolveRange({ preset: "30d" }, NOW);
    expect([r.fromDay, r.toDay]).toEqual(["2026-07-14", "2026-08-12"]);
    expect(r.dayCount).toBe(30);
  });

  it("week = từ thứ Hai tới hôm nay (tuần đang dở)", () => {
    const r = resolveRange({ preset: "week" }, NOW);
    expect([r.fromDay, r.toDay]).toEqual(["2026-08-10", "2026-08-12"]);
    expect(r.label).toBe("Tuần 10/08 – 12/08/2026");
  });

  it("tuần đã trôi qua vẫn lấy trọn 7 ngày", () => {
    const r = resolveRange({ preset: "week", offset: "-1" }, NOW);
    expect([r.fromDay, r.toDay]).toEqual(["2026-08-03", "2026-08-09"]);
    expect(r.dayCount).toBe(7);
  });

  it("giữ tương thích tham số cũ ?bucket=&offset=", () => {
    expect(resolveRange({ bucket: "month", offset: "-1" }, NOW).label).toBe("Tháng 7/2026");
    expect(resolveRange({ bucket: "week" }, NOW).fromDay).toBe("2026-08-10");
    expect(resolveRange({ bucket: "day" }, NOW).fromDay).toBe("2026-08-12");
  });
});

describe("resolveRange — khoảng tùy chọn (REPORT-05)", () => {
  it("from/to hợp lệ → đúng số ngày và nhãn", () => {
    const r = resolveRange({ from: "2026-07-01", to: "2026-08-12" }, NOW);
    expect(r.preset).toBe("custom");
    expect(r.dayCount).toBe(43);
    expect(r.buckets).toHaveLength(43);
    expect(r.grain).toBe("day");
    expect(r.label).toBe("01/07 – 12/08/2026");
  });

  it("from > to → lặng lẽ quay về tháng này (không 500)", () => {
    const r = resolveRange({ from: "2026-08-20", to: "2026-08-01" }, NOW);
    expect(r.preset).toBe("month");
    expect(r.fromDay).toBe("2026-08-01");
  });

  it("ngày không tồn tại (2026-02-30) → quay về tháng này", () => {
    expect(resolveRange({ from: "2026-02-30", to: "2026-03-05" }, NOW).preset).toBe("month");
  });

  it("định dạng sai → quay về tháng này", () => {
    expect(resolveRange({ from: "01/07/2026", to: "2026-08-12" }, NOW).preset).toBe("month");
  });

  it(`kỳ dài hơn ${MAX_RANGE_DAYS} ngày → quay về tháng này`, () => {
    expect(resolveRange({ from: "2024-01-01", to: "2026-08-12" }, NOW).preset).toBe("month");
  });

  it("khoảng dài chuyển sang mốc tuần, bucket bắt đầu đúng thứ Hai", () => {
    const r = resolveRange({ from: "2026-01-01", to: "2026-12-31" }, NOW);
    expect(r.grain).toBe("week");
    // date_trunc('week') của Postgres lấy thứ Hai — mốc đầu phải là 29/12/2025.
    expect(r.buckets[0].ms).toBe(Date.parse("2025-12-28T17:00:00.000Z"));
    expect(r.buckets[0].label).toBe("29/12");
  });

  it("offset phi lý bị kẹp, không tràn phép tính ngày", () => {
    const r = resolveRange({ preset: "month", offset: "1e9" }, NOW);
    expect(Number.isFinite(Date.parse(r.fromUtc))).toBe(true);
    expect(r.offset).toBe(1200);
  });
});

describe("pickGrain (REPORT-06)", () => {
  it.each([
    [1, "hour"],
    [2, "hour"],
    [3, "day"],
    [92, "day"],
    [93, "week"],
    [366, "week"],
    [367, "month"],
  ])("%i ngày → %s", (days, grain) => {
    expect(pickGrain(days as number)).toBe(grain);
  });
});

describe("previousRange (REPORT-07)", () => {
  it("tháng đang dở → cùng số ngày đầu tháng trước (12 ngày so 12 ngày)", () => {
    const prev = previousRange(resolveRange({ preset: "month" }, NOW), NOW);
    expect([prev.fromDay, prev.toDay]).toEqual(["2026-07-01", "2026-07-12"]);
    expect(prev.dayCount).toBe(12);
  });

  it("tháng trọn vẹn → tháng trước trọn vẹn theo lịch (không phải 31 ngày trước)", () => {
    const prev = previousRange(resolveRange({ preset: "month", offset: "-1" }, NOW), NOW);
    expect([prev.fromDay, prev.toDay]).toEqual(["2026-06-01", "2026-06-30"]);
  });

  it("tuần đang dở → cùng số ngày đầu tuần trước", () => {
    const prev = previousRange(resolveRange({ preset: "week" }, NOW), NOW);
    expect([prev.fromDay, prev.toDay]).toEqual(["2026-08-03", "2026-08-05"]);
  });

  it("custom → lùi đúng độ dài kỳ", () => {
    const prev = previousRange(resolveRange({ from: "2026-07-01", to: "2026-08-12" }, NOW), NOW);
    expect([prev.fromDay, prev.toDay]).toEqual(["2026-05-19", "2026-06-30"]);
    expect(prev.dayCount).toBe(43);
  });
});

describe("shiftedQuery", () => {
  it("preset thường bỏ offset=0 cho URL sạch", () => {
    const r = resolveRange({ preset: "month", offset: "-1" }, NOW);
    expect(shiftedQuery(r, 1)).toBe("?preset=month");
    expect(shiftedQuery(r, -1)).toBe("?preset=month&offset=-2");
  });

  it("custom giữ nguyên from/to gốc", () => {
    const r = resolveRange({ from: "2026-07-01", to: "2026-07-07" }, NOW);
    expect(shiftedQuery(r, -1)).toBe("?preset=custom&from=2026-07-01&to=2026-07-07&offset=-1");
  });
});

describe("deltaPct (REPORT-07)", () => {
  it("tăng/giảm làm tròn 1 chữ số", () => {
    expect(deltaPct(110, 100)).toBe(10);
    expect(deltaPct(90, 100)).toBe(-10);
    expect(deltaPct(1005, 1000)).toBe(0.5);
  });

  it("kỳ trước = 0 → null (không chia cho 0)", () => {
    expect(deltaPct(5, 0)).toBeNull();
  });
});

describe("parseDayStr", () => {
  it("nhận ngày hợp lệ, từ chối ngày cuộn", () => {
    expect(parseDayStr("2026-08-12")).toBe(Date.parse("2026-08-12T00:00:00.000Z"));
    expect(parseDayStr("2026-02-30")).toBeNull();
    expect(parseDayStr("2026-8-12")).toBeNull();
    expect(parseDayStr("")).toBeNull();
  });
});
