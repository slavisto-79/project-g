# Project G

Project G is an inclusive AI fitness coach for women and men, backed by a real human coach.

This first scaffold contains:

- an animated Splash Screen;
- a cinematic Welcome Screen;
- a connected Get Started action;
- one shared Expo codebase for iOS, Android, and web preview;
- static web export configuration for Vercel.

## Run locally

Install Node.js 20 or newer, then:

```bash
npm install
npm run web
```

To test on a phone, install Expo Go and run:

```bash
npm start
```

Scan the QR code shown in the terminal.

## Checks

```bash
npm run typecheck
npm run build:web
```

## Deploy with Vercel

Import the GitHub repository into Vercel. The included `vercel.json` runs the web build and serves
the generated `dist` folder.

## Product direction

Working name: **Project G**

Positioning: **Powered by AI. Guided by a Real Coach.**

## MVP test-mode follow-up

- Before production release, lock set completion and “Next exercise” until the active
  repetition/rest timing rules allow progression. This remains intentionally unlocked
  during prototype testing.
