// POST /api/auth  — admin account actions.
//   { action: "request-code", email }                -> emails a 6-digit code (approved emails only)
//   { action: "set-password", email, code, password } -> creates the account or resets the password; signs in
//   { action: "login", email, password }             -> signs in
//   { action: "me" } with "Authorization: Bearer <token>" -> checks a session
import { AuthError, clearCode, issueCode, login, MIN_PASSWORD, setPasswordWithCode, verifySession } from "./_lib/auth.mjs";
import { sendEmail } from "./_lib/email.mjs";

const CODE_SENT = "If that email is approved for admin access, a 6-digit code is on its way. Check your inbox (and spam folder).";

function codeEmail(code, minutes) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#111;padding:18px 28px;color:#f5c518;font-size:18px;font-weight:700;">Julius Gold's Movies Library</td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 12px;">Your admin verification code is:</p>
        <p style="margin:0 0 16px;font-size:34px;font-weight:700;letter-spacing:8px;">${code}</p>
        <p style="margin:0;color:#555;font-size:14px;">It expires in ${minutes} minutes. If you didn't request this, you can ignore this email; nobody can use it without access to your inbox.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, email, code, password } = req.body || {};
  try {
    switch (action) {
      case "request-code": {
        const issued = await issueCode(email);
        if (issued.code) {
          if (!process.env.RESEND_API_KEY) throw new AuthError("Email sending isn't set up (RESEND_API_KEY).", 503);
          try {
            await sendEmail({
              to: issued.email,
              subject: `${issued.code} is your admin verification code`,
              html: codeEmail(issued.code, issued.minutes),
            });
          } catch (err) {
            console.error("Code email failed:", err.message);
            await clearCode(issued.email); // let them retry right away once email is fixed
            throw new AuthError("We couldn't send the code email. Please try again in a few minutes.", 502);
          }
        }
        return res.status(200).json({ ok: true, message: CODE_SENT, minPassword: MIN_PASSWORD });
      }
      case "set-password":
        return res.status(200).json(await setPasswordWithCode(email, code, password));
      case "login":
        return res.status(200).json(await login(email, password));
      case "me": {
        const account = await verifySession(req.headers.authorization);
        return res.status(200).json({ email: account.email });
      }
      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) await new Promise((r) => setTimeout(r, 400)); // slow down guessing
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Auth error:", err.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
