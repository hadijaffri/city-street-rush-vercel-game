# City Street Rush

City Street Rush is a 3D browser driving game built with Three.js + Vite.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on Vercel

This repository includes `vercel.json` and is ready for Vercel deployment.

## Stripe Checkout Links

To enable the in-game store checkout buttons (open in a new tab), set these environment variables in Vercel:

- `VITE_STRIPE_CREDITS_SMALL`
- `VITE_STRIPE_CREDITS_LARGE`
- `VITE_STRIPE_VIP_PASS`

Each value should be a Stripe Checkout or Payment Link URL.

## Accounts and Saves

The account system and save system are local-device saves stored in browser `localStorage`.
