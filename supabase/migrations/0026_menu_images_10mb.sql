-- 0026_menu_images_10mb.sql — Nâng giới hạn ảnh bucket menu-images: 2MB → 10MB.
--
-- ĐÁNH SỐ LẠI 12/08/2026: file này từng mang số 0023 và bị trùng với 0023_report_rpcs.sql.
-- Dời sang 0026 (không dời file kia) vì 0023→0025 là một chuỗi phụ thuộc: 0025 thay thế hàm
-- do 0023 tạo nên không chạy trước được. Câu update dưới đây độc lập và chạy lại được nhiều
-- lần, nên đổi vị trí không ảnh hưởng kết quả khi dựng lại database từ đầu.
-- Bucket được tạo ở 0005 KHÔNG khai báo file_size_limit nên nhận mặc định 2MB đặt tay
-- trên Dashboard. Hậu quả: ảnh >2MB bị Storage từ chối, còn updateItem nuốt lỗi →
-- báo "Đã lưu món." mà ảnh không lên. Chốt hạn mức bằng migration để mọi môi trường
-- (local/dev/main) giống nhau, khớp MAX_IMAGE_BYTES ở lib/storage/images.ts.

update storage.buckets
set file_size_limit = 10485760, -- 10 * 1024 * 1024
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'menu-images';
