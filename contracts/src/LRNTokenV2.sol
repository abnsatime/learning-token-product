// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Capped } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

/// @title Learning Token V2
/// @notice A capped ERC-20 whose supply can be expanded only by accounts with MINTER_ROLE.
contract LRNTokenV2 is ERC20, ERC20Capped, AccessControl {
    error LRNTokenV2ZeroAdmin();
    error LRNTokenV2ZeroInitialHolder();

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant MAX_SUPPLY = 2_000_000 ether;

    constructor(address admin, address initialHolder)
        ERC20("Learning Token V2", "LRN2")
        ERC20Capped(MAX_SUPPLY)
    {
        if (admin == address(0)) revert LRNTokenV2ZeroAdmin();
        if (initialHolder == address(0)) revert LRNTokenV2ZeroInitialHolder();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _mint(initialHolder, INITIAL_SUPPLY);
    }

    function mint(address recipient, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(recipient, amount);
    }

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, amount);
    }
}
