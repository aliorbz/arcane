// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ArcaneMarketplace
 * @dev An OpenSea-grade peer-to-peer NFT Trading Marketplace built for Arc Testnet.
 * Supports listing, cancellation, instant purchasing, on-chain custom bidding (makes offers, accepts, cancels),
 * and platform trade fee distribution of standard ERC721 items.
 */
contract ArcaneMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _listingIdCounter;

    uint256 public constant PLATFORM_FEE_PERCENT = 5; // 5% protocol fee
    address public feeReceiver;

    struct Listing {
        uint256 listingId;
        address nftAddress;
        uint256 tokenId;
        address seller;
        uint256 price;   // in wei (since USDC is native gas on Arc)
        bool active;
    }

    struct Offer {
        address offerer;
        uint256 amount;  // in wei
        bool active;
    }

    // Listing ID => Listing Data
    mapping(uint256 => Listing) public listings;

    // NFT Address => Token ID => Active Listing ID
    mapping(address => mapping(uint256 => uint256)) public activeListings;

    // NFT Address => Token ID => Offerer Address => Offer Data
    mapping(address => mapping(uint256 => mapping(address => Offer))) public offers;

    // NFT Address => Token ID => List of unique offerers to support getOfferers retrieval
    mapping(address => mapping(uint256 => address[])) private _tokenOfferers;

    event ItemListed(uint256 indexed listingId, address indexed nftAddress, uint256 indexed tokenId, address seller, uint256 price);
    event ListingCancelled(uint256 indexed listingId);
    event ItemBought(uint256 indexed listingId, address indexed nftAddress, uint256 indexed tokenId, address buyer, uint256 price);
    event OfferMade(address indexed nftAddress, uint256 indexed tokenId, address indexed offerer, uint256 amount);
    event OfferCancelled(address indexed nftAddress, uint256 indexed tokenId, address indexed offerer);
    event OfferAccepted(address indexed nftAddress, uint256 indexed tokenId, address seller, address indexed offerer, uint256 amount);

    constructor() Ownable() {
        feeReceiver = msg.sender;
    }

    /**
     * @dev Sets a new platform protocol fee receiver address.
     */
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "ARCANE: Fee receiver cannot be null");
        feeReceiver = _feeReceiver;
    }

    /**
     * @dev List a digital artifact NFT for sale on the peer-to-peer market.
     */
    function listItem(address nftAddress, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "ARCANE: Listing price must be greater than zero");
        
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "ARCANE: Caller does not own the requested token");
        require(nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this), "ARCANE: Marketplace not approved to handle asset");

        _listingIdCounter.increment();
        uint256 newListingId = _listingIdCounter.current();

        listings[newListingId] = Listing(
            newListingId,
            nftAddress,
            tokenId,
            msg.sender,
            price,
            true
        );

        activeListings[nftAddress][tokenId] = newListingId;

        emit ItemListed(newListingId, nftAddress, tokenId, msg.sender, price);
    }

    /**
     * @dev Cancel an active item listing.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "ARCANE: This listing has already been closed");
        require(listing.seller == msg.sender || owner() == msg.sender, "ARCANE: Caller is not the creator of this listing");

        listing.active = false;
        
        if (activeListings[listing.nftAddress][listing.tokenId] == listingId) {
            delete activeListings[listing.nftAddress][listing.tokenId];
        }

        emit ListingCancelled(listingId);
    }

    /**
     * @dev Complete purchase of a listed item. Supports platform fee distribution.
     */
    function buyItem(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "ARCANE: Requested listing is not active");
        require(msg.value >= listing.price, "ARCANE: Insufficient funds sent to complete buy purchase");

        listing.active = false;
        delete activeListings[listing.nftAddress][listing.tokenId];

        uint256 fee = (listing.price * PLATFORM_FEE_PERCENT) / 100;
        uint256 sellerProceeds = listing.price - fee;

        // Transfer platform protocol fee
        if (fee > 0) {
            payable(feeReceiver).transfer(fee);
        }

        // Transfer trade proceeds to seller
        payable(listing.seller).transfer(sellerProceeds);

        // Refund any extra gas/overpayment safely (Arc uses USDC as gas token)
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        // Convey the ERC721 token ownership to the buyer
        IERC721(listing.nftAddress).safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        emit ItemBought(listingId, listing.nftAddress, listing.tokenId, msg.sender, listing.price);
    }

    /**
     * @dev Put down an Escrowed on-chain bid (Offer/Offer purchase) for any token.
     */
    function makeOffer(address nftAddress, uint256 tokenId) external payable nonReentrant {
        require(msg.value > 0, "ARCANE: Offer amount must be greater than zero");
        
        Offer storage existing = offers[nftAddress][tokenId][msg.sender];
        if (existing.active) {
            // Refund their previous offer so they can place a new premium bid
            uint256 overflow = existing.amount;
            existing.active = false;
            payable(msg.sender).transfer(overflow);
        } else {
            // Track key unique offerers
            _tokenOfferers[nftAddress][tokenId].push(msg.sender);
        }

        offers[nftAddress][tokenId][msg.sender] = Offer(
            msg.sender,
            msg.value,
            true
        );

        emit OfferMade(nftAddress, tokenId, msg.sender, msg.value);
    }

    /**
     * @dev Cancel an active on-chain offer and reclaim escrowed USDC gas tokens.
     */
    function cancelOffer(address nftAddress, uint256 tokenId) external nonReentrant {
        Offer storage offer = offers[nftAddress][tokenId][msg.sender];
        require(offer.active, "ARCANE: No active bid or offer found to cancel");

        uint256 refundAmount = offer.amount;
        offer.active = false;
        offer.amount = 0;

        payable(msg.sender).transfer(refundAmount);

        emit OfferCancelled(nftAddress, tokenId, msg.sender);
    }

    /**
     * @dev Token owner accepts a pending on-chain bid. Resolves escrowed proceeds, enforces fees, and shifts ownership.
     */
    function acceptOffer(address nftAddress, uint256 tokenId, address offerer) external nonReentrant {
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "ARCANE: Caller is not the legal owner of this asset");

        Offer storage offer = offers[nftAddress][tokenId][offerer];
        require(offer.active, "ARCANE: Specified user offer is not active");

        uint256 offerAmount = offer.amount;
        offer.active = false;
        offer.amount = 0;

        // Cancel any active seller listings automatically
        uint256 activeListingId = activeListings[nftAddress][tokenId];
        if (activeListingId > 0) {
            listings[activeListingId].active = false;
            delete activeListings[nftAddress][tokenId];
        }

        uint256 fee = (offerAmount * PLATFORM_FEE_PERCENT) / 100;
        uint256 sellerProceeds = offerAmount - fee;

        // Distribute fee
        if (fee > 0) {
            payable(feeReceiver).transfer(fee);
        }

        // Pay seller proceeds
        payable(msg.sender).transfer(sellerProceeds);

        // Convey the ERC721 ownership from seller to offerer
        nft.safeTransferFrom(msg.sender, offerer, tokenId);

        emit OfferAccepted(nftAddress, tokenId, msg.sender, offerer, offerAmount);
    }

    /**
     * @dev Returns array of public addresses currently offering bids on a requested item.
     */
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
}
