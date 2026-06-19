import hre from "hardhat";

const { ethers, network } = hre;

async function main() {
  if (network.name !== "arcTestnet") {
    console.warn(`Deploying on '${network.name}'. Expected 'arcTestnet' for Arc Testnet.`);
  }

  const [deployer] = await ethers.getSigners();
  const feeReceiver = process.env.FEE_RECEIVER || deployer.address;

  console.log("Deploying ARCANE contracts");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Fee receiver:", feeReceiver);

  const ArcaneNFT = await ethers.getContractFactory("ArcaneNFT");
  const nft = await ArcaneNFT.deploy();
  const nftDeploymentTx = nft.deploymentTransaction();
  console.log("NFT deployment tx:", nftDeploymentTx?.hash || "unavailable");
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  const ArcaneMarketplace = await ethers.getContractFactory("ArcaneMarketplace");
  const marketplace = await ArcaneMarketplace.deploy(feeReceiver);
  const marketplaceDeploymentTx = marketplace.deploymentTransaction();
  console.log("Marketplace deployment tx:", marketplaceDeploymentTx?.hash || "unavailable");
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log("");
  console.log("ARCANE deployment complete");
  console.log("NFT deployment tx:", nftDeploymentTx?.hash || "unavailable");
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
