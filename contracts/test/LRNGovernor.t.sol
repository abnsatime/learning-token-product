// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { LRNGovernor } from "../src/LRNGovernor.sol";
import { LRNEmissionController } from "../src/LRNEmissionController.sol";
import { LRNTokenV2 } from "../src/LRNTokenV2.sol";

contract LRNGovernorTest is Test {
    uint256 internal constant TIMELOCK_DELAY = 5 minutes;
    uint256 internal constant EPOCH_DURATION = 10 minutes;
    uint256 internal constant EMISSION_AMOUNT = 50_000 ether;

    LRNTokenV2 internal token;
    LRNEmissionController internal controller;
    TimelockController internal timelock;
    LRNGovernor internal governor;

    address internal holder = makeAddr("holder");
    address internal treasury = makeAddr("treasury");
    address internal outsider = makeAddr("outsider");

    function setUp() public {
        token = new LRNTokenV2(address(this), holder);
        controller =
            new LRNEmissionController(address(token), treasury, EPOCH_DURATION, EMISSION_AMOUNT);

        address[] memory noProposers = new address[](0);
        address[] memory openExecutors = new address[](1);
        openExecutors[0] = address(0);
        timelock = new TimelockController(TIMELOCK_DELAY, noProposers, openExecutors, address(this));
        governor = new LRNGovernor(token, timelock);

        token.grantRole(token.MINTER_ROLE(), address(controller));
        token.grantRole(token.DEFAULT_ADMIN_ROLE(), address(timelock));
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));

        token.renounceRole(token.DEFAULT_ADMIN_ROLE(), address(this));
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), address(this));

        vm.prank(holder);
        token.delegate(holder);
        vm.roll(block.number + 1);
    }

    function test_GovernanceConfigurationAndDelegatedVotes() public view {
        assertEq(governor.name(), "LRN V2 Governor");
        assertEq(governor.votingDelay(), 1);
        assertEq(governor.votingPeriod(), 20);
        assertEq(governor.proposalThreshold(), 1_000 ether);
        assertEq(governor.quorumDenominator(), 100);
        assertEq(governor.quorumNumerator(), 4);
        assertEq(token.getVotes(holder), 1_000_000 ether);
        assertEq(token.getVotes(outsider), 0);
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), address(governor)));
        assertTrue(timelock.hasRole(timelock.CANCELLER_ROLE(), address(governor)));
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(0)));
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), address(timelock)));
        assertFalse(token.hasRole(token.DEFAULT_ADMIN_ROLE(), address(this)));
    }

    function test_GovernanceCanRevokeControllerMinterRoleAfterTimelock() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        targets[0] = address(token);
        calldatas[0] = abi.encodeCall(token.revokeRole, (token.MINTER_ROLE(), address(controller)));
        string memory description = "Stop LRN2 emissions";
        bytes32 descriptionHash = keccak256(bytes(description));

        vm.prank(holder);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Pending));

        vm.roll(governor.proposalSnapshot(proposalId) + 1);
        vm.prank(holder);
        governor.castVote(proposalId, 1);

        vm.roll(governor.proposalDeadline(proposalId) + 1);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Succeeded));

        governor.queue(targets, values, calldatas, descriptionHash);
        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Queued));

        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);
        governor.execute(targets, values, calldatas, descriptionHash);

        assertEq(uint256(governor.state(proposalId)), uint256(IGovernor.ProposalState.Executed));
        assertFalse(token.hasRole(token.MINTER_ROLE(), address(controller)));
    }

    function test_NonDelegatedBalanceHasNoVotingPower() public {
        vm.prank(holder);
        token.transfer(outsider, 10_000 ether);

        assertEq(token.balanceOf(outsider), 10_000 ether);
        assertEq(token.getVotes(outsider), 0);

        vm.prank(outsider);
        token.delegate(outsider);
        assertEq(token.getVotes(outsider), 10_000 ether);
    }
}
