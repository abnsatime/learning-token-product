// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { LRNTimeVault } from "../src/LRNTimeVault.sol";
import { LRNToken } from "../src/LRNToken.sol";

contract LRNTimeVaultTest is Test {
    uint256 internal constant USER_BALANCE = 1_000 ether;
    uint256 internal constant STAKE_AMOUNT = 250 ether;
    uint256 internal constant REWARD_POOL = 10_000 ether;

    LRNToken internal token;
    LRNTimeVault internal vault;
    address internal learner = makeAddr("learner");
    address internal secondLearner = makeAddr("secondLearner");

    event Staked(
        address indexed account, uint256 amount, uint256 reward, uint256 unlockTime, uint8 planId
    );
    event PrincipalWithdrawn(address indexed account, uint256 amount, uint256 rewardUnlocked);
    event RewardClaimed(address indexed account, uint256 reward);
    event RewardReserveRecovered(address indexed recipient, uint256 amount);

    function setUp() public {
        token = new LRNToken(address(this));
        vault = new LRNTimeVault(address(token), address(this));
        token.transfer(address(vault), REWARD_POOL);
        token.transfer(learner, USER_BALANCE);
        token.transfer(secondLearner, USER_BALANCE);
    }

    function test_ConfigurationAndPlans() public view {
        assertEq(address(vault.token()), address(token));
        assertEq(vault.owner(), address(this));

        (uint256 fiveMinuteDuration, uint256 fiveMinuteReward) = vault.planDetails(0);
        (uint256 tenMinuteDuration, uint256 tenMinuteReward) = vault.planDetails(1);
        (uint256 thirtyMinuteDuration, uint256 thirtyMinuteReward) = vault.planDetails(2);

        assertEq(fiveMinuteDuration, 5 minutes);
        assertEq(fiveMinuteReward, 100);
        assertEq(tenMinuteDuration, 10 minutes);
        assertEq(tenMinuteReward, 130);
        assertEq(thirtyMinuteDuration, 30 minutes);
        assertEq(thirtyMinuteReward, 150);
        assertEq(vault.rewardReserve(), REWARD_POOL);
    }

    function test_StakeUsesAllowanceAndReservesReward() public {
        uint8 planId = 1;
        uint256 expectedReward = STAKE_AMOUNT * 130 / 10_000;
        uint256 expectedUnlockTime = block.timestamp + 10 minutes;

        vm.startPrank(learner);
        token.approve(address(vault), STAKE_AMOUNT);

        vm.expectEmit(true, false, false, true, address(vault));
        emit Staked(learner, STAKE_AMOUNT, expectedReward, expectedUnlockTime, planId);
        vault.stake(STAKE_AMOUNT, planId);
        vm.stopPrank();

        (uint256 amount, uint256 reward, uint256 unlockTime, uint8 storedPlanId) =
            vault.positions(learner);
        assertEq(amount, STAKE_AMOUNT);
        assertEq(reward, expectedReward);
        assertEq(unlockTime, expectedUnlockTime);
        assertEq(storedPlanId, planId);
        assertEq(vault.totalLocked(), STAKE_AMOUNT);
        assertEq(vault.totalRewardLiability(), expectedReward);
        assertEq(vault.rewardReserve(), REWARD_POOL - expectedReward);
        assertEq(token.allowance(learner, address(vault)), 0);
    }

    function test_RevertWhenAllowanceIsMissing() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(vault), 0, STAKE_AMOUNT
            )
        );
        vm.prank(learner);
        vault.stake(STAKE_AMOUNT, 0);

        assertEq(vault.totalLocked(), 0);
        assertEq(vault.totalRewardLiability(), 0);
    }

    function test_RevertWhenPlanIsInvalid() public {
        vm.expectRevert(abi.encodeWithSelector(LRNTimeVault.LRNTimeVaultInvalidPlan.selector, 3));
        vm.prank(learner);
        vault.stake(STAKE_AMOUNT, 3);
    }

    function test_RevertWhenRewardReserveIsInsufficient() public {
        LRNTimeVault emptyVault = new LRNTimeVault(address(token), address(this));
        uint256 expectedReward = STAKE_AMOUNT / 100;

        vm.startPrank(learner);
        token.approve(address(emptyVault), STAKE_AMOUNT);
        vm.expectRevert(
            abi.encodeWithSelector(
                LRNTimeVault.LRNTimeVaultInsufficientRewardReserve.selector, 0, expectedReward
            )
        );
        emptyVault.stake(STAKE_AMOUNT, 0);
        vm.stopPrank();
    }

    function test_RevertWhenPositionIsStillLocked() public {
        _stakeAs(learner, STAKE_AMOUNT, 0);
        (,, uint256 unlockTime,) = vault.positions(learner);

        vm.expectRevert(
            abi.encodeWithSelector(
                LRNTimeVault.LRNTimeVaultPositionLocked.selector, unlockTime, block.timestamp
            )
        );
        vm.prank(learner);
        vault.withdrawPrincipal();
    }

    function test_WithdrawReturnsOnlyPrincipalAndUnlocksReward() public {
        uint8 planId = 2;
        uint256 expectedReward = STAKE_AMOUNT * 150 / 10_000;
        _stakeAs(learner, STAKE_AMOUNT, planId);
        (,, uint256 unlockTime,) = vault.positions(learner);
        vm.warp(unlockTime);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PrincipalWithdrawn(learner, STAKE_AMOUNT, expectedReward);
        vm.prank(learner);
        vault.withdrawPrincipal();

        (uint256 amount,,,) = vault.positions(learner);
        assertEq(amount, 0);
        assertEq(token.balanceOf(learner), USER_BALANCE);
        assertEq(vault.claimableRewards(learner), expectedReward);
        assertEq(vault.totalLocked(), 0);
        assertEq(vault.totalRewardLiability(), expectedReward);
    }

    function test_ClaimRewardIsSeparateFromPrincipalWithdrawal() public {
        uint256 expectedReward = STAKE_AMOUNT / 100;
        _stakeAs(learner, STAKE_AMOUNT, 0);
        (,, uint256 unlockTime,) = vault.positions(learner);
        vm.warp(unlockTime);

        vm.prank(learner);
        vault.withdrawPrincipal();
        assertEq(token.balanceOf(learner), USER_BALANCE);

        vm.expectEmit(true, false, false, true, address(vault));
        emit RewardClaimed(learner, expectedReward);
        vm.prank(learner);
        vault.claimReward();

        assertEq(token.balanceOf(learner), USER_BALANCE + expectedReward);
        assertEq(vault.claimableRewards(learner), 0);
        assertEq(vault.totalRewardLiability(), 0);
        assertEq(vault.rewardReserve(), REWARD_POOL - expectedReward);
    }

    function test_RevertWhenClaimingBeforePrincipalWithdrawal() public {
        _stakeAs(learner, STAKE_AMOUNT, 0);

        vm.expectRevert(
            abi.encodeWithSelector(LRNTimeVault.LRNTimeVaultNoClaimableReward.selector, learner)
        );
        vm.prank(learner);
        vault.claimReward();
    }

    function test_MultipleAccountsUseIndependentPlans() public {
        _stakeAs(learner, STAKE_AMOUNT, 0);
        _stakeAs(secondLearner, 100 ether, 2);

        assertEq(vault.totalLocked(), 350 ether);
        assertEq(vault.totalRewardLiability(), 4 ether);
        assertEq(vault.rewardReserve(), REWARD_POOL - 4 ether);
    }

    function test_DirectTokenTransferFundsRewardReserveNotPrincipal() public {
        uint256 reserveBefore = vault.rewardReserve();

        vm.prank(learner);
        token.transfer(address(vault), STAKE_AMOUNT);

        (uint256 amount,,,) = vault.positions(learner);
        assertEq(amount, 0);
        assertEq(vault.totalLocked(), 0);
        assertEq(vault.rewardReserve(), reserveBefore + STAKE_AMOUNT);
    }

    function test_RevertForZeroAmountActivePositionAndMissingPosition() public {
        vm.expectRevert(LRNTimeVault.LRNTimeVaultZeroAmount.selector);
        vm.prank(learner);
        vault.stake(0, 0);

        _stakeAs(learner, STAKE_AMOUNT, 0);
        vm.expectRevert(
            abi.encodeWithSelector(LRNTimeVault.LRNTimeVaultActivePosition.selector, learner)
        );
        vm.prank(learner);
        vault.stake(1 ether, 0);

        vm.expectRevert(
            abi.encodeWithSelector(LRNTimeVault.LRNTimeVaultNoPosition.selector, secondLearner)
        );
        vm.prank(secondLearner);
        vault.withdrawPrincipal();
    }

    function test_RevertWhenTokenAddressIsZero() public {
        vm.expectRevert(LRNTimeVault.LRNTimeVaultZeroToken.selector);
        new LRNTimeVault(address(0), address(this));
    }

    function test_OwnerCanRecoverOnlyUncommittedRewards() public {
        uint256 recoveryAmount = 1_000 ether;

        vm.expectEmit(true, false, false, true, address(vault));
        emit RewardReserveRecovered(address(this), recoveryAmount);
        vault.recoverRewardReserve(address(this), recoveryAmount);

        assertEq(vault.rewardReserve(), REWARD_POOL - recoveryAmount);
    }

    function test_RevertWhenRecoveryWouldUseCommittedRewards() public {
        _stakeAs(learner, STAKE_AMOUNT, 0);
        uint256 available = vault.rewardReserve();

        vm.expectRevert(
            abi.encodeWithSelector(
                LRNTimeVault.LRNTimeVaultRecoveryExceedsReserve.selector, available, available + 1
            )
        );
        vault.recoverRewardReserve(address(this), available + 1);
    }

    function test_RevertWhenNonOwnerRecoversRewards() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, learner)
        );
        vm.prank(learner);
        vault.recoverRewardReserve(learner, 1 ether);
    }

    function _stakeAs(address account, uint256 amount, uint8 planId) internal {
        vm.startPrank(account);
        token.approve(address(vault), amount);
        vault.stake(amount, planId);
        vm.stopPrank();
    }
}
