// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ILRNMintable {
    function mint(address recipient, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function cap() external view returns (uint256);
}

/// @title LRN V2 Emission Controller
/// @notice Permissionlessly releases one fixed, linear emission after each elapsed epoch.
/// @dev This contract must be granted the token's MINTER_ROLE after deployment.
contract LRNEmissionController {
    error LRNEmissionZeroToken();
    error LRNEmissionZeroTreasury();
    error LRNEmissionZeroDuration();
    error LRNEmissionZeroAmount();
    error LRNEmissionNotReady(uint256 nextEmissionTime, uint256 currentTime);
    error LRNEmissionSupplyExhausted();

    ILRNMintable public immutable token;
    address public immutable treasury;
    uint256 public immutable epochDuration;
    uint256 public immutable emissionAmount;

    uint256 public nextEmissionTime;
    uint256 public epochsReleased;
    uint256 public totalReleased;

    event EmissionReleased(
        address indexed caller,
        address indexed treasury,
        uint256 indexed epoch,
        uint256 amount,
        uint256 nextEmissionTime
    );

    constructor(
        address tokenAddress,
        address treasuryAddress,
        uint256 duration,
        uint256 amountPerEpoch
    ) {
        if (tokenAddress == address(0)) revert LRNEmissionZeroToken();
        if (treasuryAddress == address(0)) revert LRNEmissionZeroTreasury();
        if (duration == 0) revert LRNEmissionZeroDuration();
        if (amountPerEpoch == 0) revert LRNEmissionZeroAmount();

        token = ILRNMintable(tokenAddress);
        treasury = treasuryAddress;
        epochDuration = duration;
        emissionAmount = amountPerEpoch;
        nextEmissionTime = block.timestamp + duration;
    }

    function release() external returns (uint256 releasedAmount) {
        if (block.timestamp < nextEmissionTime) {
            revert LRNEmissionNotReady(nextEmissionTime, block.timestamp);
        }

        uint256 supply = token.totalSupply();
        uint256 maximum = token.cap();
        if (supply >= maximum) revert LRNEmissionSupplyExhausted();

        uint256 remaining = maximum - supply;
        releasedAmount = remaining < emissionAmount ? remaining : emissionAmount;

        nextEmissionTime += epochDuration;
        epochsReleased += 1;
        totalReleased += releasedAmount;

        emit EmissionReleased(
            msg.sender, treasury, epochsReleased, releasedAmount, nextEmissionTime
        );

        token.mint(treasury, releasedAmount);
    }
}
