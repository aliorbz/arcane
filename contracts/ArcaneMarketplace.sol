// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

/**
 * @title ArcaneMarketplace
 * @dev Native-token marketplace for ARCANE ERC721 assets on Arc Testnet.
 *
 * ARCANE sale split:
 * - 2.5% marketplace fee
 * - 2.5% creator royalty when the NFT supports ERC-2981
 * - 95% seller proceeds for ARCANE NFTs using the default royalty
 */
contract ArcaneMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    using ERC165Checker for address;

    uint96 public constant MARKETPLACE_FEE_BPS = 250; // 2.5%
    uint96 public constant FEE_DENOMINATOR = 10_000;

    Counters.Counter private _listingIdCounter;

    address public feeReceiver;

    struct Listing {
        uint256 listingId;
        address nftAddress;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    struct Offer {
        address offerer;
        uint256 amount;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    mapping(address => mapping(uint256 => uint256)) public activeListings;
    mapping(address => mapping(uint256 => mapping(address => Offer))) public offers;
    mapping(address => mapping(uint256 => address[])) private _tokenOfferers;

    event FeeReceiverUpdated(address indexed feeReceiver);
    event ItemListed(
        uint256 indexed listingId,
        address indexed nftAddress,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );
    event ListingCancelled(uint256 indexed listingId);
    event ItemBought(
        uint256 indexed listingId,
        address indexed nftAddress,
        uint256 indexed tokenId,
        address buyer,
        uint256 price,
        uint256 sellerProceeds,
        uint256 creatorRoyalty,
        uint256 marketplaceFee
    );
    event OfferMade(address indexed nftAddress, uint256 indexed tokenId, address indexed offerer, uint256 amount);
    event OfferEdited(address indexed nftAddress, uint256 indexed tokenId, address indexed offerer, uint256 oldAmount, uint256 newAmount);
    event OfferCancelled(address indexed nftAddress, uint256 indexed tokenId, address indexed offerer, uint256 amount);
    event OfferAccepted(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address seller,
        address indexed offerer,
        uint256 amount,
        uint256 sellerProceeds,
        uint256 creatorRoyalty,
        uint256 marketplaceFee
    );

    constructor(address _feeReceiver) {
        require(_feeReceiver != address(0), "ARCANE: fee receiver cannot be zero");
        feeReceiver = _feeReceiver;
        emit FeeReceiverUpdated(_feeReceiver);
    }

    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "ARCANE: fee receiver cannot be zero");
        feeReceiver = _feeReceiver;
        emit FeeReceiverUpdated(_feeReceiver);
    }

    function listItem(address nftAddress, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "ARCANE: price must be greater than zero");
        require(activeListings[nftAddress][tokenId] == 0, "ARCANE: item already listed");

        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "ARCANE: caller is not token owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this),
            "ARCANE: marketplace not approved"
        );

        _listingIdCounter.increment();
        uint256 listingId = _listingIdCounter.current();

        listings[listingId] = Listing({
            listingId: listingId,
            nftAddress: nftAddress,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true
        });

        activeListings[nftAddress][tokenId] = listingId;

        emit ItemListed(listingId, nftAddress, tokenId, msg.sender, price);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "ARCANE: listing is not active");
        require(listing.seller == msg.sender || owner() == msg.sender, "ARCANE: caller cannot cancel listing");

        listing.active = false;
        if (activeListings[listing.nftAddress][listing.tokenId] == listingId) {
            delete activeListings[listing.nftAddress][listing.tokenId];
        }

        emit ListingCancelled(listingId);
    }

    function buyItem(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "ARCANE: listing is not active");
        require(msg.sender != listing.seller, "ARCANE: seller cannot buy own listing");
        require(msg.value >= listing.price, "ARCANE: insufficient payment");

        IERC721 nft = IERC721(listing.nftAddress);
        require(nft.ownerOf(listing.tokenId) == listing.seller, "ARCANE: seller no longer owns token");

        listing.active = false;
        delete activeListings[listing.nftAddress][listing.tokenId];

        (uint256 marketplaceFee, address royaltyReceiver, uint256 creatorRoyalty, uint256 sellerProceeds) =
            _calculatePayouts(listing.nftAddress, listing.tokenId, listing.price, listing.seller);

        _payout(listing.seller, sellerProceeds);
        if (creatorRoyalty > 0) {
            _payout(royaltyReceiver, creatorRoyalty);
        }
        if (marketplaceFee > 0) {
            _payout(feeReceiver, marketplaceFee);
        }
        if (msg.value > listing.price) {
            _payout(msg.sender, msg.value - listing.price);
        }

        nft.safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        emit ItemBought(
            listingId,
            listing.nftAddress,
            listing.tokenId,
            msg.sender,
            listing.price,
            sellerProceeds,
            creatorRoyalty,
            marketplaceFee
        );
    }

    function makeOffer(address nftAddress, uint256 tokenId) external payable nonReentrant {
        require(msg.value > 0, "ARCANE: offer must be greater than zero");
        require(IERC721(nftAddress).ownerOf(tokenId) != msg.sender, "ARCANE: owner cannot offer on own token");

        Offer storage existing = offers[nftAddress][tokenId][msg.sender];
        if (existing.active) {
            uint256 oldAmount = existing.amount;
            existing.amount = msg.value;
            _payout(msg.sender, oldAmount);
            emit OfferEdited(nftAddress, tokenId, msg.sender, oldAmount, msg.value);
            return;
        }

        _tokenOfferers[nftAddress][tokenId].push(msg.sender);
        offers[nftAddress][tokenId][msg.sender] = Offer({
            offerer: msg.sender,
            amount: msg.value,
            active: true
        });

        emit OfferMade(nftAddress, tokenId, msg.sender, msg.value);
    }

    function cancelOffer(address nftAddress, uint256 tokenId) external nonReentrant {
        Offer storage offer = offers[nftAddress][tokenId][msg.sender];
        require(offer.active, "ARCANE: no active offer");

        uint256 refundAmount = offer.amount;
        offer.active = false;
        offer.amount = 0;

        _payout(msg.sender, refundAmount);

        emit OfferCancelled(nftAddress, tokenId, msg.sender, refundAmount);
    }

    function acceptOffer(address nftAddress, uint256 tokenId, address offerer) external nonReentrant {
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "ARCANE: caller is not token owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this),
            "ARCANE: marketplace not approved"
        );

        Offer storage offer = offers[nftAddress][tokenId][offerer];
        require(offer.active, "ARCANE: offer is not active");

        uint256 offerAmount = offer.amount;
        offer.active = false;
        offer.amount = 0;

        uint256 activeListingId = activeListings[nftAddress][tokenId];
        if (activeListingId > 0) {
            listings[activeListingId].active = false;
            delete activeListings[nftAddress][tokenId];
        }

        (uint256 marketplaceFee, address royaltyReceiver, uint256 creatorRoyalty, uint256 sellerProceeds) =
            _calculatePayouts(nftAddress, tokenId, offerAmount, msg.sender);

        nft.safeTransferFrom(msg.sender, offerer, tokenId);

        _payout(msg.sender, sellerProceeds);
        if (creatorRoyalty > 0) {
            _payout(royaltyReceiver, creatorRoyalty);
        }
        if (marketplaceFee > 0) {
            _payout(feeReceiver, marketplaceFee);
        }

        emit OfferAccepted(
            nftAddress,
            tokenId,
            msg.sender,
            offerer,
            offerAmount,
            sellerProceeds,
            creatorRoyalty,
            marketplaceFee
        );
    }

    function getOfferers(address nftAddress, uint256 tokenId) external view returns (address[] memory) {
        address[] memory raw = _tokenOfferers[nftAddress][tokenId];
        uint256 activeCount = 0;

        for (uint256 i = 0; i < raw.length; i++) {
            if (offers[nftAddress][tokenId][raw[i]].active) {
                activeCount++;
            }
        }

        address[] memory activeOnly = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < raw.length; i++) {
            if (offers[nftAddress][tokenId][raw[i]].active) {
                activeOnly[index] = raw[i];
                index++;
            }
        }

        return activeOnly;
    }

    function _calculatePayouts(
        address nftAddress,
        uint256 tokenId,
        uint256 salePrice,
        address seller
    )
        internal
        view
        returns (uint256 marketplaceFee, address royaltyReceiver, uint256 creatorRoyalty, uint256 sellerProceeds)
    {
        marketplaceFee = (salePrice * MARKETPLACE_FEE_BPS) / FEE_DENOMINATOR;

        if (nftAddress.supportsInterface(type(IERC2981).interfaceId)) {
            (royaltyReceiver, creatorRoyalty) = IERC2981(nftAddress).royaltyInfo(tokenId, salePrice);
            if (royaltyReceiver == seller) {
                creatorRoyalty = 0;
            }
        }

        require(marketplaceFee + creatorRoyalty <= salePrice, "ARCANE: fee total exceeds price");
        sellerProceeds = salePrice - marketplaceFee - creatorRoyalty;
    }

    function _payout(address to, uint256 amount) internal {
        if (amount == 0) return;
        require(to != address(0), "ARCANE: payout to zero address");
        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "ARCANE: payout failed");
    }
}
