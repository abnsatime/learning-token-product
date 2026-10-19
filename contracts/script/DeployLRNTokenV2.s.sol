// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { LRNEmissionController } from "../src/LRNEmissionController.sol";
import { LRNTokenV2 } from "../src/LRNTokenV2.sol";

contract DeployLRNTokenV2 is Script {
    uint256 internal constant EMISSION_RATE_BPS = 500;

    function run() external returns (LRNTokenV2 token, LRNEmissionController controller) {
        address admin = vm.envAddress("V2_ADMIN");
        address initialHolder = vm.envAddress("V2_INITIAL_HOLDER");
        address treasury = vm.envAddress("V2_TREASURY");
        uint256 epochDuration = vm.envUint("V2_EPOCH_DURATION");

        vm.startBroadcast();
        token = new LRNTokenV2(admin, initialHolder);
        uint256 emissionAmount = token.INITIAL_SUPPLY() * EMISSION_RATE_BPS / 10_000;
        controller =
            new LRNEmissionController(address(token), treasury, epochDuration, emissionAmount);
        token.grantRole(token.MINTER_ROLE(), address(controller));
        vm.stopBroadcast();
    }
}
