"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  Coffee,
  CupSoda,
  IceCream2,
  MessageSquareText,
  Pencil,
  Phone,
  Salad,
  Soup,
  Utensils,
  User,
  Wallet,
} from "lucide-react";
import { CallStaffSheet } from "./CallStaffSheet";
import { MyOrdersSheet } from "./MyOrdersSheet";
import { GuestInfoModal } from "./GuestInfoModal";
import { listMyOrders } from "@/lib/orders/my-orders";
import {
  EMPTY_CONTACT,
  isContactComplete,
  readContact,
  writeContact,
  type GuestContact,
} from "@/lib/orders/guest-contact";

/**
 * CustomerLanding (A0) — màn hình chào khi khách quét QR: nhận diện nhà hàng + bàn, hai lối
 * hỗ trợ nhanh (gọi nhân viên / gọi thanh toán), rồi mới vào thực đơn. Nút chat nổi mở panel
 * "Đơn của bạn" để theo dõi các đơn đã gửi.
 *
 * Không có token bàn hợp lệ → chế độ chỉ-xem: ẩn mọi hành động cần bàn, chỉ cho xem thực đơn.
 */
export function CustomerLanding({
  slug,
  tenantName,
  logoUrl,
  tableName,
  qrToken,
}: {
  slug: string;
  tenantName: string;
  logoUrl: string | null;
  tableName: string | null;
  /** null khi thiếu/sai token → chỉ-xem. */
  qrToken: string | null;
}) {
  const canOrder = !!qrToken;
  const [callMode, setCallMode] = useState<"staff" | "payment">("staff");
  const [callOpen, setCallOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orderCount, setOrderCount] = useState(0);

  // Tên (bắt buộc) + SĐT (tùy chọn) dùng chung với giỏ hàng (lib/orders/guest-contact).
  // hydrated: chưa đọc xong sessionStorage thì CHƯA kết luận là thiếu thông tin (tránh modal
  // bắt buộc nháy lên rồi tắt với khách đã điền).
  const [contact, setContact] = useState<GuestContact>(EMPTY_CONTACT);
  const [hydrated, setHydrated] = useState(false);
  const [infoEditOpen, setInfoEditOpen] = useState(false);

  useEffect(() => {
    if (qrToken) setContact(readContact(slug, qrToken));
    setHydrated(true);
  }, [slug, qrToken]);

  // Số đơn đã gửi từ máy này → badge trên nút chat.
  useEffect(() => {
    setOrderCount(listMyOrders(slug, qrToken).length);
  }, [slug, qrToken, ordersOpen]);

  // Bắt buộc điền tên trước khi làm gì tại bàn (ORDER-10). Chỉ khi có bàn hợp lệ.
  const contactMissing = canOrder && hydrated && !isContactComplete(contact);

  const saveContact = (c: GuestContact) => {
    setContact(c);
    if (qrToken) writeContact(slug, qrToken, c);
    setInfoEditOpen(false);
  };

  const openCall = (mode: "staff" | "payment") => {
    setCallMode(mode);
    setCallOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto min-h-screen max-w-md bg-surface pb-hero">
        {/* Dải nhận diện — gradient sunset dành riêng bề mặt khách (tokens.css) */}
        <div className="relative h-36 bg-sunset">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(255,255,255,0.35),transparent_60%)]"
          />
        </div>

        {/* Thẻ nhận diện — đè lên dải gradient */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative -mt-xxl px-lg"
        >
          <div className="rounded-xl border border-hairline-soft bg-canvas p-lg shadow-modal">
            <div className="flex items-center gap-md">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary font-display text-xl text-primary-fg">
                  {tenantName.charAt(0).toUpperCase()}
                </span>
              )}
              <h1
                data-tenant-slug={slug}
                className="min-w-0 font-display text-2xl leading-tight text-ink [text-wrap:balance]"
              >
                {tenantName}
              </h1>
            </div>

            <dl className="mt-md flex flex-col gap-sm border-t border-hairline-soft pt-md">
              <div className="flex items-center gap-sm">
                <dt className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-steel">
                  <Utensils className="h-4 w-4" />
                  <span className="sr-only">Bàn</span>
                </dt>
                <dd className="text-sm text-ink">
                  {tableName ? (
                    <>
                      Bàn <span className="font-medium">{tableName}</span>
                    </>
                  ) : (
                    <span className="text-steel">Chưa xác định bàn</span>
                  )}
                </dd>
              </div>

              {/* Tên + SĐT chỉ có nghĩa khi gọi món được (ghi kèm đơn) → ẩn ở chế độ chỉ-xem.
                  Một nút bút chì duy nhất mở lại modal để sửa cả hai. */}
              {canOrder && (
                <div className="flex items-start gap-sm">
                  <dt className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-steel">
                    <User className="h-4 w-4" />
                    <span className="sr-only">Thông tin của bạn</span>
                  </dt>
                  <dd className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setInfoEditOpen(true)}
                      aria-label="Sửa tên và số điện thoại"
                      className="group flex w-full items-center gap-xs text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">
                          {contact.name || <span className="text-steel">Chưa có tên</span>}
                        </span>
                        {contact.phone && (
                          <span className="mt-xxs flex items-center gap-xxs text-xs tabular-nums text-steel">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </span>
                        )}
                      </span>
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-primary transition-transform group-hover:scale-110 motion-reduce:transition-none" />
                    </button>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </motion.section>

        {!canOrder && (
          <p className="mx-lg mt-md rounded-md border border-beige-deep bg-cream px-md py-sm text-center text-sm text-ink">
            Quét mã QR tại bàn để gọi món và gọi nhân viên.
          </p>
        )}

        {canOrder && (
          <section className="mt-xl px-lg">
            <h2 className="text-center font-display text-lg text-ink">Bạn đang cần hỗ trợ gì?</h2>
            <div className="mt-md grid grid-cols-2 gap-sm">
              <button
                type="button"
                onClick={() => openCall("staff")}
                className="flex min-h-[104px] flex-col items-center justify-center gap-xs rounded-lg border border-hairline-soft bg-status-ready-bg p-md text-center transition-transform active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-status-ready text-canvas">
                  <Bell className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-ink">Gọi nhân viên</span>
              </button>

              <button
                type="button"
                onClick={() => openCall("payment")}
                className="flex min-h-[104px] flex-col items-center justify-center gap-xs rounded-lg border border-hairline-soft bg-cream-deeper p-md text-center transition-transform active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-sunshine-900 text-canvas">
                  <Wallet className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-ink">Gọi thanh toán</span>
              </button>
            </div>
          </section>
        )}

        {/* CTA chính — vào thực đơn */}
        <div className="mt-md px-lg">
          <Link
            href={canOrder ? `/r/${slug}/menu?t=${qrToken}` : `/r/${slug}/menu`}
            className="flex min-h-[72px] w-full items-center justify-center gap-sm rounded-lg bg-primary px-lg text-primary-fg shadow-card transition-colors hover:bg-primary-deep active:bg-primary-deep motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-canvas/20">
              <ClipboardList className="h-5 w-5" />
            </span>
            <span className="text-base font-medium">
              {canOrder ? "Thực đơn & gọi món" : "Xem thực đơn"}
            </span>
            <ChevronRight className="h-5 w-5 opacity-80" />
          </Link>
        </div>

        {/* Hoa văn lấp khoảng trống cuối màn — thuần trang trí, ẩn với trình đọc màn hình */}
        <div
          aria-hidden
          className="pointer-events-none mt-xxl flex flex-wrap justify-center gap-lg px-xxl opacity-[0.07]"
        >
          {[Soup, Coffee, Salad, CupSoda, IceCream2, Utensils, Soup, Coffee, Salad].map(
            (Icon, i) => (
              <Icon key={i} className="h-10 w-10 text-primary" strokeWidth={1.25} />
            )
          )}
        </div>

        {/* Nút chat nổi — mở panel đơn đã gửi */}
        {canOrder && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md justify-end px-lg pb-[max(20px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setOrdersOpen(true)}
              aria-label={`Xem đơn của bạn${orderCount > 0 ? `, ${orderCount} đơn` : ""}`}
              className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full bg-canvas text-primary shadow-modal transition-transform active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <MessageSquareText className="h-6 w-6" />
              <AnimatePresence>
                {orderCount > 0 && (
                  <motion.span
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-fg"
                  >
                    {orderCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        )}

        {qrToken && (
          <>
            {/* Modal bắt buộc (chưa có tên) đè lên mọi thứ; nút bút chì mở lại ở mode sửa. */}
            <GuestInfoModal
              open={contactMissing || infoEditOpen}
              mode={contactMissing ? "required" : "edit"}
              initial={contact}
              tableName={tableName}
              onSubmit={saveContact}
              onCancel={() => setInfoEditOpen(false)}
            />
            <CallStaffSheet
              slug={slug}
              qrToken={qrToken}
              open={callOpen}
              onOpenChange={setCallOpen}
              mode={callMode}
            />
            <MyOrdersSheet
              slug={slug}
              qrToken={qrToken}
              open={ordersOpen}
              onOpenChange={setOrdersOpen}
            />
          </>
        )}
      </div>
    </MotionConfig>
  );
}
