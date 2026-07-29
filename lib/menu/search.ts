/** Bỏ dấu tiếng Việt để tìm kiếm không dấu ("com ga" khớp "Cơm gà"). Dùng chung POS + KDS. */
export const normalizeVi = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
