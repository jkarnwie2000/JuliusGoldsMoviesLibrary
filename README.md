</> Markdown

## React Film App Screenshot

![React Film App Screenshot](./‎reactfilmproject.png)

## 🛠️ Tech Stack

* React 19: component-based UI
* React Router: client-side page navigation
* Vercel: hosting and serverless API functions
* Stripe Checkout: secure payments, tax, mailing fee
* Resend: order confirmation and verification emails
* Vercel Blob: private admin account storage
* OMDb API: movie data, cached via proxy
* Font Awesome: icons and social media links
* Axios: HTTP requests to movie API
* CSS3: responsive layout and animations

### 🚀 Key Features

* 🎬 Curated home page rows of popular movies
* 🔍 Live search with instant results as you type
* ⭐ Real IMDb star ratings on every movie
* 💲 Prices, sale discounts, and sort by price or rating
* 🛒 Add to cart from any page, with quantity controls
* 💳 Secure Stripe checkout with tax and mailing fee
* 📧 Automatic order confirmation emails to buyer and business
* 📊 Admin dashboard with revenue, top movies, and orders
* 🔐 Email-verified admin accounts with secure passwords
* ⚡ Fast loading with lazy-loaded rows and cached movie data
* 📱 Responsive design for phones, tablets, and desktops
* ✨ Smooth slide-up animations when opening a movie

## React Film App

🔗 **Live Demo:** [View Live Website](https://final-react-movies-projectcrimsongo.vercel.app/)

A React platform that helps movie lovers discover and buy their favorite films.

Written for: developers setting up the project locally on Windows (e.g. a README "Getting Started" section).

Two things I found while checking that change the setup:
1. **Node 20.9 is too old for the Vitest tests.** Vitest uses Vite 7.3.1, which needs Node 20.19 or newer. The site and the React tests run on 20.9, but `npm run test:unit` won't. The steps below use Node 22 LTS.
2. **The project has no `.env.example` or `.vscode/launch.json`.** Both are written out below so you can create them.

---

# Running Julius Gold's Movies Library locally

The project has two parts:
- a React front end (Create React App) in `src/`
- serverless API functions in `api/`, which handle movie data, Stripe checkout, emails and admin sign-in

`npm start` runs only the front end. To run **both** locally, use the Vercel CLI (`vercel dev`).

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | **22 LTS** (or 20.19+) | https://nodejs.org (includes npm) |
| Git | any recent | https://git-scm.com |
| Vercel CLI | latest | `npm install -g vercel` |
| VS Code | latest | https://code.visualstudio.com |
| Stripe CLI (optional, for order emails) | latest | `winget install Stripe.StripeCli` |

You'll also need free accounts for the keys in step 3: [OMDb](https://www.omdbapi.com/apikey.aspx), [Stripe](https://dashboard.stripe.com) (test mode), [Resend](https://resend.com) and [Vercel](https://vercel.com).

Check the installs in a terminal (PowerShell or VS Code's terminal):

```powershell
node -v      # v22.x or v20.19+
npm -v
vercel --version
```

## 2. Install dependencies

```powershell
git clone https://github.com/jkarnwie2000/JuliusGoldsMoviesLibrary.git
cd JuliusGoldsMoviesLibrary
npm ci
```

`npm ci` installs the exact versions in `package-lock.json`. Use `npm install` only if you're changing dependencies.

## 3. Configure environment variables

Create a file named **`.env.local`** in the project root. It's already ignored by Git and never uploaded to Vercel. Paste in this template and fill in your own values:

```dotenv
# --- Movie data (required) ---
OMDB_API_KEY=your_omdb_key

# --- Payments (required for checkout) — use a TEST key locally ---
STRIPE_SECRET_KEY=sk_test_...

# --- Where Stripe sends shoppers back to after paying ---
SITE_URL=http://localhost:3000

# --- Order + verification emails (required for emails and admin sign-up) ---
RESEND_API_KEY=re_...
BUSINESS_EMAIL=you@example.com
# EMAIL_FROM=Julius Gold's Movies <orders@yourdomain.com>   # optional; needs a verified Resend domain

# --- Admin accounts (required for /admin) ---
SESSION_SECRET=a_long_random_string
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
# ADMIN_EMAILS=you@example.com,partner@example.com          # optional; overrides BUSINESS_EMAIL
```

| Variable | Needed for | Where to get it |
|---|---|---|
| `OMDB_API_KEY` | All movie data | OMDb sends it by email; click the activation link in that email |
| `STRIPE_SECRET_KEY` | Checkout, admin dashboard | Stripe Dashboard → Developers → API keys (test mode) |
| `SITE_URL` | Checkout return links | `http://localhost:3000` locally |
| `RESEND_API_KEY` | All emails | Resend → API Keys |
| `BUSINESS_EMAIL` | Order alerts; approved admin email | Your email (use the one your Resend account is registered with) |
| `SESSION_SECRET` | Admin sign-in | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `BLOB_READ_WRITE_TOKEN` | Admin accounts | Vercel → Storage → create a **private** Blob store → copy its token |

Notes:
- **Use a separate Blob store for local work.** Pointing local development at the live site's store would read and write the real admin accounts.
- **`vercel env pull` won't fill these in.** Variables marked Secret in Vercel come back empty when pulled, so enter them in `.env.local` by hand.
- **Resend's limit before you verify a domain:** without a verified domain, Resend only delivers to the email address your Resend account uses.

## 4. Run in development mode

**Option A: the full site (recommended)**

```powershell
vercel link      # first time only: choose your Vercel account and this project
vercel dev
```

Open **http://localhost:3000**. `vercel dev` starts the React dev server and the `/api` functions together, and reads `.env.local`.

**Option B: front end only**

```powershell
npm start
```

This is quick for styling work, but movie data, checkout and `/admin` won't load, because they need the `/api` functions.

**Testing payments and order emails locally:**
- Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry date and any CVC.
- Stripe can't reach `localhost`, so to trigger the order emails, forward its notifications in a second terminal:

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

**Running the tests:**

```powershell
npm run test:all     # both suites
npm run test:ui      # React Testing Library (Jest), src/**/*.test.jsx
npm run test:unit    # Vitest (needs Node 20.19+), tests/**/*.test.mjs
npm test             # React tests in watch mode
```

**Production build:**

```powershell
npm run build        # output in /build
```

## 5. Launch and debug in VS Code

Create **`.vscode/launch.json`** with the configurations below, then open **Run and Debug** (`Ctrl+Shift+D`), pick a configuration and press **F5**.

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Full stack: vercel dev",
      "type": "node-terminal",
      "request": "launch",
      "command": "vercel dev",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Front end: Edge",
      "type": "msedge",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src"
    },
    {
      "name": "Tests: React Testing Library (Jest)",
      "type": "node-terminal",
      "request": "launch",
      "command": "npx react-scripts test --runInBand --watchAll=false",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Tests: Vitest",
      "type": "node-terminal",
      "request": "launch",
      "command": "npx vitest run",
      "cwd": "${workspaceFolder}"
    }
  ],
  "compounds": [
    {
      "name": "Debug full stack (server + browser)",
      "configurations": ["Full stack: vercel dev", "Front end: Edge"],
      "stopAll": true
    }
  ]
}
```

How to use them:
- **Debug full stack (server + browser):** starts `vercel dev` with the debugger attached and opens Edge.
  - Breakpoints in `api/*.mjs` pause the server code.
  - Breakpoints in `src/*.jsx` pause the browser code.
  - Edge may open before the dev server is ready; refresh once it's up.
- **Tests:** set a breakpoint in any test file, then run the matching test configuration. `--runInBand` keeps Jest in one process so its breakpoints work.
- **Chrome instead of Edge:** change `"type": "msedge"` to `"type": "chrome"`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm run test:unit` fails with an engine or syntax error | Upgrade Node to 20.19+ or 22 LTS |
| "Something went wrong" on the Movies page | Check that `OMDB_API_KEY` is set and activated, and that you're using `vercel dev`, not `npm start` |
| Admin sign-up says it couldn't send the code | Check `RESEND_API_KEY`, and use the email your Resend account is registered with |
| `EPERM` errors on `build/` | OneDrive is locking files; pause OneDrive syncing or move the project out of OneDrive |

---

I can also add the `.env.example` file and `.vscode/launch.json` to the repo, so these instructions point to real files.
