# ARCANE

ARCANE is building an AI-assisted onchain marketplace where users explore, evaluate, and execute NFT actions with blockchain-backed ownership.

---

## Introduction

ARCANE is an onchain NFT marketplace prototype built for the Arc Testnet.

Today, ARCANE provides real onchain minting, listing, buying, and offer flows. Core marketplace actions are handled through smart contracts instead of simulated UI state.

Long-term, ARCANE is intended to become an intelligent marketplace layer. The goal is not to replace user decisions. The goal is to help users understand market activity, evaluate listings, compare offers, prepare actions, and manage collections.

All execution still requires wallet confirmation.

In the current prototype:

- NFTs are minted onchain.
- Ownership comes from blockchain state.
- Listings and offers are contract-driven.
- Transactions require wallet confirmation.
- The UI never acts as the final source of truth.

The application keeps local UI data for display and caching, but ownership, listings, offers, and marketplace actions are verified against contract state.

---

## Why ARCANE

Many NFT demos simulate the hardest parts of a marketplace: ownership, listings, purchases, offers, and transaction finality. That makes the interface easy to build, but it also makes it difficult to trust what the user is seeing.

Marketplace UIs also tend to hide blockchain complexity in ways that can be confusing. A user should not need to inspect every contract call manually, but they should be able to trust that an action only appears complete after the chain confirms it.

ARCANE’s approach is straightforward:

- Use real wallet-confirmed transactions.
- Read ownership from `ownerOf()`.
- Read listing and offer state from marketplace contracts.
- Keep the experience simple while treating blockchain state as authoritative.

---

## Architecture

### Frontend

- React
- Vite
- Tailwind
- RainbowKit
- wagmi
- viem

### Backend

- Express wrapper for local and production serving

### Contracts

- `ArcaneNFT`
- `ArcaneMarketplace`

### Network

- Arc Testnet
- Chain ID: `5042002`

### State Philosophy

- Blockchain = source of truth
- Local storage = UI cache only

Local storage may preserve display metadata and user interface cache, but contract reads determine ownership, active listings, and offer state.

Marketplace contracts secure execution. Future AI systems improve decision support.

---

## Core Features

### Mint NFTs

Users connect a wallet and mint NFTs through the `ArcaneNFT` contract. After the mint transaction confirms, ARCANE reads the minted token ID from the transaction receipt and saves the card using the real onchain token ID.

### List NFTs

Owners can list NFTs through the marketplace contract. ARCANE verifies token ownership, checks marketplace approval, asks the user to approve the marketplace when needed, and only updates listing state after the listing transaction succeeds.

### Buy NFTs

Listed NFTs can be purchased with the network’s native token. ARCANE calls `buyItem(listingId)`, sends the required value, waits for the transaction receipt, and refreshes ownership and listing state from contract reads.

### Offer System

ARCANE supports onchain offers from the NFT detail page:

- Make offer
- Update offer
- Cancel offer
- Accept offer

Offers can be made on listed and unlisted NFTs. Updating an offer uses the same payable contract function as making an offer. Accepting an offer transfers ownership through the marketplace contract after wallet confirmation and receipt success.

### Royalties and Fees

Marketplace fee:

- `2.5%`

Creator royalty:

- `2.5%`

Seller proceeds:

- Remaining proceeds after marketplace fee and creator royalty

If the seller is also the royalty receiver, creator royalty is skipped and the seller receives that portion as part of their proceeds.

---

## How It Works

A typical ARCANE flow:

Connect wallet  
-> Mint  
-> List  
-> Buy  
-> Offer  
-> Accept  
-> Ownership refresh

After each onchain action, ARCANE waits for the transaction receipt before updating user-facing state. Ownership is verified from `ownerOf(tokenId)`, while listing state is refreshed from marketplace contract reads such as `activeListings(...)` and `listings(...)`.

The UI can help prepare actions, but wallet confirmation and contract state decide what actually happened.

---

## Where ARCANE is Going

The marketplace is the infrastructure layer. It provides the contract-backed execution path for minting, listing, buying, and offers.

The future product direction is an assistant that helps users understand and prepare marketplace actions before they sign anything. The assistant may help users:

- explain collection performance
- summarize portfolio activity
- suggest listing prices
- compare active offers
- highlight unusual pricing
- prepare listing forms
- guide marketplace actions
- help users discover opportunities

The assistant never executes transactions. Users remain the final signer.

---

## Smart Contracts

ARCANE currently runs on Arc Testnet.

Network:

- Arc Testnet
- Chain ID: `5042002`

Deployed contracts:

- NFT: `0x92A6b7fafe0ea654f95938a9Ca744EB73598a285`
- Marketplace: `0xee2F5618F01dF8D4b35ade4E6c16822b1E090F6f`

---

## Current Status

Current stage:

- Working prototype

Working:

- Mint
- List
- Buy
- Offers
- Royalties
- Ownership sync

---

## Roadmap

### v0.2

Marketplace maturity:

- Marketplace polish
- Profile improvements
- Search
- Activity

### v0.3

Agent-assisted marketplace:

Users describe intent in natural language. For example:

- "Price this NFT"
- "Should I accept this offer?"
- "Show me undervalued items"
- "Prepare a listing"

The assistant prepares actions and explains context.

Users confirm.

---

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Compile contracts:

```bash
npm run contracts:compile
```

---

## Disclaimer

ARCANE currently runs on testnet.

Built as an experimental onchain marketplace for Arc ecosystem exploration.
