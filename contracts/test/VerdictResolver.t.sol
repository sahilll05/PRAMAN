// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {VerdictResolver} from "../src/VerdictResolver.sol";
import {SchemaResolver} from "../src/resolver/SchemaResolver.sol";
import {Registry} from "../src/Registry.sol";
import {Attestation} from "../src/interfaces/IEAS.sol";
import {MockEAS} from "./mocks/MockEAS.sol";

contract VerdictResolverTest is Test {
    MockEAS eas;
    Registry registry;
    VerdictResolver resolver;

    address owner = address(0xBEEF);
    address attester1 = address(0xA1);
    address attester2 = address(0xA2);
    address challenger = address(0xC1);
    address canaryIssuer = address(0xCA);
    address unallowlisted = address(0xBAD);

    bytes32 modelHashActive = keccak256("model-active");
    bytes32 preprocHash1 = keccak256("preproc-v1");
    bytes32 modelHashV2 = keccak256("model-v2");
    bytes32 preprocHash2 = keccak256("preproc-v2");

    bytes32 verdictSchemaUID = keccak256("verdict-schema-uid");
    bytes32 challengeSchemaUID = keccak256("challenge-schema-uid");
    bytes32 canarySchemaUID = keccak256("canary-schema-uid");

    function setUp() public {
        vm.warp(1_700_000_000); // Set fixed timestamp

        eas = new MockEAS();

        vm.startPrank(owner);
        registry = new Registry(owner);
        registry.addAttester(attester1);
        registry.addAttester(attester2);
        registry.addAttester(challenger);
        registry.setCanaryIssuer(canaryIssuer);

        registry.registerModel(modelHashActive, preprocHash1, "ipfs://model1", bytes32("0.1.0"));
        registry.registerModel(modelHashV2, preprocHash2, "ipfs://model2", bytes32("0.1.0"));

        resolver = new VerdictResolver(
            eas,
            registry,
            owner,
            10,       // 10 challenges per window
            1 hours   // 1 hour window
        );

        resolver.setSchemas(verdictSchemaUID, challengeSchemaUID, canarySchemaUID);
        vm.stopPrank();
    }

    // ── Helper builders ───────────────────────────────────────────────────────
    function _encodeVerdictData(
        bytes32 sha256Hash,
        uint64 pHash,
        uint64 wmId,
        bytes32 modelHash,
        bytes32 preprocHash,
        uint16 pFakeBps,
        uint8 verdict,
        bytes32 evidenceHash
    ) internal pure returns (bytes memory) {
        return abi.encode(
            sha256Hash,
            pHash,
            wmId,
            modelHash,
            preprocHash,
            pFakeBps,
            verdict,
            evidenceHash
        );
    }

    function _createVerdictAttestation(
        address attester,
        bytes32 sha256Hash,
        uint16 pFakeBps,
        uint8 verdict,
        uint64 expirationTime,
        bytes32 refUID
    ) internal view returns (Attestation memory) {
        bytes memory data = _encodeVerdictData(
            sha256Hash,
            1234567890,
            987654321,
            modelHashActive,
            preprocHash1,
            pFakeBps,
            verdict,
            keccak256("evidence-json")
        );

        return Attestation({
            uid: bytes32(0),
            schema: verdictSchemaUID,
            time: uint64(block.timestamp),
            expirationTime: expirationTime,
            revocationTime: 0,
            refUID: refUID,
            recipient: address(0),
            attester: attester,
            revocable: true,
            data: data
        });
    }

    // ── Verdict Tests ─────────────────────────────────────────────────────────
    function test_verdictAttest_success() public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            1500, // 15.00% pFake
            1,    // LIKELY_AUTHENTIC
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        (bytes32 uid, bool ok) = eas.attestThroughResolver(resolver, att);
        assertTrue(ok);
        assertTrue(uid != bytes32(0));
    }

    function test_verdictAttest_revertNotAllowlisted() public {
        Attestation memory att = _createVerdictAttestation(
            unallowlisted,
            keccak256("media-1"),
            1500,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        vm.expectRevert(VerdictResolver.NotAllowlistedAttester.selector);
        eas.attestThroughResolver(resolver, att);
    }

    function test_verdictAttest_revertZeroSha256() public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            bytes32(0),
            1500,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        vm.expectRevert(VerdictResolver.InvalidSha256.selector);
        eas.attestThroughResolver(resolver, att);
    }

    function test_verdictAttest_revertInvalidVerdictClass() public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            1500,
            3, // Invalid class (> 2)
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        vm.expectRevert(VerdictResolver.InvalidVerdictClass.selector);
        eas.attestThroughResolver(resolver, att);
    }

    function test_verdictAttest_revertInvalidPFakeBps() public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            10001, // > 10000 bps
            2,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        vm.expectRevert(VerdictResolver.InvalidPFakeBps.selector);
        eas.attestThroughResolver(resolver, att);
    }

    function test_verdictAttest_revertModelNotActive() public {
        bytes32 inactiveModel = keccak256("inactive-model");
        vm.prank(owner);
        registry.registerModel(inactiveModel, bytes32(0), "uri", bytes32("0.1.0"));
        vm.prank(owner);
        registry.setModelStatus(inactiveModel, 1); // DEPRECATED

        bytes memory data = _encodeVerdictData(
            keccak256("media-1"),
            123,
            456,
            inactiveModel,
            bytes32(0),
            5000,
            0,
            keccak256("ev")
        );

        Attestation memory att = Attestation({
            uid: bytes32(0),
            schema: verdictSchemaUID,
            time: uint64(block.timestamp),
            expirationTime: uint64(block.timestamp + 180 days),
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(0),
            attester: attester1,
            revocable: true,
            data: data
        });

        vm.expectRevert(VerdictResolver.ModelNotActive.selector);
        eas.attestThroughResolver(resolver, att);
    }

    function test_verdictAttest_revertExpired() public {
        // Expiration in the past
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            1500,
            1,
            uint64(block.timestamp - 1),
            bytes32(0)
        );

        vm.expectRevert(VerdictResolver.InvalidExpiration.selector);
        eas.attestThroughResolver(resolver, att);

        // Expiration > MAX_TTL
        att.expirationTime = uint64(block.timestamp + 366 days);
        vm.expectRevert(VerdictResolver.InvalidExpiration.selector);
        eas.attestThroughResolver(resolver, att);
    }

    // ── Supersession Tests ────────────────────────────────────────────────────
    function test_verdictSupersession_sameAttester_success() public {
        Attestation memory original = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            1500,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );
        (bytes32 targetUID, ) = eas.attestThroughResolver(resolver, original);

        // Same attester issues superseding verdict
        Attestation memory updated = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            9200,
            2,
            uint64(block.timestamp + 180 days),
            targetUID
        );

        (bytes32 newUID, bool ok) = eas.attestThroughResolver(resolver, updated);
        assertTrue(ok);
        assertTrue(newUID != targetUID);
    }

    function test_verdictSupersession_differentAttester_newerModel_success() public {
        Attestation memory original = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            1500,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );
        (bytes32 targetUID, ) = eas.attestThroughResolver(resolver, original);

        // Attester2 supersedes with newer modelV2
        bytes memory dataV2 = _encodeVerdictData(
            keccak256("media-1"),
            123,
            456,
            modelHashV2,
            preprocHash2,
            9500,
            2,
            keccak256("evidence-v2")
        );

        Attestation memory superseding = Attestation({
            uid: bytes32(0),
            schema: verdictSchemaUID,
            time: uint64(block.timestamp),
            expirationTime: uint64(block.timestamp + 180 days),
            revocationTime: 0,
            refUID: targetUID,
            recipient: address(0),
            attester: attester2,
            revocable: true,
            data: dataV2
        });

        (bytes32 newUID, bool ok) = eas.attestThroughResolver(resolver, superseding);
        assertTrue(ok);
        assertTrue(newUID != bytes32(0));
    }

    function test_verdictSupersession_differentAttester_identicalModel_revert() public {
        Attestation memory original = _createVerdictAttestation(
            attester1,
            keccak256("media-1"),
            1500,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );
        (bytes32 targetUID, ) = eas.attestThroughResolver(resolver, original);

        // Attester2 tries to supersede with identical model/preproc
        Attestation memory superseding = _createVerdictAttestation(
            attester2,
            keccak256("media-1"),
            9500,
            2,
            uint64(block.timestamp + 180 days),
            targetUID
        );

        vm.expectRevert(VerdictResolver.InvalidSupersession.selector);
        eas.attestThroughResolver(resolver, superseding);
    }

    // ── Challenge Tests ───────────────────────────────────────────────────────
    function test_challenge_success() public {
        Attestation memory targetVerdict = _createVerdictAttestation(
            attester1,
            keccak256("media-to-challenge"),
            1000,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );
        (bytes32 targetUID, ) = eas.attestThroughResolver(resolver, targetVerdict);

        bytes memory challengeData = abi.encode(
            modelHashActive,
            uint16(8500), // observed pFake = 85.00%
            uint8(2),     // observed verdict = LIKELY_SYNTHETIC
            keccak256("challenge-evidence")
        );

        Attestation memory challengeAtt = Attestation({
            uid: bytes32(0),
            schema: challengeSchemaUID,
            time: uint64(block.timestamp),
            expirationTime: uint64(block.timestamp + 30 days),
            revocationTime: 0,
            refUID: targetUID,
            recipient: address(0),
            attester: challenger,
            revocable: true,
            data: challengeData
        });

        (bytes32 challengeUID, bool ok) = eas.attestThroughResolver(resolver, challengeAtt);
        assertTrue(ok);
        assertTrue(challengeUID != bytes32(0));
    }

    function test_challenge_revertTargetAttesterIsChallenger() public {
        Attestation memory targetVerdict = _createVerdictAttestation(
            attester1,
            keccak256("media-self-challenge"),
            1000,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );
        (bytes32 targetUID, ) = eas.attestThroughResolver(resolver, targetVerdict);

        bytes memory challengeData = abi.encode(
            modelHashActive,
            uint16(8500),
            uint8(2),
            keccak256("challenge-ev")
        );

        Attestation memory challengeAtt = Attestation({
            uid: bytes32(0),
            schema: challengeSchemaUID,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: targetUID,
            recipient: address(0),
            attester: attester1, // Self challenge!
            revocable: true,
            data: challengeData
        });

        vm.expectRevert(VerdictResolver.ChallengerCannotBeTarget.selector);
        eas.attestThroughResolver(resolver, challengeAtt);
    }

    function test_challenge_rateLimitEnforced() public {
        Attestation memory targetVerdict = _createVerdictAttestation(
            attester1,
            keccak256("media-rate-limit"),
            1000,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );
        (bytes32 targetUID, ) = eas.attestThroughResolver(resolver, targetVerdict);

        bytes memory challengeData = abi.encode(
            modelHashActive,
            uint16(8500),
            uint8(2),
            keccak256("challenge-ev")
        );

        // Submit 10 challenges (allowed)
        for (uint256 i = 0; i < 10; i++) {
            Attestation memory c = Attestation({
                uid: bytes32(0),
                schema: challengeSchemaUID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: targetUID,
                recipient: address(0),
                attester: challenger,
                revocable: true,
                data: challengeData
            });
            eas.attestThroughResolver(resolver, c);
        }

        // 11th challenge within the hour must revert
        Attestation memory c11 = Attestation({
            uid: bytes32(0),
            schema: challengeSchemaUID,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: targetUID,
            recipient: address(0),
            attester: challenger,
            revocable: true,
            data: challengeData
        });

        vm.expectRevert(VerdictResolver.ChallengeRateLimitExceeded.selector);
        eas.attestThroughResolver(resolver, c11);

        // Warp past 1 hour -> challenge succeeds again
        vm.warp(block.timestamp + 3601);
        (bytes32 cNewUID, bool ok) = eas.attestThroughResolver(resolver, c11);
        assertTrue(ok);
        assertTrue(cNewUID != bytes32(0));
    }

    // ── CanaryResult Tests ────────────────────────────────────────────────────
    function test_canaryResult_success() public {
        bytes memory canaryData = abi.encode(
            modelHashActive,
            keccak256("batch-nov-2026"),
            uint16(9850), // 98.50% AUC
            uint16(350),  // 3.50% ECE
            uint16(9000), // 90.00% Coverage
            uint32(500),  // 500 images
            keccak256("commit-labels")
        );

        Attestation memory canaryAtt = Attestation({
            uid: bytes32(0),
            schema: canarySchemaUID,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(0),
            attester: canaryIssuer,
            revocable: true,
            data: canaryData
        });

        (bytes32 canaryUID, bool ok) = eas.attestThroughResolver(resolver, canaryAtt);
        assertTrue(ok);
        assertTrue(canaryUID != bytes32(0));
    }

    function test_canaryResult_revertNotCanaryIssuer() public {
        bytes memory canaryData = abi.encode(
            modelHashActive,
            keccak256("batch-1"),
            uint16(9850),
            uint16(350),
            uint16(9000),
            uint32(500),
            keccak256("labels")
        );

        Attestation memory canaryAtt = Attestation({
            uid: bytes32(0),
            schema: canarySchemaUID,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(0),
            attester: attester1, // Not canary issuer
            revocable: true,
            data: canaryData
        });

        vm.expectRevert(VerdictResolver.NotCanaryIssuer.selector);
        eas.attestThroughResolver(resolver, canaryAtt);
    }

    // ── Revoke & Access Tests ─────────────────────────────────────────────────
    function test_revoke_success() public {
        Attestation memory targetVerdict = _createVerdictAttestation(
            attester1,
            keccak256("media-revoke"),
            1000,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );
        (bytes32 targetUID, ) = eas.attestThroughResolver(resolver, targetVerdict);

        bool revoked = eas.revokeThroughResolver(resolver, targetUID);
        assertTrue(revoked);
    }

    function test_directAttest_revertAccessDenied() public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-direct"),
            1000,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        vm.prank(attester1);
        vm.expectRevert(SchemaResolver.AccessDenied.selector);
        resolver.attest(att);
    }

    function test_notPayable_revertsIfValueSent() public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-pay"),
            1000,
            1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        vm.deal(address(this), 1 ether);
        vm.expectRevert(SchemaResolver.NotPayable.selector);
        eas.attestThroughResolver{value: 0.1 ether}(resolver, att);
    }

    // ── Fuzz Tests (1000 runs) ────────────────────────────────────────────────
    function testFuzz_verdictPFakeBps_bounds(uint16 pFake) public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-fuzz-pfake"),
            pFake,
            pFake > 5000 ? 2 : 1,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        if (pFake <= 10000) {
            (, bool ok) = eas.attestThroughResolver(resolver, att);
            assertTrue(ok);
        } else {
            vm.expectRevert(VerdictResolver.InvalidPFakeBps.selector);
            eas.attestThroughResolver(resolver, att);
        }
    }

    function testFuzz_verdictClass_bounds(uint8 verdictClass) public {
        Attestation memory att = _createVerdictAttestation(
            attester1,
            keccak256("media-fuzz-class"),
            5000,
            verdictClass,
            uint64(block.timestamp + 180 days),
            bytes32(0)
        );

        if (verdictClass <= 2) {
            (, bool ok) = eas.attestThroughResolver(resolver, att);
            assertTrue(ok);
        } else {
            vm.expectRevert(VerdictResolver.InvalidVerdictClass.selector);
            eas.attestThroughResolver(resolver, att);
        }
    }
}
