/**
 * Định dạng con số cho các khối báo cáo. Thuần hàm, không JSX — để unit test được
 * (vitest không parse .tsx vì tsconfig đặt `jsx: preserve`).
 */

/** Số chữ số thập phân của tỷ trọng — giữ tỷ lệ thật, không làm tròn về số nguyên. */
const SHARE_DECIMALS = 2;

/**
 * Tỷ trọng dạng chữ, 2 chữ số thập phân: 3.440.000đ trong 12.135.000đ → "28,35%".
 *
 * Làm tròn về số nguyên gây hai vấn đề: dòng nhỏ bị bóp thành "0%" (Rượu 0,412%), và các
 * dòng lệch đủ nhiều để người xem cộng tay ra con số khác 100%. Giữ 2 số lẻ thì mỗi dòng
 * đúng với chính nó và tổng cộng lại sát 100%.
 *
 * Trường hợp cực nhỏ mà 2 số lẻ vẫn thành "0,00%" thì tự nới thêm chữ số — không bao giờ
 * in ra số 0 cho một dòng có tiền.
 */
export function formatShare(value: number, total: number): string {
  if (total <= 0) return "0%"; // không có cơ sở để tính tỷ lệ
  if (value <= 0) return `0,${"0".repeat(SHARE_DECIMALS)}%`;

  const pct = (value / total) * 100;
  for (const decimals of [SHARE_DECIMALS, 4, 6]) {
    const text = pct.toFixed(decimals);
    if (Number(text) > 0) return `${text.replace(".", ",")}%`;
  }
  return "<0,000001%";
}
