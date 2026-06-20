<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/322be9de-4e9b-4fc7-9ef4-6325282bd18b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy ARCANE contracts to Arc Testnet

This repo includes Hardhat deployment infrastructure for the ARCANE NFT and marketplace contracts. Deployment is always manual and uses only a wallet private key that you provide locally through `.env`.

1. Install dependencies:
   `npm install`

2. Create a local `.env` file:
   `cp .env.example .env`

3. Fill in these deployment values in `.env`:
   - `ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network`
   - `PRIVATE_KEY=...`
   - `FEE_RECEIVER=0x...`

4. Compile contracts:
   `npm run contracts:compile`

5. Deploy to Arc Testnet:
   `npm run contracts:deploy:arc`

6. After deployment, copy the printed addresses into `.env`:
   - `NFT_ADDRESS=0x...`
   - `MARKETPLACE_ADDRESS=0x...`

7. Verify bytecode exists at both deployed addresses:
   `npm run contracts:check:arc`

8. Paste the deployed addresses into [src/lib/config.ts](src/lib/config.ts):
   - `CONTRACTS.NFT.address`
   - `CONTRACTS.MARKETPLACE.address`

Arc Testnet details:
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
