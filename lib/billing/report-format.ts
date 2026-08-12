/**
 * Định dạng con số cho các khối báo cáo. Thuần hàm, không JSX — để unit test được
 * (vitest không parse .tsx vì tsconfig đặt `jsx: preserve`).
 */

/**
 * Tỷ trọng dạng chữ, LUÔN ra số đúng. Làm tròn về số nguyên như thường, nhưng nếu phần
 * quá nhỏ khiến nó thành "0%" thì tự nới thêm chữ số thập phân cho tới khi ra số khác 0.
 *
 * Ví dụ thật: Rượu 50.000đ trong kỳ 12.135.000đ = 0,412% — trước đây hiện "0%", đọc như
 * món đó không bán được đồng nào. Giờ hiện "0,4%". Chỉ đúng 0đ mới là "0%".
 */
export function formatShare(value: number, total: number): string {
  if (total <= 0 || value <= 0) return "0%";

  const pct = (value / total) * 100;
  for (const decimals of [0, 1, 2]) {
    const text = pct.toFixed(decimals);
    if (Number(text) > 0) return `${text.replace(".", ",")}%`;
  }
  // Nhỏ hơn 0,005% — thà nói "nhỏ hơn ngưỡng" còn hơn in ra một số 0 sai.
  return "<0,01%";
}
