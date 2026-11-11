// Minimal stand-ins for Vercel's req/res objects so handlers can be called directly.
export function callHandler(handler, req = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body, headers: this.headers });
        return this;
      },
    };
    Promise.resolve(handler({ method: "GET", headers: {}, query: {}, ...req }, res)).catch(reject);
  });
}

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
