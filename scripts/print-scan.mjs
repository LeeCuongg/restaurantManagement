// scripts/print-scan.mjs — Dò máy in ESC/POS trong LAN (công cụ cài đặt cho cầu in).
//
// Tìm IP máy in là chỗ vướng nhất khi lắp tại quán: phiếu self-test có thể mờ, mất, hoặc máy in
// đang ở dải mạng khác với laptop. Script quét cổng 9100 trên mọi dải /24 mà máy đang nối và
// liệt kê IP nào có người trả lời — điền thẳng vào PRINTER_HOST.
//
// Chạy:  npm run print:scan                 (quét mọi dải mạng đang nối)
//        npm run print:scan -- 192.168.1    (chỉ quét dải chỉ định)
//
// Lưu ý: phải chạy trên máy CÙNG mạng với máy in (cùng router, không qua VPN).
import net from "node:net";
import os from "node:os";

const PORT = Number(process.env.PRINTER_PORT || 9100);
const TIMEOUT_MS = 900; // đủ cho máy in nhiệt trong LAN; dài hơn chỉ làm quét chậm
const CONCURRENCY = 64;

/** Các dải /24 mà máy này đang nối (bỏ loopback, bỏ IPv6, bỏ card ảo dải 169.254). */
function localSubnets() {
  const out = new Set();
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (a.address.startsWith("169.254.")) continue;
      out.add(a.address.split(".").slice(0, 3).join("."));
    }
  }
  return [...out];
}

/** Cổng 9100 có mở không. Chỉ bắt tay TCP rồi ngắt — không gửi byte nào nên máy in không nhả giấy. */
function probe(host) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: PORT });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
  });
}

/** Quét theo lô để không mở 254 socket cùng lúc (Windows hay nghẽn). */
async function scanSubnet(prefix) {
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
  const found = [];
  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const batch = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(probe));
    batch.forEach((host, j) => {
      if (results[j]) found.push(host);
    });
    process.stdout.write(`\r  ${prefix}.x — đã quét ${Math.min(i + CONCURRENCY, hosts.length)}/254`);
  }
  process.stdout.write("\r".padEnd(40) + "\r");
  return found;
}

const arg = process.argv[2];
// Nhận cả "192.168.1" lẫn "192.168.1.87" — đều lấy 3 octet đầu.
const subnets = arg ? [arg.split(".").slice(0, 3).join(".")] : localSubnets();

if (!subnets.length) {
  console.error("Máy này không nối mạng LAN nào (chỉ có loopback). Cắm dây/Wi-Fi rồi chạy lại.");
  process.exit(1);
}

console.log(`Quét cổng ${PORT} trên: ${subnets.map((s) => `${s}.x`).join(", ")}\n`);

const found = [];
for (const prefix of subnets) {
  found.push(...(await scanSubnet(prefix)));
}

if (!found.length) {
  console.log("Không tìm thấy máy in nào mở cổng 9100.\n");
  console.log("Kiểm tra: máy in đã cắm dây LAN vào cùng router chưa · đèn POWER có sáng không ·");
  console.log("laptop có đang qua VPN / mạng khách (guest Wi-Fi tách mạng) không ·");
  console.log("giữ FEED rồi bật nguồn để in phiếu self-test xem IP thật của máy in.");
  process.exit(1);
}

console.log(`Tìm thấy ${found.length} thiết bị mở cổng ${PORT}:\n`);
for (const host of found) console.log(`  ${host}`);
console.log("\nĐiền vào .env.local:  PRINTER_HOST=<IP ở trên>");
console.log("Rồi thử in phiếu mẫu:  npm run print:bridge:test");
