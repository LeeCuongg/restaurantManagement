"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";
import { createStaff } from "@/app/r/[slug]/admin/(protected)/staff/actions";

/**
 * Form thêm thành viên. Ô bí mật ĐỔI THEO VAI TRÒ (QD-010 §4):
 *  - thu ngân / phục vụ / bếp → PIN 4 số (đăng nhập POS/KDS, QD-009)
 *  - quản lý → mật khẩu ≥8 ký tự (tài khoản mở được /admin/reports nên PIN 4 số không đủ)
 *
 * Option "Quản lý" chỉ hiện khi người đang thao tác được phép cấp vai trò đó — nhưng đây chỉ là
 * trang trí: `createStaff` kiểm `canAssignRole` ở server, ẩn option không phải bảo mật.
 */
export function StaffCreateForm({
  slug,
  canCreateManager,
}: {
  slug: string;
  canCreateManager: boolean;
}) {
  const [role, setRole] = useState("cashier");
  const isManager = role === "manager";

  return (
    <Card className="mt-lg">
      <form
        action={createStaff}
        // 5 ô cạnh nhau chỉ vừa từ `xl`; tablet dọc dùng 2 cột, điện thoại xếp dọc 1 cột.
        className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-[1fr_1fr_150px_180px_auto] xl:items-start"
      >
        <input type="hidden" name="slug" value={slug} />

        <label className="flex flex-col gap-xxs text-sm text-slate">
          Tên hiển thị
          <Input name="display_name" required placeholder="Lan" />
        </label>

        <label className="flex flex-col gap-xxs text-sm text-slate">
          Email
          <Input name="email" type="email" required placeholder="lan@pho-viet.vn" />
        </label>

        <label className="flex flex-col gap-xxs text-sm text-slate">
          Vai trò
          <select
            name="role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 rounded-md border border-hairline-strong bg-canvas px-md text-base text-ink sm:text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="cashier">Thu ngân</option>
            <option value="waiter">Phục vụ</option>
            <option value="kitchen">Bếp</option>
            {canCreateManager && <option value="manager">Quản lý</option>}
          </select>
        </label>

        {/* Cùng tên field `secret` cho cả 2 nhánh — server tự phân nhánh theo vai trò. */}
        <label className="flex flex-col gap-xxs text-sm text-slate">
          {isManager ? "Mật khẩu" : "PIN (4 số)"}
          {isManager ? (
            <Input
              key="secret-password"
              name="secret"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="≥ 8 ký tự"
            />
          ) : (
            <Input
              key="secret-pin"
              name="secret"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              autoComplete="off"
              placeholder="1234"
            />
          )}
          <span className="text-xs leading-snug text-steel">
            {isManager
              ? "Quản lý đăng nhập ở /admin bằng mật khẩu, không dùng PIN."
              : "Nhân viên đăng nhập ở POS/KDS bằng email + PIN."}
          </span>
        </label>

        <SubmitButton pendingLabel="Đang thêm…" className="w-full sm:w-auto sm:justify-self-start">
          Thêm
        </SubmitButton>
      </form>
    </Card>
  );
}
