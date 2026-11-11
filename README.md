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

# Installation and Setup Guide

Follow these instructions to install, configure, build, and run the React Movie E-commerce Project locally on a Windows machine.

## 1. Prerequisites

Before getting started, ensure the following software is installed on your computer.

### Required Software

| Software | Recommended Version | Purpose |
|---|---|---|
| Node.js | 20.9 or higher (Node 20.x) | JavaScript runtime |
| npm | Included with Node.js | Package management |
| Visual Studio Code | Latest version | Code editor |
| Git | Latest version | Version control |

### Verify Your Installations

Open the VS Code integrated terminal (`Ctrl + ``) or Windows PowerShell and execute:

**Check Node.js:**
```bash
node --version
```

**Check npm:**
```bash
npm --version
```

**Check Git:**
```bash
git --version
```

Ensure Node.js reports version `v20.9.0` or a compatible later Node 20 release.

If Node.js is not installed, download it from:

https://nodejs.org/

## 2. Clone or Download the Repository

If you are using Git, open your terminal and clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
```

Navigate into the project directory:

```bash
cd YOUR_PROJECT_DIRECTORY
```

Alternatively, download the repository as a ZIP file from GitHub, extract it, and open the extracted folder in Visual Studio Code.

## 3. Install Project Dependencies

The project includes a `package.json` file and a `package-lock.json` file.

These files define the project's dependencies and ensure consistent installations.

From the project's root directory, execute:

```bash
npm ci
```

This command installs the exact dependency versions recorded in `package-lock.json`.

**Important:** Use `npm ci` rather than `npm install` when setting up the project from scratch. This helps ensure reproducible installations without unnecessarily changing the lockfile.

If you encounter dependency installation problems, try:

```bash
npm install
```

## 4. Configure Environment Variables

The project contains backend API endpoints under the `api/` directory.

These endpoints indicate that the application has server-side functionality for authentication, checkout, order management, email notifications, and Stripe payment processing.

You may need environment variables to connect these services.

### Step 1: Check for an Environment Example File

Look in the project's root directory for:

```text
.env.example
```

If this file exists, create a local environment file:

```bash
copy .env.example .env
```

If the application uses a particular environment-file naming convention, follow the requirements of its framework and configuration.

### Step 2: Configure Your API Credentials

Depending on the implementation, the backend may require credentials for:

- Stripe: Payment processing and webhook verification.
- OMDb API: Movie information and search functionality.
- Email provider: Transactional emails and order confirmations.
- Authentication: Session management, authentication secrets, or token signing.

**Important:** The exact environment variable names cannot be established from the directory structure alone. Check `.env.example`, `api/` configuration files, and the relevant source code for the required names.

Do not commit `.env` files or expose private API credentials in your GitHub repository.

Add the following to `.gitignore` if they are not already excluded:

```gitignore
.env
.env.local
.env.*.local
```

## 5. Run the Application in Development Mode

Once the dependencies have been installed and the environment variables configured, you can start the application.

### Step 1: Open the VS Code Terminal

Navigate to:

**Terminal → New Terminal**

Ensure the terminal is located in the project's root directory.

### Step 2: Check Available Scripts

Run:

```bash
npm run
```

This displays the scripts configured in `package.json`.

### Step 3: Start the Development Server

If the project uses Create React App, execute:

```bash
npm start
```

If the project uses Vite, execute:

```bash
npm run dev
```

If the project uses Vercel CLI for its serverless API endpoints and has the appropriate development script configured, you may need:

```bash
npx vercel dev
```

The appropriate command depends on the scripts defined in `package.json`.

### Step 4: Open the Application

Once the development server starts, open the local URL displayed in your terminal.

Common development URLs include:

```text
http://localhost:3000
```

or:

```text
http://localhost:5173
```

The actual address depends on the development server configuration.

## 6. Build the Project for Production

To create an optimized production build, execute the appropriate build script defined in `package.json`.

For example:

```bash
npm run build
```

This generates an optimized version of the application for deployment.

Depending on the build tool:

- Create React App generates a `build/` directory.
- Vite generates a `dist/` directory.

The generated production files should be used for deployment rather than the development server.

## 7. Run the Tests

The project includes automated tests using Vitest.

The test configuration is located in:

```text
vitest.config.mjs
```

The project also includes test files covering:

- API handlers
- Authentication
- Orders and email functionality
- Pricing calculations
- React components
- Checkout functionality

### Run the Test Suite

To execute all tests:

```bash
npx vitest run
```

### Run Tests in Watch Mode

To automatically rerun tests when files change:

```bash
npx vitest
```

### Run Tests with Coverage

If the project has the Vitest coverage provider installed:

```bash
npx vitest run --coverage
```

## 8. Running and Debugging Through Visual Studio Code

Visual Studio Code includes a built-in JavaScript debugger that supports Node.js and browser-based debugging.

### Step 1: Open the Project

Open the project folder in VS Code.

### Step 2: Access the Run and Debug Panel

Click the Run and Debug icon in the left sidebar or press:

```text
Ctrl + Shift + D
```

### Step 3: Configure Browser Debugging

If the project does not already contain a `.vscode/launch.json` file, create the following directory and file:

```text
.vscode/
└── launch.json
```

For a development server running on `localhost:3000`, use:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch React Application",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

This configuration assumes the VS Code JavaScript Debugger extension supports the `chrome` debugger type.

If your application runs on another port, update the URL accordingly.

### Step 4: Start the Development Server

Open a terminal and execute the appropriate development command:

```bash
npm start
```

### Step 5: Start Debugging

1. Open the Run and Debug panel.
2. Select `Launch React Application`.
3. Click the green Start Debugging button.
4. VS Code will launch the application in Chrome.
5. Set breakpoints in your React components or JavaScript files.
6. Inspect variables, execution flow, and errors using the debugger.

### Debugging Backend API Endpoints

The project also contains Node.js API handlers.

These can be debugged using VS Code's Node.js debugger.

For example, if you run the backend development server with a Node.js process that supports the inspector, you can attach VS Code to it using a separate Node.js debugging configuration.

The exact configuration depends on how the API endpoints are executed.

## 9. Project Structure Overview

The project is organized into the following major directories:

|# final-react-movies-project
