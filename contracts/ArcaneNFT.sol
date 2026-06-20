// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title ArcaneNFT
 * @dev ERC721 collection for ARCANE creator assets on Arc Testnet.
 *
 * The contract keeps the existing frontend-compatible cardData/mintCard shape,
 * while adding tokenURI storage, per-token creator tracking, and ERC-2981
 * creator royalties for marketplace settlement.
 */
contract ArcaneNFT is ERC721URIStorage, Ownable, IERC2981 {
    using Counters for Counters.Counter;

    uint96 public constant DEFAULT_ROYALTY_BPS = 250; // 2.5%
    uint96 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MINT_FEE = 0.01 ether;

    Counters.Counter private _tokenIdCounter;

    struct ArtifactMetadata {
        string categoryId;
        string subclass;
        string artifactName;
    }

    mapping(uint256 => ArtifactMetadata) public artifacts;
    mapping(uint256 => address) public creators;
    mapping(string => bool) private _mintedIdentifiers;

    event ArtifactForged(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed creator,
        string categoryId,
        string subclass,
        string name,
        string uri
    );
    event ArtifactUpdated(uint256 indexed tokenId, string subclass, string name, string uri);

    constructor() ERC721("ARCANE Artifacts", "ARCANE") {}

    function checkHasMinted(string memory categoryId) public view returns (bool) {
        return _mintedIdentifiers[categoryId];
    }

    function checkHasMintedRole(string memory categoryId, string memory) public view returns (bool) {
        return _mintedIdentifiers[categoryId];
    }

    function cardData(
        uint256 tokenId
    ) public view returns (string memory discordId, string memory discordRole, string memory discordUsername) {
        require(_exists(tokenId), "ARCANE: query for nonexistent token");
        ArtifactMetadata memory meta = artifacts[tokenId];
        return (meta.categoryId, meta.subclass, meta.artifactName);
    }

    function creatorOf(uint256 tokenId) external view returns (address) {
        require(_exists(tokenId), "ARCANE: query for nonexistent token");
        return creators[tokenId];
    }

    function mintCard(
        address to,
        string memory categoryId,
        string memory subclass,
        string memory artifactName
    ) public payable returns (uint256) {
        return _mintArcane(to, categoryId, subclass, artifactName, "");
    }

    function mintCardWithURI(
        address to,
        string memory categoryId,
        string memory subclass,
        string memory artifactName,
        string memory uri
    ) public payable returns (uint256) {
        return _mintArcane(to, categoryId, subclass, artifactName, uri);
    }

    function updateCardData(
        uint256 tokenId,
        string memory subclass,
        string memory artifactName
    ) public {
        require(_isApprovedOrOwner(msg.sender, tokenId) || owner() == msg.sender, "ARCANE: not token owner or admin");
        artifacts[tokenId].subclass = subclass;
        artifacts[tokenId].artifactName = artifactName;
        emit ArtifactUpdated(tokenId, subclass, artifactName, tokenURI(tokenId));
    }

    function updateTokenURI(uint256 tokenId, string memory uri) external {
        require(_isApprovedOrOwner(msg.sender, tokenId) || owner() == msg.sender, "ARCANE: not token owner or admin");
        _setTokenURI(tokenId, uri);
        ArtifactMetadata memory meta = artifacts[tokenId];
        emit ArtifactUpdated(tokenId, meta.subclass, meta.artifactName, uri);
    }

    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view override returns (address receiver, uint256 royaltyAmount) {
        require(_exists(tokenId), "ARCANE: royalty query for nonexistent token");
        receiver = creators[tokenId];
        royaltyAmount = (salePrice * DEFAULT_ROYALTY_BPS) / FEE_DENOMINATOR;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "ARCANE: no mint fees to withdraw");
        (bool sent, ) = payable(owner()).call{value: balance}("");
        require(sent, "ARCANE: withdraw failed");
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    function _mintArcane(
        address to,
        string memory categoryId,
        string memory subclass,
        string memory artifactName,
        string memory uri
    ) internal returns (uint256) {
        require(to != address(0), "ARCANE: mint to zero address");
        require(msg.value >= MINT_FEE, "ARCANE: insufficient mint fee");
        require(!_mintedIdentifiers[categoryId], "ARCANE: identifier already minted");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);
        if (bytes(uri).length > 0) {
            _setTokenURI(tokenId, uri);
        }

        artifacts[tokenId] = ArtifactMetadata(categoryId, subclass, artifactName);
        creators[tokenId] = msg.sender;
        _mintedIdentifiers[categoryId] = true;

        emit ArtifactForged(tokenId, to, msg.sender, categoryId, subclass, artifactName, uri);

        if (msg.value > MINT_FEE) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - MINT_FEE}("");
            require(refunded, "ARCANE: refund failed");
        }

        return tokenId;
    }
}
