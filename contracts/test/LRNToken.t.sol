// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { LRNToken } from "../src/LRNToken.sol";

contract LRNTokenTest is Test {
    LRNToken internal token;
    address internal holder = makeAddr("holder");
    address internal recipient = makeAddr("recipient");

    function setUp() public {
        token = new LRNToken(holder);
    }

    function test_MetadataAndSupplyAreConfigured() public view {
        assertEq(token.name(), "Learning Token");
        assertEq(token.symbol(), "LRN");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000 ether);
    }

    function test_InitialSupplyBelongsToConfiguredHolder() public view {
        assertEq(token.balanceOf(holder), token.INITIAL_SUPPLY());
        assertEq(token.balanceOf(address(this)), 0);
    }

    function test_HolderCanTransfer() public {
        uint256 amount = 25 ether;

        vm.prank(holder);
        token.transfer(recipient, amount);

        assertEq(token.balanceOf(recipient), amount);
        assertEq(token.balanceOf(holder), token.INITIAL_SUPPLY() - amount);
    }

    function testFuzz_TransferPreservesTotalSupply(address receiver, uint256 amount) public {
        vm.assume(receiver != address(0));
        vm.assume(receiver != holder);
        amount = bound(amount, 0, token.INITIAL_SUPPLY());

        vm.prank(holder);
        token.transfer(receiver, amount);

        assertEq(token.balanceOf(receiver), amount);
        assertEq(token.balanceOf(holder), token.INITIAL_SUPPLY() - amount);
        assertEq(token.totalSupply(), token.INITIAL_SUPPLY());
    }
}
