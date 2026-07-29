import "server-only";
import bcrypt from "bcryptjs";

/**
 * Tiện ích PIN (D7). CHỈ chạy phía server — `server-only` chặn import nhầm vào client.
 * PIN 4 số băm bcrypt; so khớp ở server action, KHÔNG bao giờ ở client.
 */

const SALT_ROUNDS = 10;
const PIN_RE = /^\d{4}$/;

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin);
}

/** Độ dài tối thiểu mật khẩu vai trò quản lý (QD-010 §4). Supabase yêu cầu ≥6; ta siết lên 8. */
export const MANAGER_PASSWORD_MIN = 8;

/**
 * Mật khẩu cho tài khoản vai trò `manager` — QD-010 §4.
 * Tài khoản manager mở được `/admin/reports` + `/admin/staff` nên đánh đổi "PIN 4 số cho bề mặt
 * nội bộ" của QD-009 không còn đúng: bắt mật khẩu ≥8 ký tự.
 * Loại thêm chuỗi đúng 4 chữ số vì QD-009 quy ước bí mật 4 số ⇒ xử lý theo đường suy dẫn PIN;
 * để lọt vào đây sẽ tạo tài khoản không đăng nhập được bằng bất kỳ đường nào.
 */
export function isValidManagerPassword(password: string): boolean {
  return password.length >= MANAGER_PASSWORD_MIN && !PIN_RE.test(password);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error("PIN phải gồm đúng 4 chữ số.");
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!isValidPin(pin) || !hash) return false;
  return bcrypt.compare(pin, hash);
}
