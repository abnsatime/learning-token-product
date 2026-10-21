// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Capped } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title Learning Token V2
/// @notice A capped ERC-20 whose supply can be expanded only by accounts with MINTER_ROLE.
contract LRNTokenV2 is ERC20, ERC20Capped, ERC20Permit, ERC20Votes, AccessControl {
    error LRNTokenV2ZeroAdmin();
    error LRNTokenV2ZeroInitialHolder();

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant MAX_SUPPLY = 2_000_000 ether;

    constructor(address admin, address initialHolder)
        ERC20("Learning Token V2", "LRN2")
        ERC20Capped(MAX_SUPPLY)
        ERC20Permit("Learning Token V2")
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
        override(ERC20, ERC20Capped, ERC20Votes)
    {
        super._update(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
