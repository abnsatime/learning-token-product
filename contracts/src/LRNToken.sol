// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title LRN Token
/// @notice A fixed-supply ERC-20 used by the LRN Portal reference application.
/// @dev All token accounting and ERC-20 behavior are inherited from OpenZeppelin.
contract LRNToken is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    constructor(address initialHolder) ERC20("Learning Token", "LRN") {
        _mint(initialHolder, INITIAL_SUPPLY);
    }
}
