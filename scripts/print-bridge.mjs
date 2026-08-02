// scripts/print-bridge.mjs — Cầu in ESC/POS cục bộ (V1.x, D1 §7 / QD-005).
//
// App chạy trên Vercel KHÔNG với tới máy in LAN của quán, nên phải có tiến trình này chạy tại
// quán: poll print_jobs status=pending → dựng lệnh ESC/POS → gửi thẳng TCP tới máy in bếp
// (cổng 9100) → đánh dấu printed/failed. POS không đổi nghiệp vụ (PRINT-01).
//
// Chạy:  npm run print:bridge          (vòng lặp thật)
//        npm run print:bridge:test     (in 1 phiếu mẫu, không đụng DB — dùng để thử máy in)
//
// Env (đọc từ .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// PRINT_TENANT_SLUG (hoặc PRINT_TENANT_ID), PRINTER_HOST, PRINTER_PORT, PRINTER_CHARS, POLL_MS,
// MAX_JOB_AGE_MIN.
//
// KHÔNG phụ thuộc npm nào — chỉ dùng thư viện sẵn của Node (net/fs) + fetch. Nhờ vậy lắp tại quán
// chỉ cần copy FILE NÀY + .env.local sang laptop có Node 20+, không phải clone repo hay npm install.
//
// CHỈ chạy MỘT tiến trình cầu in cho mỗi quán — hai tiến trình sẽ in trùng phiếu.
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Đọc .env.local cạnh file này, rồi tới thư mục cha (repo root khi chạy từ repo).
 * Tự đọc thay vì dùng dotenv để cầu in không cần node_modules — xem ghi chú đầu file.
 * Biến đã có sẵn trong môi trường thì GIỮ NGUYÊN (cho phép ghi đè khi chạy bằng Task Scheduler).
 */
function loadEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const dir of [here, path.join(here, "..")]) {
    const file = path.join(dir, ".env.local");
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // Bỏ nháy bao quanh nếu có ("..." hoặc '...').
      if (value.length > 1 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
    return file;
  }
  return null;
}

const envFile = loadEnv();

const TEST_MODE = process.argv.includes("--test");
const HOST = process.env.PRINTER_HOST || "192.168.1.234";
const PORT = Number(process.env.PRINTER_PORT || 9100);
const CHARS = Number(process.env.PRINTER_CHARS || 48); // 80mm=48, 58mm=32
const POLL_MS = Number(process.env.POLL_MS || 2000);
const SOCKET_TIMEOUT_MS = 8000;
/**
 * Bỏ qua job pending quá cũ. Cầu in tắt một đêm rồi bật lại mà không có chốt này thì toàn bộ phiếu
 * tồn đọng tuôn ra một lượt — bếp nhận cả chục phiếu của hôm qua. Quá hạn thì POS hiện chip đỏ
 * "Bếp CHƯA in", nhân viên chủ động in lại phiếu nào còn cần.
 */
const MAX_JOB_AGE_MIN = Number(process.env.MAX_JOB_AGE_MIN || 30);

// ── ESC/POS ────────────────────────────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;
const CMD = {
  init: Buffer.from([ESC, 0x40]),
  alignLeft: Buffer.from([ESC, 0x61, 0]),
  alignCenter: Buffer.from([ESC, 0x61, 1]),
  boldOn: Buffer.from([ESC, 0x45, 1]),
  boldOff: Buffer.from([ESC, 0x45, 0]),
  sizeNormal: Buffer.from([GS, 0x21, 0x00]),
  sizeTall: Buffer.from([GS, 0x21, 0x01]), // cao gấp đôi, rộng giữ nguyên
  sizeBig: Buffer.from([GS, 0x21, 0x11]), // cao + rộng gấp đôi
  cut: Buffer.from([GS, 0x56, 0x42, 0x00]), // cắt một phần, có đẩy giấy
};

/**
 * Bỏ dấu tiếng Việt về ASCII. Máy in nhiệt phổ thông không có sẵn bảng mã Việt (CP1258);
 * "PHO BO TAI" luôn in được, còn "PHỞ BÒ" dễ ra ký tự rác. Bếp vẫn đọc hiểu bình thường.
 */
function ascii(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // dấu tổ hợp (huyền/sắc/hỏi/ngã/nặng + râu ơ/ư)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+$/g, "");
}

/** Ngắt dòng theo bề rộng khổ giấy; từ dài hơn 1 dòng thì cắt cứng. */
function wrap(text, width = CHARS) {
  const out = [];
  let line = "";
  for (const word of ascii(text).split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
    while (line.length > width) {
      out.push(line.slice(0, width));
      line = line.slice(width);
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/** Một dòng hai đầu: trái căn trái, phải căn phải. */
function row(left, right) {
  const l = ascii(left);
  const r = ascii(right);
  const gap = Math.max(1, CHARS - l.length - r.length);
  return `${l}${" ".repeat(gap)}${r}`;
}

function timeVN(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Dựng buffer ESC/POS từ payload print_jobs (KitchenTicketView trong lib/print/adapter.ts).
 * Bố cục KHỚP phiếu trình duyệt (components/print/KitchenTicketDoc.tsx) để bếp đọc quen mắt.
 */
function buildKitchenTicket(ticket) {
  const parts = [];
  const text = (s) => parts.push(Buffer.from(`${s}\n`, "latin1"));
  const cmd = (b) => parts.push(b);

  cmd(CMD.init);
  cmd(CMD.alignCenter);

  cmd(CMD.boldOn);
  for (const l of wrap(ticket.tenantName)) text(l);
  text(`PHIEU BEP${ticket.isReprint ? " (IN LAI)" : ""}`);
  cmd(CMD.boldOff);

  if (ticket.kitchenNo != null) {
    cmd(CMD.sizeBig);
    cmd(CMD.boldOn);
    text(`DON #${ticket.kitchenNo}`);
    cmd(CMD.boldOff);
    cmd(CMD.sizeNormal);
  }

  cmd(CMD.alignLeft);
  text("-".repeat(CHARS));
  text(row(`Ban: ${ticket.tableName ?? "-"}`, `#${ticket.ticketNo ?? ""}`));
  const qty = (ticket.items ?? []).reduce((acc, i) => acc + (i.qty ?? 0), 0);
  text(row(timeVN(ticket.confirmedAt), `${qty} phan`));
  text("-".repeat(CHARS));

  for (const item of ticket.items ?? []) {
    cmd(CMD.boldOn);
    cmd(CMD.sizeTall);
    for (const l of wrap(`${item.qty}x ${item.name}`)) text(l);
    cmd(CMD.sizeNormal);
    cmd(CMD.boldOff);
    for (const m of item.modifiers ?? []) {
      for (const l of wrap(`+ ${m}`, CHARS - 2)) text(`  ${l}`);
    }
    if (item.note) {
      cmd(CMD.boldOn);
      for (const l of wrap(`>> ${item.note}`, CHARS - 2)) text(`  ${l}`);
      cmd(CMD.boldOff);
    }
  }

  text("-".repeat(CHARS));
  cmd(CMD.alignCenter);
  text("-- het phieu --");
  text("");
  cmd(CMD.cut);

  return Buffer.concat(parts);
}

// ── Gửi tới máy in ─────────────────────────────────────────────────────────────
function sendToPrinter(buffer) {
  return new Promise((resolve, reject) => {
    let done = false;
    const socket = net.connect({ host: HOST, port: PORT });
    socket.setTimeout(SOCKET_TIMEOUT_MS);
    socket.on("connect", () =>
      // Xong khi dữ liệu đã đẩy hết ra socket — nhiều máy in reset kết nối ngay sau khi nhận,
      // chờ 'close' sạch sẽ báo lỗi giả (ECONNRESET) dù giấy đã ra.
      socket.end(buffer, () => {
        done = true;
        socket.destroy();
        resolve();
      })
    );
    socket.on("timeout", () => {
      socket.destroy();
      if (!done) reject(new Error(`Hết thời gian chờ máy in ${HOST}:${PORT}`));
    });
    socket.on("error", (err) => {
      if (!done) reject(err);
    });
  });
}

function log(...args) {
  console.log(new Date().toLocaleTimeString("vi-VN"), ...args);
}

// ── Chế độ thử máy in (không cần DB) ───────────────────────────────────────────
if (TEST_MODE) {
  const demo = {
    tenantName: "QUAN THU NGHIEM",
    isReprint: false,
    kitchenNo: 12,
    tableName: "Ban 5",
    ticketNo: "TEST01",
    confirmedAt: new Date().toISOString(),
    items: [
      { qty: 2, name: "Phở bò tái", modifiers: ["Nhiều hành"], note: "Không rau" },
      { qty: 1, name: "Cơm gà xối mỡ", modifiers: [], note: null },
    ],
  };
  log(`In phiếu thử tới ${HOST}:${PORT} (khổ ${CHARS} ký tự)…`);
  try {
    await sendToPrinter(buildKitchenTicket(demo));
    log("Đã gửi xong. Kiểm tra giấy ra ở máy in bếp.");
    process.exit(0);
  } catch (err) {
    console.error("Lỗi gửi máy in:", err.message);
    process.exit(1);
  }
}

// ── Vòng lặp thật ──────────────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    `Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY${envFile ? ` trong ${envFile}` : " (không tìm thấy .env.local)"}`
  );
  process.exit(1);
}

const REST = `${url.replace(/\/+$/, "")}/rest/v1`;

/** Gọi PostgREST của Supabase bằng fetch — thay cho @supabase/supabase-js để cầu in không cần npm. */
async function rest(pathAndQuery, init = {}) {
  const res = await fetch(`${REST}${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  if (res.status === 204) return null;
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}

/** Cầu in đặt tại 1 quán → CHỈ in phiếu của tenant đó (SaaS nhiều tenant chung 1 project). */
async function resolveTenantId() {
  if (process.env.PRINT_TENANT_ID) return process.env.PRINT_TENANT_ID;
  const slug = process.env.PRINT_TENANT_SLUG;
  if (!slug) {
    console.error("Thiếu PRINT_TENANT_SLUG (hoặc PRINT_TENANT_ID) trong .env.local — cầu in phải biết in cho quán nào.");
    process.exit(1);
  }
  let rows;
  try {
    rows = await rest(`/tenants?select=id,name&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  } catch (err) {
    console.error(`Không đọc được danh sách quán: ${err.message}`);
    process.exit(1);
  }
  if (!rows?.length) {
    console.error(`Không tìm thấy quán có slug "${slug}".`);
    process.exit(1);
  }
  log(`Quán: ${rows[0].name} (${slug})`);
  return rows[0].id;
}

const tenantId = await resolveTenantId();
const inFlight = new Set(); // chống lấy lại job đang in trong cùng tiến trình

/** Đánh dấu kết quả in. Lỗi mạng ở bước này chỉ ghi log — phiếu đã ra giấy rồi, không in lại. */
async function markJob(id, patch) {
  await rest(`/print_jobs?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

async function pollOnce() {
  const since = new Date(Date.now() - MAX_JOB_AGE_MIN * 60_000).toISOString();
  let jobs;
  try {
    jobs = await rest(
      `/print_jobs?select=id,payload&tenant_id=eq.${tenantId}&type=eq.kitchen_ticket` +
        `&status=eq.pending&created_at=gte.${since}&order=created_at.asc&limit=10`
    );
  } catch (err) {
    log("Lỗi đọc print_jobs:", err.message);
    return;
  }

  for (const job of jobs ?? []) {
    if (inFlight.has(job.id)) continue;
    inFlight.add(job.id);
    try {
      await sendToPrinter(buildKitchenTicket(job.payload ?? {}));
      await markJob(job.id, { status: "printed", printed_at: new Date().toISOString() });
      log(`Đã in phiếu ${job.payload?.ticketNo ?? job.id} (đơn #${job.payload?.kitchenNo ?? "?"})`);
    } catch (err) {
      await markJob(job.id, { status: "failed" }).catch(() => {});
      log(`IN LỖI phiếu ${job.id}: ${err.message} — bấm in lại ở POS sau khi sửa máy in.`);
    } finally {
      inFlight.delete(job.id);
    }
  }
}

log(
  `Cầu in bếp: ${HOST}:${PORT}, khổ ${CHARS} ký tự, poll mỗi ${POLL_MS}ms, ` +
    `bỏ qua phiếu cũ hơn ${MAX_JOB_AGE_MIN} phút. Ctrl+C để dừng.`
);
for (;;) {
  await pollOnce();
  await new Promise((r) => setTimeout(r, POLL_MS));
}
