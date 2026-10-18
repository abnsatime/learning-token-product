// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LRN Time Vault
/// @notice Locks LRN principal in one of three testnet plans and unlocks a pre-funded reward.
/// @dev Principal withdrawal and reward claiming are deliberately separate operations.
contract LRNTimeVault is Ownable {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 amount;
        uint256 reward;
        uint256 unlockTime;
        uint8 planId;
    }

    error LRNTimeVaultZeroToken();
    error LRNTimeVaultZeroAmount();
    error LRNTimeVaultInvalidPlan(uint8 planId);
    error LRNTimeVaultRewardRoundsToZero();
    error LRNTimeVaultInsufficientRewardReserve(uint256 available, uint256 required);
    error LRNTimeVaultActivePosition(address account);
    error LRNTimeVaultNoPosition(address account);
    error LRNTimeVaultPositionLocked(uint256 unlockTime, uint256 currentTime);
    error LRNTimeVaultNoClaimableReward(address account);
    error LRNTimeVaultZeroRecipient();
    error LRNTimeVaultRecoveryExceedsReserve(uint256 available, uint256 requested);

    IERC20 public immutable token;

    uint256 public totalLocked;
    uint256 public totalRewardLiability;

    mapping(address account => Position position) public positions;
    mapping(address account => uint256 reward) public claimableRewards;

    event Staked(
        address indexed account, uint256 amount, uint256 reward, uint256 unlockTime, uint8 planId
    );
    event PrincipalWithdrawn(address indexed account, uint256 amount, uint256 rewardUnlocked);
    event RewardClaimed(address indexed account, uint256 reward);
    event RewardReserveRecovered(address indexed recipient, uint256 amount);

    constructor(address tokenAddress, address initialOwner) Ownable(initialOwner) {
        if (tokenAddress == address(0)) revert LRNTimeVaultZeroToken();
        token = IERC20(tokenAddress);
    }

    function planDetails(uint8 planId) public pure returns (uint256 duration, uint256 rewardBps) {
        if (planId == 0) return (5 minutes, 100);
        if (planId == 1) return (10 minutes, 130);
        if (planId == 2) return (30 minutes, 150);
        revert LRNTimeVaultInvalidPlan(planId);
    }

    function previewReward(uint256 amount, uint8 planId) public pure returns (uint256) {
        (, uint256 rewardBps) = planDetails(planId);
        return amount * rewardBps / 10_000;
    }

    function rewardReserve() public view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        uint256 committed = totalLocked + totalRewardLiability;
        return balance > committed ? balance - committed : 0;
    }

    function stake(uint256 amount, uint8 planId) external {
        if (amount == 0) revert LRNTimeVaultZeroAmount();
        if (positions[msg.sender].amount != 0) {
            revert LRNTimeVaultActivePosition(msg.sender);
        }

        (uint256 duration,) = planDetails(planId);
        uint256 reward = previewReward(amount, planId);
        if (reward == 0) revert LRNTimeVaultRewardRoundsToZero();

        uint256 available = rewardReserve();
        if (available < reward) {
            revert LRNTimeVaultInsufficientRewardReserve(available, reward);
        }

        uint256 unlockTime = block.timestamp + duration;
        positions[msg.sender] =
            Position({ amount: amount, reward: reward, unlockTime: unlockTime, planId: planId });
        totalLocked += amount;
        totalRewardLiability += reward;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, reward, unlockTime, planId);
    }

    function withdrawPrincipal() external {
        Position memory position = positions[msg.sender];
        if (position.amount == 0) revert LRNTimeVaultNoPosition(msg.sender);
        if (block.timestamp < position.unlockTime) {
            revert LRNTimeVaultPositionLocked(position.unlockTime, block.timestamp);
        }

        delete positions[msg.sender];
        totalLocked -= position.amount;
        claimableRewards[msg.sender] += position.reward;

        token.safeTransfer(msg.sender, position.amount);

        emit PrincipalWithdrawn(msg.sender, position.amount, position.reward);
    }

    function claimReward() external {
        uint256 reward = claimableRewards[msg.sender];
        if (reward == 0) revert LRNTimeVaultNoClaimableReward(msg.sender);

        claimableRewards[msg.sender] = 0;
        totalRewardLiability -= reward;

        token.safeTransfer(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }

    function recoverRewardReserve(address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert LRNTimeVaultZeroRecipient();

        uint256 available = rewardReserve();
        if (amount > available) {
            revert LRNTimeVaultRecoveryExceedsReserve(available, amount);
        }

        token.safeTransfer(recipient, amount);

        emit RewardReserveRecovered(recipient, amount);
    }
}
