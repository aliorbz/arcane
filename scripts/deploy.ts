import hre from "hardhat";

const { ethers, network } = hre;

async function main() {
  if (network.name !== "arcTestnet") {
    console.warn(`Deploying on '${network.name}'. Expected 'arcTestnet' for Arc Testnet.`);
  }

  const [deployer] = await ethers.getSigners();
  const feeReceiver = process.env.FEE_RECEIVER || deployer.address;
  const marketplaceOnly = process.env.MARKETPLACE_ONLY === "true";
  const existingNftAddress = process.env.NFT_ADDRESS;

  console.log(marketplaceOnly ? "Deploying ARCANE Marketplace only" : "Deploying ARCANE contracts");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Fee receiver:", feeReceiver);

  let nftAddress = existingNftAddress || "";
  let nftDeploymentTxHash = "not deployed";

  if (marketplaceOnly) {
    if (!nftAddress || !ethers.isAddress(nftAddress)) {
      throw new Error("Set NFT_ADDRESS to the existing ArcaneNFT address when MARKETPLACE_ONLY=true.");
    }
    console.log("Using existing NFT:", nftAddress);
  } else {
    const ArcaneNFT = await ethers.getContractFactory("ArcaneNFT");
    const nft = await ArcaneNFT.deploy();
    const nftDeploymentTx = nft.deploymentTransaction();
    nftDeploymentTxHash = nftDeploymentTx?.hash || "unavailable";
    console.log("NFT deployment tx:", nftDeploymentTxHash);
    await nft.waitForDeployment();
    nftAddress = await nft.getAddress();
  }

  const ArcaneMarketplace = await ethers.getContractFactory("ArcaneMarketplace");
  const marketplace = await ArcaneMarketplace.deploy(feeReceiver);
  const marketplaceDeploymentTx = marketplace.deploymentTransaction();
  console.log("Marketplace deployment tx:", marketplaceDeploymentTx?.hash || "unavailable");
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log("");
  console.log("ARCANE deployment complete");
  console.log("NFT deployment tx:", nftDeploymentTxHash);
  console.log("Marketplace deployment tx:", marketplaceDeploymentTx?.hash || "unavailable");
  console.log("NFT:", nftAddress);
  console.log("Marketplace:", marketplaceAddress);
  console.log("");
  console.log("Paste these into src/lib/config.ts:");
  console.log(`CONTRACTS.NFT.address = "${nftAddress}"`);
  console.log(`CONTRACTS.MARKETPLACE.address = "${marketplaceAddress}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
