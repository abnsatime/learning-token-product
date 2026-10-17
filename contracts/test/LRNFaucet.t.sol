// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { LRNFaucet } from "../src/LRNFaucet.sol";
import { LRNToken } from "../src/LRNToken.sol";

contract LRNFaucetTest is Test {
    uint256 internal constant CLAIM_AMOUNT = 100 ether;
    uint256 internal constant FAUCET_INVENTORY = 1_000 ether;

    LRNToken internal token;
    LRNFaucet internal faucet;
    address internal learner = makeAddr("learner");

    event Claimed(address indexed account, uint256 amount);

    function setUp() public {
        token = new LRNToken(address(this));
        faucet = new LRNFaucet(address(token), CLAIM_AMOUNT);
        token.transfer(address(faucet), FAUCET_INVENTORY);
    }

    function test_ConfigurationIsImmutable() public view {
        assertEq(address(faucet.token()), address(token));
        assertEq(faucet.claimAmount(), CLAIM_AMOUNT);
    }

    function test_ClaimTransfersTokensAndRecordsEligibility() public {
        vm.expectEmit(true, false, false, true, address(faucet));
        emit Claimed(learner, CLAIM_AMOUNT);

        vm.prank(learner);
        faucet.claim();

        assertEq(token.balanceOf(learner), CLAIM_AMOUNT);
        assertEq(token.balanceOf(address(faucet)), FAUCET_INVENTORY - CLAIM_AMOUNT);
        assertTrue(faucet.hasClaimed(learner));
    }

    function test_RevertWhenAddressClaimsTwice() public {
        vm.prank(learner);
        faucet.claim();

        vm.expectRevert(abi.encodeWithSelector(LRNFaucet.LRNFaucetAlreadyClaimed.selector, learner));
        vm.prank(learner);
        faucet.claim();
    }

    function test_RevertWhenFaucetInventoryIsInsufficient() public {
        LRNFaucet emptyFaucet = new LRNFaucet(address(token), CLAIM_AMOUNT);

        vm.expectRevert(
            abi.encodeWithSelector(LRNFaucet.LRNFaucetInsufficientBalance.selector, 0, CLAIM_AMOUNT)
        );
        vm.prank(learner);
        emptyFaucet.claim();

        assertFalse(emptyFaucet.hasClaimed(learner));
    }

    function test_RevertWhenTokenAddressIsZero() public {
        vm.expectRevert(LRNFaucet.LRNFaucetZeroToken.selector);
        new LRNFaucet(address(0), CLAIM_AMOUNT);
    }

    function test_RevertWhenClaimAmountIsZero() public {
        vm.expectRevert(LRNFaucet.LRNFaucetZeroClaimAmount.selector);
        new LRNFaucet(address(token), 0);
    }
}
