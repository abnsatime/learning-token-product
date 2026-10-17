// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { LRNTimeVault } from "../src/LRNTimeVault.sol";
import { LRNToken } from "../src/LRNToken.sol";

contract LRNTimeVaultTest is Test {
    uint256 internal constant LOCK_DURATION = 7 days;
    uint256 internal constant USER_BALANCE = 1_000 ether;
    uint256 internal constant STAKE_AMOUNT = 250 ether;

    LRNToken internal token;
    LRNTimeVault internal vault;
    address internal learner = makeAddr("learner");
    address internal secondLearner = makeAddr("secondLearner");

    event Staked(address indexed account, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed account, uint256 amount);

    function setUp() public {
        token = new LRNToken(address(this));
        vault = new LRNTimeVault(address(token), LOCK_DURATION);
        token.transfer(learner, USER_BALANCE);
        token.transfer(secondLearner, USER_BALANCE);
    }

    function test_ConfigurationIsImmutable() public view {
        assertEq(address(vault.token()), address(token));
        assertEq(vault.lockDuration(), LOCK_DURATION);
    }

    function test_StakeUsesAllowanceAndRecordsPosition() public {
        uint256 expectedUnlockTime = block.timestamp + LOCK_DURATION;

        vm.startPrank(learner);
        token.approve(address(vault), STAKE_AMOUNT);

        vm.expectEmit(true, false, false, true, address(vault));
        emit Staked(learner, STAKE_AMOUNT, expectedUnlockTime);
        vault.stake(STAKE_AMOUNT);
        vm.stopPrank();

        (uint256 amount, uint256 unlockTime) = vault.positions(learner);
        assertEq(amount, STAKE_AMOUNT);
        assertEq(unlockTime, expectedUnlockTime);
        assertEq(vault.totalLocked(), STAKE_AMOUNT);
        assertEq(token.balanceOf(address(vault)), STAKE_AMOUNT);
        assertEq(token.allowance(learner, address(vault)), 0);
    }

    function test_RevertWhenAllowanceIsMissing() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(vault), 0, STAKE_AMOUNT
            )
        );
        vm.prank(learner);
        vault.stake(STAKE_AMOUNT);

        (uint256 amount,) = vault.positions(learner);
        assertEq(amount, 0);
        assertEq(vault.totalLocked(), 0);
    }

    function test_RevertWhenStakeAmountIsZero() public {
        vm.expectRevert(LRNTimeVault.LRNTimeVaultZeroAmount.selector);
        vm.prank(learner);
        vault.stake(0);
    }

    function test_RevertWhenAccountAlreadyHasPosition() public {
        _stakeAs(learner, STAKE_AMOUNT);

        vm.expectRevert(
            abi.encodeWithSelector(LRNTimeVault.LRNTimeVaultActivePosition.selector, learner)
        );
        vm.prank(learner);
        vault.stake(1 ether);
    }

    function test_RevertWhenPositionIsStillLocked() public {
        _stakeAs(learner, STAKE_AMOUNT);
        (, uint256 unlockTime) = vault.positions(learner);

        vm.expectRevert(
            abi.encodeWithSelector(
                LRNTimeVault.LRNTimeVaultPositionLocked.selector, unlockTime, block.timestamp
            )
        );
        vm.prank(learner);
        vault.withdraw();
    }

    function test_WithdrawAfterUnlockReturnsPrincipal() public {
        _stakeAs(learner, STAKE_AMOUNT);
        (, uint256 unlockTime) = vault.positions(learner);
        vm.warp(unlockTime);

        vm.expectEmit(true, false, false, true, address(vault));
        emit Withdrawn(learner, STAKE_AMOUNT);
        vm.prank(learner);
        vault.withdraw();

        (uint256 amount, uint256 storedUnlockTime) = vault.positions(learner);
        assertEq(amount, 0);
        assertEq(storedUnlockTime, 0);
        assertEq(vault.totalLocked(), 0);
        assertEq(token.balanceOf(learner), USER_BALANCE);
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function test_TotalLockedTracksMultipleAccounts() public {
        _stakeAs(learner, STAKE_AMOUNT);
        _stakeAs(secondLearner, 100 ether);

        assertEq(vault.totalLocked(), 350 ether);
        assertEq(token.balanceOf(address(vault)), 350 ether);
    }

    function test_DirectTokenTransferDoesNotCreatePosition() public {
        vm.prank(learner);
        token.transfer(address(vault), STAKE_AMOUNT);

        (uint256 amount,) = vault.positions(learner);
        assertEq(amount, 0);
        assertEq(vault.totalLocked(), 0);
        assertEq(token.balanceOf(address(vault)), STAKE_AMOUNT);
    }

    function test_RevertWhenWithdrawingWithoutPosition() public {
        vm.expectRevert(
            abi.encodeWithSelector(LRNTimeVault.LRNTimeVaultNoPosition.selector, learner)
        );
        vm.prank(learner);
        vault.withdraw();
    }

    function test_RevertWhenConstructorConfigurationIsZero() public {
        vm.expectRevert(LRNTimeVault.LRNTimeVaultZeroToken.selector);
        new LRNTimeVault(address(0), LOCK_DURATION);

        vm.expectRevert(LRNTimeVault.LRNTimeVaultZeroDuration.selector);
        new LRNTimeVault(address(token), 0);
    }

    function _stakeAs(address account, uint256 amount) internal {
        vm.startPrank(account);
        token.approve(address(vault), amount);
        vault.stake(amount);
        vm.stopPrank();
    }
}
