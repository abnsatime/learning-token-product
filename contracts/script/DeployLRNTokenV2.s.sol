// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { LRNGovernor } from "../src/LRNGovernor.sol";
import { LRNEmissionController } from "../src/LRNEmissionController.sol";
import { LRNTokenV2 } from "../src/LRNTokenV2.sol";

contract DeployLRNTokenV2 is Script {
    uint256 internal constant EMISSION_RATE_BPS = 500;

    function run()
        external
        returns (
            LRNTokenV2 token,
            LRNEmissionController controller,
            TimelockController timelock,
            LRNGovernor governor
        )
    {
        address admin = vm.envAddress("V2_ADMIN");
        address initialHolder = vm.envAddress("V2_INITIAL_HOLDER");
        address treasury = vm.envAddress("V2_TREASURY");
        uint256 epochDuration = vm.envUint("V2_EPOCH_DURATION");
        uint256 timelockDelay = vm.envUint("V2_TIMELOCK_DELAY");

        address[] memory noProposers = new address[](0);
        address[] memory openExecutors = new address[](1);
        openExecutors[0] = address(0);

        vm.startBroadcast();
        token = new LRNTokenV2(admin, initialHolder);
        uint256 emissionAmount = token.INITIAL_SUPPLY() * EMISSION_RATE_BPS / 10_000;
        controller =
            new LRNEmissionController(address(token), treasury, epochDuration, emissionAmount);
        timelock = new TimelockController(timelockDelay, noProposers, openExecutors, admin);
        governor = new LRNGovernor(token, timelock);

        token.grantRole(token.MINTER_ROLE(), address(controller));
        token.grantRole(token.DEFAULT_ADMIN_ROLE(), address(timelock));

        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));

        token.renounceRole(token.DEFAULT_ADMIN_ROLE(), admin);
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), admin);
        vm.stopBroadcast();
    }
}
