// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LRN Time Vault
/// @notice Holds one LRN position per account until an immutable unlock delay has elapsed.
/// @dev This version deliberately handles principal only. It does not mint or distribute rewards.
contract LRNTimeVault {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 amount;
        uint256 unlockTime;
    }

    error LRNTimeVaultZeroToken();
    error LRNTimeVaultZeroDuration();
    error LRNTimeVaultZeroAmount();
    error LRNTimeVaultActivePosition(address account);
    error LRNTimeVaultNoPosition(address account);
    error LRNTimeVaultPositionLocked(uint256 unlockTime, uint256 currentTime);

    IERC20 public immutable token;
    uint256 public immutable lockDuration;

    uint256 public totalLocked;
    mapping(address account => Position position) public positions;

    event Staked(address indexed account, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(address tokenAddress, uint256 duration) {
        if (tokenAddress == address(0)) revert LRNTimeVaultZeroToken();
        if (duration == 0) revert LRNTimeVaultZeroDuration();

        token = IERC20(tokenAddress);
        lockDuration = duration;
    }

    function stake(uint256 amount) external {
        if (amount == 0) revert LRNTimeVaultZeroAmount();
        if (positions[msg.sender].amount != 0) {
            revert LRNTimeVaultActivePosition(msg.sender);
        }

        uint256 unlockTime = block.timestamp + lockDuration;
        positions[msg.sender] = Position({ amount: amount, unlockTime: unlockTime });
        totalLocked += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, unlockTime);
    }

    function withdraw() external {
        Position memory position = positions[msg.sender];
        if (position.amount == 0) revert LRNTimeVaultNoPosition(msg.sender);
        if (block.timestamp < position.unlockTime) {
            revert LRNTimeVaultPositionLocked(position.unlockTime, block.timestamp);
        }

        delete positions[msg.sender];
        totalLocked -= position.amount;

        token.safeTransfer(msg.sender, position.amount);

        emit Withdrawn(msg.sender, position.amount);
    }
}
