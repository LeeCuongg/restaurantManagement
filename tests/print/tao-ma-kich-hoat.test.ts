import { describe, it, expect, vi, beforeEach } from "vitest";

/** PRINT-17 — chủ quán tự tạo mã kích hoạt: chỉ owner, quán đang hoạt động, có giới hạn tần suất. */
const phien = vi.fn();
const taoMa = vi.fn();
const gioiHan = vi.fn();
let trangThaiQuan = "active";

vi.mock("@/lib/auth/session", () => ({ getSessionMembership: (s: string) => phien(s) }));
vi.mock("@/lib/print/activation", () => ({ createActivationCode: (...a: unknown[]) => taoMa(...a) }));
vi.mock("@/lib/security/rate-limit", () => ({
  RULES: { bridgeCode: { name: "bridge-code", windowS: 600, max: 5 } },
  checkRateLimit: (...a: unknown[]) => gioiHan(...a),
  tooManyMessage: () => "Thử lại sau.",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: trangThaiQuan } }) }) }),
    }),
  }),
}));

const { taoMaKichHoat } = await import("@/app/r/[slug]/admin/(protected)/printers/actions");

const nguoi = (role: string) => ({ userId: "u1", role, tenant: { id: "t1", slug: "q" }, membershipId: "m1" });

beforeEach(() => {
  vi.clearAllMocks();
  trangThaiQuan = "active";
  gioiHan.mockResolvedValue({ ok: true, retryAfterS: 0 });
  taoMa.mockResolvedValue({ code: "ABCDEFGH", expiresAt: "2026-09-27T10:30:00Z" });
});

describe("taoMaKichHoat", () => {
  it("chủ quán → tạo mã cho ĐÚNG quán của phiên, ghi người tạo", async () => {
    phien.mockResolvedValue(nguoi("owner"));
    expect(await taoMaKichHoat("q")).toEqual({ code: "ABCDEFGH", expiresAt: "2026-09-27T10:30:00Z" });
    expect(taoMa).toHaveBeenCalledWith(expect.anything(), { tenantId: "t1", createdBy: "u1" });
    expect(gioiHan).toHaveBeenCalledWith(expect.objectContaining({ name: "bridge-code" }), ["t1"]);
  });

  it.each(["manager", "cashier", "waiter", "kitchen", "station", "printer"])("%s → từ chối, không tạo mã", async (role) => {
    phien.mockResolvedValue(nguoi(role));
    expect(await taoMaKichHoat("q")).toEqual({ error: "Chỉ chủ quán tạo được mã kích hoạt." });
    expect(taoMa).not.toHaveBeenCalled();
  });

  it("chưa đăng nhập → từ chối", async () => {
    phien.mockResolvedValue(null);
    expect(await taoMaKichHoat("q")).toHaveProperty("error");
    expect(taoMa).not.toHaveBeenCalled();
  });

  it("quán tạm ngưng → từ chối", async () => {
    phien.mockResolvedValue(nguoi("owner"));
    trangThaiQuan = "suspended";
    expect(await taoMaKichHoat("q")).toHaveProperty("error");
    expect(taoMa).not.toHaveBeenCalled();
  });

  it("vượt 5 mã / 10 phút → từ chối", async () => {
    phien.mockResolvedValue(nguoi("owner"));
    gioiHan.mockResolvedValue({ ok: false, retryAfterS: 120 });
    expect(await taoMaKichHoat("q")).toEqual({ error: "Thử lại sau." });
    expect(taoMa).not.toHaveBeenCalled();
  });
});
