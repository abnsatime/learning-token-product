// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LRN Faucet
/// @notice Distributes a fixed amount of LRN once to each address on the testnet.
/// @dev The faucet cannot mint tokens. Anyone may fund it by transferring LRN to this address.
contract LRNFaucet {
    using SafeERC20 for IERC20;

    error LRNFaucetZeroToken();
    error LRNFaucetZeroClaimAmount();
    error LRNFaucetAlreadyClaimed(address account);
    error LRNFaucetInsufficientBalance(uint256 available, uint256 required);

    IERC20 public immutable token;
    uint256 public immutable claimAmount;

    mapping(address account => bool claimed) public hasClaimed;

    event Claimed(address indexed account, uint256 amount);

    constructor(address tokenAddress, uint256 amountPerClaim) {
        if (tokenAddress == address(0)) revert LRNFaucetZeroToken();
        if (amountPerClaim == 0) revert LRNFaucetZeroClaimAmount();

        token = IERC20(tokenAddress);
        claimAmount = amountPerClaim;
    }

    function claim() external {
        if (hasClaimed[msg.sender]) revert LRNFaucetAlreadyClaimed(msg.sender);

        uint256 available = token.balanceOf(address(this));
        if (available < claimAmount) {
            revert LRNFaucetInsufficientBalance(available, claimAmount);
        }

        hasClaimed[msg.sender] = true;
        token.safeTransfer(msg.sender, claimAmount);

        emit Claimed(msg.sender, claimAmount);
    }
}
