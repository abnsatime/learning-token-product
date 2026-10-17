// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { LRNToken } from "../src/LRNToken.sol";

contract DeployLRNToken is Script {
    function run() external returns (LRNToken token) {
        address initialHolder = vm.envAddress("TOKEN_INITIAL_HOLDER");

        vm.startBroadcast();
        token = new LRNToken(initialHolder);
        vm.stopBroadcast();
    }
}
