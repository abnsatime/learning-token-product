// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { LRNFaucet } from "../src/LRNFaucet.sol";

contract DeployLRNFaucet is Script {
    function run() external returns (LRNFaucet faucet) {
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        uint256 amountPerClaim = vm.envUint("FAUCET_CLAIM_AMOUNT");

        vm.startBroadcast();
        faucet = new LRNFaucet(tokenAddress, amountPerClaim);
        vm.stopBroadcast();
    }
}
