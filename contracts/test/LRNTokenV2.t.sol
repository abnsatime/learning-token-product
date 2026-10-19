// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { ERC20Capped } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import { LRNEmissionController } from "../src/LRNEmissionController.sol";
import { LRNTokenV2 } from "../src/LRNTokenV2.sol";

contract LRNTokenV2Test is Test {
    uint256 internal constant EPOCH_DURATION = 10 minutes;
    uint256 internal constant EMISSION_AMOUNT = 50_000 ether;

    LRNTokenV2 internal token;
    LRNEmissionController internal controller;
    address internal initialHolder = makeAddr("initialHolder");
    address internal treasury = makeAddr("treasury");
    address internal keeper = makeAddr("keeper");

    event EmissionReleased(
        address indexed caller,
        address indexed treasury,
        uint256 indexed epoch,
        uint256 amount,
        uint256 nextEmissionTime
    );

    function setUp() public {
        token = new LRNTokenV2(address(this), initialHolder);
        controller =
            new LRNEmissionController(address(token), treasury, EPOCH_DURATION, EMISSION_AMOUNT);
        token.grantRole(token.MINTER_ROLE(), address(controller));
    }

    function test_TokenMetadataSupplyCapAndRoles() public view {
        assertEq(token.name(), "Learning Token V2");
        assertEq(token.symbol(), "LRN2");
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.cap(), 2_000_000 ether);
        assertEq(token.balanceOf(initialHolder), 1_000_000 ether);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), address(this)));
        assertTrue(token.hasRole(token.MINTER_ROLE(), address(controller)));
    }

    function test_ControllerConfigurationIsImmutable() public view {
        assertEq(address(controller.token()), address(token));
        assertEq(controller.treasury(), treasury);
        assertEq(controller.epochDuration(), EPOCH_DURATION);
        assertEq(controller.emissionAmount(), EMISSION_AMOUNT);
    }

    function test_RevertWhenUnauthorizedAccountMints() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                keeper,
                token.MINTER_ROLE()
            )
        );
        vm.prank(keeper);
        token.mint(keeper, 1 ether);
    }

    function test_RevertWhenReleaseIsEarly() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                LRNEmissionController.LRNEmissionNotReady.selector,
                controller.nextEmissionTime(),
                block.timestamp
            )
        );
        vm.prank(keeper);
        controller.release();
    }

    function test_AnyAccountCanReleaseMaturedEpoch() public {
        uint256 releaseTime = controller.nextEmissionTime();
        vm.warp(releaseTime);

        vm.expectEmit(true, true, true, true, address(controller));
        emit EmissionReleased(keeper, treasury, 1, EMISSION_AMOUNT, releaseTime + EPOCH_DURATION);
        vm.prank(keeper);
        uint256 released = controller.release();

        assertEq(released, EMISSION_AMOUNT);
        assertEq(token.balanceOf(treasury), EMISSION_AMOUNT);
        assertEq(token.totalSupply(), 1_050_000 ether);
        assertEq(controller.epochsReleased(), 1);
        assertEq(controller.totalReleased(), EMISSION_AMOUNT);
    }

    function test_MissedEpochsAreReleasedOnePerCall() public {
        uint256 firstRelease = controller.nextEmissionTime();
        vm.warp(firstRelease + EPOCH_DURATION);

        controller.release();
        controller.release();

        assertEq(controller.epochsReleased(), 2);
        assertEq(controller.totalReleased(), 100_000 ether);
        assertEq(token.balanceOf(treasury), 100_000 ether);
        assertEq(controller.nextEmissionTime(), firstRelease + 2 * EPOCH_DURATION);

        vm.expectRevert(
            abi.encodeWithSelector(
                LRNEmissionController.LRNEmissionNotReady.selector,
                firstRelease + 2 * EPOCH_DURATION,
                block.timestamp
            )
        );
        controller.release();
    }

    function test_EmissionStopsAtSupplyCap() public {
        for (uint256 epoch = 0; epoch < 20; epoch++) {
            vm.warp(controller.nextEmissionTime());
            controller.release();
        }

        assertEq(token.totalSupply(), token.cap());
        assertEq(token.balanceOf(treasury), 1_000_000 ether);

        vm.warp(controller.nextEmissionTime());
        vm.expectRevert(LRNEmissionController.LRNEmissionSupplyExhausted.selector);
        controller.release();
    }

    function test_TokenCapRejectsMintBeyondMaximum() public {
        token.grantRole(token.MINTER_ROLE(), address(this));

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20Capped.ERC20ExceededCap.selector, token.cap() + 1, token.cap()
            )
        );
        token.mint(treasury, 1_000_000 ether + 1);
    }

    function test_RevertWhenConstructorConfigurationIsInvalid() public {
        vm.expectRevert(LRNTokenV2.LRNTokenV2ZeroAdmin.selector);
        new LRNTokenV2(address(0), initialHolder);

        vm.expectRevert(LRNTokenV2.LRNTokenV2ZeroInitialHolder.selector);
        new LRNTokenV2(address(this), address(0));

        vm.expectRevert(LRNEmissionController.LRNEmissionZeroToken.selector);
        new LRNEmissionController(address(0), treasury, EPOCH_DURATION, EMISSION_AMOUNT);

        vm.expectRevert(LRNEmissionController.LRNEmissionZeroTreasury.selector);
        new LRNEmissionController(address(token), address(0), EPOCH_DURATION, EMISSION_AMOUNT);

        vm.expectRevert(LRNEmissionController.LRNEmissionZeroDuration.selector);
        new LRNEmissionController(address(token), treasury, 0, EMISSION_AMOUNT);

        vm.expectRevert(LRNEmissionController.LRNEmissionZeroAmount.selector);
        new LRNEmissionController(address(token), treasury, EPOCH_DURATION, 0);
    }
}
