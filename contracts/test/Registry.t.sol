// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../src/Registry.sol";

/**
 * @notice Registry unit + fuzz tests (Phase 4, T4.1).
 *         Skeleton: smoke tests only. Full tests added in Phase 4.
 */
contract RegistryTest is Test {
    Registry registry;
    address owner = address(0xBEEF);
    address attester1 = address(0xA1);
    address notOwner = address(0xDEAD);

    function setUp() public {
        vm.prank(owner);
        registry = new Registry(owner);
    }

    // ── Smoke ─────────────────────────────────────────────────────────────────
    function test_ownerSet() public view {
        assertEq(registry.owner(), owner);
    }

    function test_deployerNotAttester() public view {
        assertFalse(registry.attesters(owner));
    }

    function test_constructorRevertZeroAddress() public {
        vm.expectRevert(Registry.ZeroAddress.selector);
        new Registry(address(0));
    }

    // ── Ownership transfer ───────────────────────────────────────────────────
    function test_transferOwnership() public {
        address newOwner = address(0xCAFE);
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Registry.OwnershipTransferred(owner, newOwner);
        registry.transferOwnership(newOwner);

        assertEq(registry.owner(), newOwner);

        // New owner can add attester
        vm.prank(newOwner);
        registry.addAttester(attester1);
        assertTrue(registry.isAttester(attester1));

        // Old owner cannot
        vm.prank(owner);
        vm.expectRevert(Registry.NotOwner.selector);
        registry.removeAttester(attester1);
    }

    function test_transferOwnership_revertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }

    function test_transferOwnership_revertNotOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(Registry.NotOwner.selector);
        registry.transferOwnership(address(0xCAFE));
    }

    // ── Canary issuer ─────────────────────────────────────────────────────────
    function test_setCanaryIssuer() public {
        address canary = address(0xCACA);
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit Registry.CanaryIssuerSet(canary);
        registry.setCanaryIssuer(canary);
        assertEq(registry.canaryIssuer(), canary);
    }

    function test_setCanaryIssuer_revertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.setCanaryIssuer(address(0));
    }

    function test_setCanaryIssuer_revertNotOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(Registry.NotOwner.selector);
        registry.setCanaryIssuer(address(0xCACA));
    }

    // ── Model registration ────────────────────────────────────────────────────
    function test_registerModel_revertZeroHash() public {
        vm.prank(owner);
        vm.expectRevert(Registry.InvalidModelHash.selector);
        registry.registerModel(bytes32(0), bytes32(0), "uri", bytes32(0));
    }

    function test_getModel() public {
        bytes32 mHash = keccak256("model-get");
        bytes32 pHash = keccak256("preproc-get");
        vm.prank(owner);
        registry.registerModel(mHash, pHash, "ipfs://model", bytes32("0.1.0"));

        Registry.ModelInfo memory m = registry.getModel(mHash);
        assertEq(m.preprocHash, pHash);
        assertEq(m.uri, "ipfs://model");
        assertEq(m.specVersion, bytes32("0.1.0"));
        assertEq(m.status, 0);
        assertTrue(m.registered);
    }

    function test_getModel_revertNotRegistered() public {
        vm.expectRevert(Registry.NotRegistered.selector);
        registry.getModel(keccak256("non-existent"));
    }

    function test_addAttester_revertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.addAttester(address(0));
    }

    function test_removeAttester_revertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.removeAttester(address(0));
    }

    // ── Model registration ────────────────────────────────────────────────────
    function test_registerModel() public {
        bytes32 mHash = keccak256("model-v1");
        bytes32 pHash = keccak256("preproc-v1");

        vm.prank(owner);
        registry.registerModel(mHash, pHash, "ipfs://example", bytes32("0.1.0"));

        assertTrue(registry.isModelActive(mHash));
        (bytes32 storedPHash,,,uint8 status, bool registered) = registry.models(mHash);
        assertEq(storedPHash, pHash);
        assertEq(status, 0); // ACTIVE
        assertTrue(registered);
    }

    function test_registerModel_revertNotOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(Registry.NotOwner.selector);
        registry.registerModel(keccak256("x"), keccak256("y"), "uri", bytes32(0));
    }

    function test_registerModel_revertDuplicate() public {
        bytes32 mHash = keccak256("model-dup");
        vm.startPrank(owner);
        registry.registerModel(mHash, bytes32(0), "uri", bytes32(0));
        vm.expectRevert(Registry.AlreadyRegistered.selector);
        registry.registerModel(mHash, bytes32(0), "uri", bytes32(0));
        vm.stopPrank();
    }

    function test_setModelStatus() public {
        bytes32 mHash = keccak256("model-status");
        vm.startPrank(owner);
        registry.registerModel(mHash, bytes32(0), "uri", bytes32(0));
        registry.setModelStatus(mHash, 2); // DEGRADED
        vm.stopPrank();
        assertFalse(registry.isModelActive(mHash));
        (,,,uint8 status,) = registry.models(mHash);
        assertEq(status, 2);
    }

    function test_setModelStatus_revertInvalidStatus() public {
        bytes32 mHash = keccak256("model-bad-status");
        vm.startPrank(owner);
        registry.registerModel(mHash, bytes32(0), "uri", bytes32(0));
        vm.expectRevert(Registry.InvalidStatus.selector);
        registry.setModelStatus(mHash, 3);
        vm.stopPrank();
    }

    // ── Attester allowlist ────────────────────────────────────────────────────
    function test_addRemoveAttester() public {
        vm.startPrank(owner);
        registry.addAttester(attester1);
        assertTrue(registry.attesters(attester1));
        registry.removeAttester(attester1);
        assertFalse(registry.attesters(attester1));
        vm.stopPrank();
    }

    function test_addAttester_revertNotOwner() public {
        vm.prank(notOwner);
        vm.expectRevert(Registry.NotOwner.selector);
        registry.addAttester(attester1);
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────
    /// @dev Any status <= 2 is valid; > 2 reverts.
    function testFuzz_setModelStatus_onlyValidStatuses(uint8 status) public {
        bytes32 mHash = keccak256(abi.encode(status, "fuzz"));
        vm.startPrank(owner);
        registry.registerModel(mHash, bytes32(0), "uri", bytes32(0));
        if (status <= 2) {
            registry.setModelStatus(mHash, status);
            (,,,uint8 stored,) = registry.models(mHash);
            assertEq(stored, status);
        } else {
            vm.expectRevert(Registry.InvalidStatus.selector);
            registry.setModelStatus(mHash, status);
        }
        vm.stopPrank();
    }

    /// @dev Non-owner can never add an attester.
    function testFuzz_addAttester_onlyOwner(address caller, address att) public {
        vm.assume(caller != owner);
        vm.prank(caller);
        vm.expectRevert(Registry.NotOwner.selector);
        registry.addAttester(att);
    }
}
