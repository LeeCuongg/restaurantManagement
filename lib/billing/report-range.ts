/**
 * Khoảng thời gian báo cáo (REPORT-05/06/07) — THUẦN HÀM, không chạm DB.
 * Tách riêng khỏi `reports.ts` (có "server-only") để unit test được bằng vitest.
 *
 * Mọi mốc tính theo NGÀY VIỆT NAM (UTC+7, VN không có DST). Kỹ thuật: quy về "vnMs"
 * = epoch UTC + 7h, rồi đọc bằng getUTC* — nhờ vậy lịch VN đọc ra đúng mà không cần
 * thư viện timezone. Khoảng luôn nửa mở [from, to).
 */

export const VN_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Trần an toàn: kỳ dài hơn 400 ngày → coi là đầu vào hỏng, quay về tháng này. */
export const MAX_RANGE_DAYS = 400;

export type Grain = "hour" | "day" | "week" | "month";
export type Preset = "today" | "7d" | "30d" | "week" | "month" | "custom";

export type RangeInput = {
  preset?: string;
  offset?: string;
  from?: string;
  to?: string;
  /** Tham số cũ (?bucket=day|week|month) — giữ để link cũ không gãy. */
  bucket?: string;
};

export type Bucket = { ms: number; label: string };

export type ReportRange = {
  preset: Preset;
  offset: number;
  /** Đầu vào gốc, dùng để dựng lại kỳ trước/sau. */
  input: RangeInput;
  fromUtc: string;
  toUtc: string;
  /** Ngày VN đầu/cuối (bao gồm cả ngày cuối) — YYYY-MM-DD. */
  fromDay: string;
  toDay: string;
  dayCount: number;
  grain: Grain;
  buckets: Bucket[];
  label: string;
  /** false khi kỳ đã chạm hôm nay — không có gì ở tương lai để xem. */
  canGoNext: boolean;
};

// ---- Tiện ích ngày VN -------------------------------------------------------

function vnNow(now: Date): number {
  return now.getTime() + VN_OFFSET_MS;
}

function startOfVnDay(vnMs: number): number {
  return Math.floor(vnMs / DAY_MS) * DAY_MS;
}

function toDayStr(vnMs: number): string {
  return new Date(vnMs).toISOString().slice(0, 10);
}

function toUtcIso(vnMs: number): string {
  return new Date(vnMs - VN_OFFSET_MS).toISOString();
}

/** "YYYY-MM-DD" → vnMs của 00:00 ngày đó. Trả null nếu sai định dạng/ngày không tồn tại. */
export function parseDayStr(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  // Chặn 2026-02-30 (Date.parse tự cuộn sang 02/03).
  if (new Date(ms).toISOString().slice(0, 10) !== s) return null;
  return ms;
}

function ddmm(vnMs: number): string {
  const d = new Date(vnMs);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ddmmyyyy(vnMs: number): string {
  return `${ddmm(vnMs)}/${new Date(vnMs).getUTCFullYear()}`;
}

// ---- Grain & bucket ---------------------------------------------------------

/** Độ mịn biểu đồ theo độ dài kỳ — tránh cảnh 365 cột dính nhau. */
export function pickGrain(dayCount: number): Grain {
  if (dayCount <= 2) return "hour";
  if (dayCount <= 92) return "day";
  if (dayCount <= 366) return "week";
  return "month";
}

/** Thứ 2 của tuần chứa vnMs (tuần ISO — khớp date_trunc('week') của Postgres). */
function startOfVnWeek(vnMs: number): number {
  const day = startOfVnDay(vnMs);
  const dow = new Date(day).getUTCDay(); // 0=CN..6=T7
  return day + (dow === 0 ? -6 : 1 - dow) * DAY_MS;
}

function startOfVnMonth(vnMs: number): number {
  const d = new Date(vnMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/**
 * Danh sách mốc bucket phủ kín [startVn, endVn) — kể cả mốc không có hóa đơn (cột 0).
 * `ms` là epoch UTC của mốc, khớp `bucket_start` do report_series trả về.
 */
function buildBuckets(startVn: number, endVn: number, grain: Grain): Bucket[] {
  const out: Bucket[] = [];
  if (grain === "hour") {
    for (let v = startVn; v < endVn; v += HOUR_MS) {
      out.push({ ms: v - VN_OFFSET_MS, label: `${String(new Date(v).getUTCHours()).padStart(2, "0")}:00` });
    }
    return out;
  }
  if (grain === "day") {
    for (let v = startVn; v < endVn; v += DAY_MS) out.push({ ms: v - VN_OFFSET_MS, label: ddmm(v) });
    return out;
  }
  if (grain === "week") {
    for (let v = startOfVnWeek(startVn); v < endVn; v += 7 * DAY_MS) {
      out.push({ ms: v - VN_OFFSET_MS, label: ddmm(v) });
    }
    return out;
  }
  let v = startOfVnMonth(startVn);
  while (v < endVn) {
    const d = new Date(v);
    out.push({ ms: v - VN_OFFSET_MS, label: `T${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}` });
    v = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return out;
}

// ---- Nhãn kỳ ----------------------------------------------------------------

function buildLabel(preset: Preset, startVn: number, endVn: number, todayVn: number, truncated: boolean): string {
  const lastVn = endVn - DAY_MS;
  if (preset === "today" || startVn === lastVn) {
    if (startVn === todayVn) return `Hôm nay · ${ddmmyyyy(startVn)}`;
    if (startVn === todayVn - DAY_MS) return `Hôm qua · ${ddmmyyyy(startVn)}`;
    return ddmmyyyy(startVn);
  }
  if (preset === "week") return `Tuần ${ddmm(startVn)} – ${ddmmyyyy(lastVn)}`;
  if (preset === "month") {
    const d = new Date(startVn);
    const name = `Tháng ${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
    return truncated ? `${name} · đến ${ddmm(lastVn)}` : name;
  }
  return `${ddmm(startVn)} – ${ddmmyyyy(lastVn)}`;
}

// ---- Giải mã tham số URL ----------------------------------------------------

const PRESETS: Preset[] = ["today", "7d", "30d", "week", "month", "custom"];

function normalizePreset(input: RangeInput): Preset {
  const p = input.preset;
  if (p && (PRESETS as string[]).includes(p)) return p as Preset;
  if (input.from && input.to) return "custom";
  // Tham số cũ ?bucket=day|week|month.
  if (input.bucket === "day") return "today";
  if (input.bucket === "week") return "week";
  if (input.bucket === "month") return "month";
  return "month";
}

function parseOffset(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  // Chặn offset phi lý (?offset=1e9) làm tràn phép tính ngày.
  return Math.max(-1200, Math.min(1200, Math.trunc(n)));
}

function build(
  preset: Preset,
  startVn: number,
  endVn: number,
  todayVn: number,
  offset: number,
  input: RangeInput,
  truncated = false
): ReportRange {
  const dayCount = Math.round((endVn - startVn) / DAY_MS);
  const grain = pickGrain(dayCount);
  return {
    preset,
    offset,
    input,
    fromUtc: toUtcIso(startVn),
    toUtc: toUtcIso(endVn),
    fromDay: toDayStr(startVn),
    toDay: toDayStr(endVn - DAY_MS),
    dayCount,
    grain,
    buckets: buildBuckets(startVn, endVn, grain),
    label: buildLabel(preset, startVn, endVn, todayVn, truncated),
    canGoNext: endVn <= todayVn,
  };
}

/**
 * Giải mã searchParams thành khoảng thời gian. Đầu vào hỏng (from > to, ngày không
 * tồn tại, kỳ > 400 ngày) → lặng lẽ quay về "tháng này" thay vì ném lỗi 500.
 */
export function resolveRange(input: RangeInput, now: Date = new Date()): ReportRange {
  const todayVn = startOfVnDay(vnNow(now));
  const offset = parseOffset(input.offset);
  const preset = normalizePreset(input);

  if (preset === "custom") {
    const f = parseDayStr(input.from ?? "");
    const t = parseDayStr(input.to ?? "");
    if (f !== null && t !== null && t >= f) {
      const len = Math.round((t - f) / DAY_MS) + 1;
      if (len <= MAX_RANGE_DAYS) {
        const startVn = f + offset * len * DAY_MS;
        return build("custom", startVn, startVn + len * DAY_MS, todayVn, offset, input);
      }
    }
    return resolveRange({ preset: "month" }, now);
  }

  const today = new Date(todayVn);
  let startVn: number;
  let endVn: number;

  switch (preset) {
    case "today":
      startVn = todayVn + offset * DAY_MS;
      endVn = startVn + DAY_MS;
      break;
    case "7d":
      endVn = todayVn + DAY_MS + offset * 7 * DAY_MS;
      startVn = endVn - 7 * DAY_MS;
      break;
    case "30d":
      endVn = todayVn + DAY_MS + offset * 30 * DAY_MS;
      startVn = endVn - 30 * DAY_MS;
      break;
    case "week":
      startVn = startOfVnWeek(todayVn) + offset * 7 * DAY_MS;
      endVn = startVn + 7 * DAY_MS;
      break;
    default:
      startVn = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1);
      endVn = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset + 1, 1);
  }

  // "Tuần này"/"Tháng này" cắt tới hôm nay: ngày chưa tới chỉ tạo cột 0 vô nghĩa.
  // Kỳ đã trôi qua giữ nguyên trọn tuần/tháng.
  let truncated = false;
  if ((preset === "week" || preset === "month") && startVn <= todayVn && endVn > todayVn + DAY_MS) {
    endVn = todayVn + DAY_MS;
    truncated = true;
  }

  return build(preset, startVn, endVn, todayVn, offset, input, truncated);
}

/** Ngày VN hôm nay (YYYY-MM-DD) — dùng cho thuộc tính `max` của ô chọn ngày. */
export function vnToday(now: Date = new Date()): string {
  return toDayStr(startOfVnDay(vnNow(now)));
}

/**
 * Kỳ liền trước cùng loại (tháng → tháng trước theo lịch, không phải "31 ngày trước").
 * Khi kỳ này đang dở (tháng/tuần cắt tới hôm nay), kỳ trước cũng bị cắt cho bằng số ngày —
 * so 12 ngày đầu tháng 8 với 12 ngày đầu tháng 7, không phải với trọn tháng 7.
 */
export function previousRange(range: ReportRange, now: Date = new Date()): ReportRange {
  const prev = resolveRange({ ...range.input, offset: String(range.offset - 1) }, now);
  if (prev.dayCount <= range.dayCount) return prev;

  const startVn = parseDayStr(prev.fromDay);
  if (startVn === null) return prev;
  const todayVn = startOfVnDay(vnNow(now));
  return build(prev.preset, startVn, startVn + range.dayCount * DAY_MS, todayVn, prev.offset, prev.input, true);
}

/** Query string của kỳ sau khi dịch `delta` kỳ (dùng cho nút ‹ ›). */
export function shiftedQuery(range: ReportRange, delta: number): string {
  const next = range.offset + delta;
  const params = new URLSearchParams();
  params.set("preset", range.preset);
  if (range.preset === "custom") {
    params.set("from", range.input.from ?? range.fromDay);
    params.set("to", range.input.to ?? range.toDay);
  }
  if (next !== 0) params.set("offset", String(next));
  return `?${params.toString()}`;
}

/** Biến động % giữa kỳ này và kỳ trước. null khi kỳ trước = 0 (không chia cho 0). */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
