-- 0023_menu_images_10mb.sql — Nâng giới hạn ảnh bucket menu-images: 2MB → 10MB.
-- Bucket được tạo ở 0005 KHÔNG khai báo file_size_limit nên nhận mặc định 2MB đặt tay
-- trên Dashboard. Hậu quả: ảnh >2MB bị Storage từ chối, còn updateItem nuốt lỗi →
-- báo "Đã lưu món." mà ảnh không lên. Chốt hạn mức bằng migration để mọi môi trường
-- (local/dev/main) giống nhau, khớp MAX_IMAGE_BYTES ở lib/storage/images.ts.

update storage.buckets
set file_size_limit = 10485760, -- 10 * 1024 * 1024
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'menu-images';
