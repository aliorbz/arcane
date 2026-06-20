import hre from "hardhat";

const { ethers } = hre;

async function checkAddress(label: string, address: string) {
  if (!ethers.isAddress(address)) {
    throw new Error(`${label} is not a valid address: ${address}`);
  }

  const code = await ethers.provider.getCode(address);
  const hasCode = code !== "0x";

  console.log(`${label}: ${address}`);
  console.log(`  bytecode: ${hasCode ? "FOUND" : "MISSING"}`);
  console.log(`  length: ${code.length}`);
}

async function main() {
  const nftAddress = process.env.NFT_ADDRESS;
  const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;

  if (!nftAddress || !marketplaceAddress) {
    throw new Error("Set NFT_ADDRESS and MARKETPLACE_ADDRESS in .env before running this check.");
  }

  console.log("Checking ARCANE deployment bytecode");
  const network = await ethers.provider.getNetwork();
  console.log(`Chain ID: ${network.chainId.toString()}`);
  await checkAddress("NFT", nftAddress);
  await checkAddress("Marketplace", marketplaceAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
