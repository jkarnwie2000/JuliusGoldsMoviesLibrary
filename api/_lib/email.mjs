// Order confirmation emails, sent through Resend's HTTP API.
// Env: RESEND_API_KEY (required), BUSINESS_EMAIL (where business copies go),
//      EMAIL_FROM (optional; defaults to Resend's shared test sender).
import { formatMoney } from "./orders.mjs";

const BRAND = "Julius Gold's Movies Library";
const DEFAULT_FROM = "Julius Gold's Movies <onboarding@resend.dev>";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function sendEmail({ to, subject, html, replyTo, idempotencyKey }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Stripe may deliver the same webhook twice; this stops duplicate emails.
      ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      subject,
      html,
      ...(replyTo && { reply_to: replyTo }),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

function orderTable(order) {
  const m = (c) => formatMoney(c, order.currency);
  const row = (label, value, bold) =>
    `<tr><td style="padding:6px 0;color:#444;${bold ? "font-weight:700;color:#111;" : ""}">${label}</td>` +
    `<td style="padding:6px 0;text-align:right;${bold ? "font-weight:700;" : ""}">${value}</td></tr>`;
  const items = order.items
    .map((i) => row(`${esc(i.name)} &times; ${i.quantity}`, m(i.amountCents)))
    .join("");
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;">
      ${items}
      <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:6px;"></td></tr>
      ${row("Subtotal", m(order.subtotalCents))}
      ${row("Sales tax (10%)", m(order.taxCents))}
      ${row("Mailing fee", m(order.mailingCents))}
      <tr><td colspan="2" style="border-top:2px solid #f5c518;padding-top:6px;"></td></tr>
      ${row("Total paid", m(order.totalCents), true)}
    </table>`;
}

function shippingBlock(order) {
  if (!order.shipping) return "";
  return `<p style="margin:20px 0 4px;font-weight:700;">Mailing to</p>
    <p style="margin:0;color:#444;line-height:1.5;">${[order.shipping.name, ...order.shipping.lines].map(esc).join("<br>")}</p>`;
}

function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#111;padding:20px 28px;color:#f5c518;font-size:20px;font-weight:700;">${BRAND}</td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 16px;font-size:22px;">${title}</h1>
        ${body}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const orderRef = (order) => order.id.slice(-8).toUpperCase();

export function buyerEmail(order) {
  const name = order.customerName ? `, ${esc(order.customerName.split(" ")[0])}` : "";
  return {
    subject: `Your order is confirmed (#${orderRef(order)})`,
    html: layout(
      `Thanks for your order${name}!`,
      `<p style="color:#444;line-height:1.5;">We've received your payment. Here's your receipt for order <strong>#${orderRef(order)}</strong>.</p>
       ${orderTable(order)}
       ${shippingBlock(order)}
       <p style="margin-top:24px;color:#444;">Enjoy the show!</p>`
    ),
  };
}

export function businessEmail(order) {
  const testNote = order.livemode ? "" : `<p style="background:#fff8db;border:1px solid #f5c518;padding:8px 12px;border-radius:6px;">Test-mode order (no real money).</p>`;
  return {
    subject: `New order #${orderRef(order)}: ${formatMoney(order.totalCents, order.currency)}`,
    html: layout(
      "New order received",
      `${testNote}
       <p style="color:#444;line-height:1.5;">
         <strong>Customer:</strong> ${esc(order.customerName || "(no name)")} &lt;${esc(order.email || "no email")}&gt;<br>
         <strong>Order:</strong> #${orderRef(order)} &middot; ${new Date(order.created).toUTCString()}
       </p>
       ${orderTable(order)}
       ${shippingBlock(order)}`
    ),
  };
}
