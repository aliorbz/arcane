// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ArcaneNFT
 * @dev An OpenSea-compatible general digital artifact NFT collection deployed on Arc Testnet.
 * Features customizable metadata tags (discordId, discordRole, discordUsername) to maintain
 * background compatibility with profile systems while functioning as a standard ERC721 collectible.
 */
contract ArcaneNFT is ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // Fee required to mint a new ARCANE collectible
    uint256 public constant MINT_FEE = 0.01 * 10**18; // 0.01 USDC (Since USDC is native gas on Arc)

    struct ArtifactMetadata {
        string categoryId;     // Category identifying standard (e.g. Celestial, Lunar, Cyber)
        string subclass;       // Subclass of the artifact
        string artifactName;   // Human-readable custom name
    }

    // Mapping from tokenId to its ARCANE specific metadata
    mapping(uint256 => ArtifactMetadata) public artifacts;

    // Track if a specific category identifier has already been minted to prevent double claims
    mapping(string => bool) private _mintedIdentifiers;

    event ArtifactForged(uint256 indexed tokenId, address indexed owner, string categoryId, string subclass, string name);
    event ArtifactUpdated(uint256 indexed tokenId, string subclass, string name);

    constructor() ERC721("ARCANE Artifacts", "ARCANE") Ownable() {}

    /**
     * @dev Checks if a given identifier has already minted any nft.
     */
    function checkHasMinted(string memory categoryId) public view returns (bool) {
        return _mintedIdentifiers[categoryId];
    }

    /**
     * @dev Simple backward-compatible check function for legacy role identifiers.
     */
    function checkHasMintedRole(string memory categoryId, string memory) public view returns (bool) {
        return _mintedIdentifiers[categoryId];
    }

    /**
     * @dev Returns the detailed item properties. Maps to cardData fields in ABI.
     */
    function cardData(uint256 tokenId) public view returns (string memory discordId, string memory discordRole, string memory discordUsername) {
        require(_exists(tokenId), "ARCANE: Utility query for nonexistent token");
        ArtifactMetadata memory meta = artifacts[tokenId];
        return (meta.categoryId, meta.subclass, meta.artifactName);
    }

    /**
     * @dev Core minting function matching the Web3 frontend interface seamlessly.
     */
    function mintCard(
        address to, 
        string memory categoryId, 
        string memory subclass, 
        string memory artifactName
    ) public payable returns (uint256) {
        require(msg.value >= MINT_FEE, "ARCANE: Insufficient mint fee");
        require(!_mintedIdentifiers[categoryId], "ARCANE: Identifier already registered a forged artifact");

        _tokenIdCounter.increment();
        uint256 newId = _tokenIdCounter.current();

        _safeMint(to, newId);
        artifacts[newId] = ArtifactMetadata(categoryId, subclass, artifactName);
        _mintedIdentifiers[categoryId] = true;

        emit ArtifactForged(newId, to, categoryId, subclass, artifactName);

        // Refund excess native tokens safely (gas currency is USDC on Arc)
        if (msg.value > MINT_FEE) {
            payable(msg.sender).transfer(msg.value - MINT_FEE);
        }

        return newId;
    }

    /**
     * @dev Admin or authorized update helper to evolve or refresh artifact metadata tags.
     */
    function updateCardData(uint256 tokenId, string memory subclass, string memory artifactName) public {
        require(ownerOf(tokenId) == msg.sender || owner() == msg.sender, "ARCANE: Caller is neither owner nor proxy administrative modifier");
        artifacts[tokenId].subclass = subclass;
        artifacts[tokenId].artifactName = artifactName;
        emit ArtifactUpdated(tokenId, subclass, artifactName);
    }

    /**
     * @dev Withdraw built-up protocol mint fees to the contract owner.
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
}
