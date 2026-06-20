import hre from "hardhat";

const { ethers } = hre;

const NFT_ABI = [
  "event ArtifactForged(uint256 indexed tokenId, address indexed owner, address indexed creator, string categoryId, string subclass, string name, string uri)",
  "event ArtifactUpdated(uint256 indexed tokenId, string subclass, string name, string uri)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function cardData(uint256 tokenId) view returns (string discordId, string discordRole, string discordUsername)",
];

function getEnvNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return Math.floor(parsed);
}

async function getDiscoveryStartBlock(): Promise<{ startBlock: number; source: string }> {
  if (process.env.START_BLOCK) {
    return { startBlock: getEnvNumber("START_BLOCK", 0), source: "START_BLOCK" };
  }

  if (process.env.NFT_DEPLOYMENT_BLOCK) {
    return { startBlock: getEnvNumber("NFT_DEPLOYMENT_BLOCK", 0), source: "NFT_DEPLOYMENT_BLOCK" };
  }

  const deploymentTx = process.env.NFT_DEPLOYMENT_TX;
  if (deploymentTx) {
    const receipt = await ethers.provider.getTransactionReceipt(deploymentTx);
    if (!receipt) {
      throw new Error(`NFT_DEPLOYMENT_TX receipt not found: ${deploymentTx}`);
    }
    return { startBlock: receipt.blockNumber, source: "NFT_DEPLOYMENT_TX receipt" };
  }

  return { startBlock: 0, source: "fallback block 0" };
}

function formatValue(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  return String(value);
}

async function getLogsInChunks(
  address: string,
  topics: string[],
  fromBlock: number,
  toBlock: number,
  chunkSize: number
) {
  const logs = [];
  const totalBlocks = Math.max(toBlock - fromBlock + 1, 1);
  let currentChunkSize = Math.min(chunkSize, 10_000);

  for (let start = fromBlock; start <= toBlock;) {
    const end = Math.min(start + currentChunkSize - 1, toBlock);
    const progress = (((end - fromBlock + 1) / totalBlocks) * 100).toFixed(2);
    try {
      const chunk = await ethers.provider.getLogs({
        address,
        topics,
        fromBlock: start,
        toBlock: end,
      });
      logs.push(...chunk);
      console.log(`Scanned blocks ${start}-${end} (${progress}%): ${chunk.length} raw ArtifactForged logs`);
      start = end + 1;
    } catch (error: any) {
      const message = error.shortMessage || error.reason || error.message || String(error);
      const nextChunkSize = Math.max(Math.floor(currentChunkSize / 2), 1);
      console.log(`Scanned blocks ${start}-${end} (${progress}%): ERROR - ${message}`);

      if (nextChunkSize < currentChunkSize) {
        console.log(`Retrying from block ${start} with BLOCK_CHUNK=${nextChunkSize}`);
        currentChunkSize = nextChunkSize;
        continue;
      }

      console.log(`Skipping block ${start}; minimum chunk size still failed.`);
      start += 1;
    }
  }

  return logs;
}

async function main() {
  const nftAddress = process.env.NFT_ADDRESS;
  if (!nftAddress) {
    throw new Error("Set NFT_ADDRESS in .env before running this script.");
  }
  if (!ethers.isAddress(nftAddress)) {
    throw new Error(`NFT_ADDRESS is not a valid address: ${nftAddress}`);
  }

  const network = await ethers.provider.getNetwork();
  const latestBlock = await ethers.provider.getBlockNumber();
  const { startBlock, source: startBlockSource } = await getDiscoveryStartBlock();
  const chunkSize = Math.min(getEnvNumber("BLOCK_CHUNK", 10_000), 10_000);
  const toBlock = latestBlock;

  console.log("ARCANE NFT discovery debug");
  console.log("Chain ID:", network.chainId.toString());
  console.log("NFT_ADDRESS:", nftAddress);
  console.log("START_BLOCK:", startBlock);
  console.log("START_BLOCK_SOURCE:", startBlockSource);
  console.log("NFT_DEPLOYMENT_TX:", process.env.NFT_DEPLOYMENT_TX || "not set");
  console.log("NFT_DEPLOYMENT_BLOCK:", process.env.NFT_DEPLOYMENT_BLOCK || "not set");
  console.log("LATEST_BLOCK:", latestBlock);
  console.log("BLOCK_CHUNK:", chunkSize);

  const code = await ethers.provider.getCode(nftAddress);
  const hasCode = code !== "0x";
  console.log("NFT bytecode exists:", hasCode ? "YES" : "NO");
  if (!hasCode) return;

  const iface = new ethers.Interface(NFT_ABI);
  const artifactForged = iface.getEvent("ArtifactForged");
  if (!artifactForged) {
    throw new Error("ArtifactForged event is missing from debug ABI.");
  }

  const topic = artifactForged.topicHash;
  console.log("ArtifactForged topic:", topic);

  const rawLogs = await getLogsInChunks(nftAddress, [topic], startBlock, toBlock, chunkSize);
  console.log("Raw ArtifactForged log count:", rawLogs.length);

  const decodedLogs = rawLogs.flatMap((log) => {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed || parsed.name !== "ArtifactForged") return [];
      return [{ log, parsed }];
    } catch {
      return [];
    }
  });

  console.log("Decoded ArtifactForged log count:", decodedLogs.length);

  const tokenIds = Array.from(
    new Set(decodedLogs.map(({ parsed }) => parsed.args.tokenId.toString()))
  ).sort((a, b) => Number(BigInt(a) - BigInt(b)));

  console.log("Discovered token IDs:", tokenIds.length > 0 ? tokenIds.join(", ") : "none");

  if (decodedLogs.length > 0) {
    console.log("");
    console.log("Decoded ArtifactForged logs:");
    for (const { log, parsed } of decodedLogs) {
      console.log(`- block ${log.blockNumber}, tx ${log.transactionHash}`);
      parsed.fragment.inputs.forEach((input, index) => {
        console.log(`  ${input.name}: ${formatValue(parsed.args[index])}`);
      });
    }
  }

  if (tokenIds.length === 0) {
    const eventNames = iface.fragments.flatMap((fragment) =>
      fragment.type === "event" && "name" in fragment ? [fragment.name] : []
    );

    console.log("");
    console.log("No ArtifactForged logs found.");
    console.log("Events available in ABI:", eventNames.join(", ") || "none");
    console.log("Likely causes:");
    console.log("- START_BLOCK is after the mint events.");
    console.log("- NFT_ADDRESS points to a different contract than the one used for minting.");
    console.log("- The deployed contract emitted a different event signature.");
    console.log("- The RPC is not returning historical logs for the requested range.");
    return;
  }

  const nft = new ethers.Contract(nftAddress, NFT_ABI, ethers.provider);
  console.log("");
  console.log("Per-token reads:");

  for (const tokenId of tokenIds) {
    console.log(`Token #${tokenId}`);
    try {
      console.log("  ownerOf:", await nft.ownerOf(tokenId));
    } catch (error: any) {
      console.log("  ownerOf: ERROR -", error.shortMessage || error.reason || error.message || error);
    }

    try {
      console.log("  tokenURI:", await nft.tokenURI(tokenId));
    } catch (error: any) {
      console.log("  tokenURI: ERROR -", error.shortMessage || error.reason || error.message || error);
    }

    try {
      const data = await nft.cardData(tokenId);
      console.log("  cardData.discordId:", data[0]);
      console.log("  cardData.discordRole:", data[1]);
      console.log("  cardData.discordUsername:", data[2]);
    } catch (error: any) {
      console.log("  cardData: ERROR -", error.shortMessage || error.reason || error.message || error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
