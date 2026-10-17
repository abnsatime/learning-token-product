// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { LRNTimeVault } from "../src/LRNTimeVault.sol";

contract DeployLRNTimeVault is Script {
    function run() external returns (LRNTimeVault vault) {
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        uint256 lockDuration = vm.envUint("VAULT_LOCK_DURATION");

        vm.startBroadcast();
        vault = new LRNTimeVault(tokenAddress, lockDuration);
        vm.stopBroadcast();
    }
}
