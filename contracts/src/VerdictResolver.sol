// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IEAS, Attestation} from "./interfaces/IEAS.sol";
import {SchemaResolver} from "./resolver/SchemaResolver.sol";
import {Registry} from "./Registry.sol";

/**
 * @title VerdictResolver
 * @notice PRAMAN EAS SchemaResolver — enforces attestation rules at attest-time.
 * @dev    Implements spec_schemas.md §3:
 *         - Verdict rules: allowlisted attester, ACTIVE model, expiration within [now, now + MAX_TTL],
 *           valid verdict class in {0,1,2}, pFakeBps <= 10000, sha256Hash != 0, valid supersession.
 *         - Challenge rules: allowlisted attester, valid non-revoked target Verdict refUID,
 *           challenger != target attester, matching modelHash, rate-limited per window.
 *         - CanaryResult rules: attester == canaryIssuer, registered model, valid metrics.
 *         - Revocation: original attester only.
 */
contract VerdictResolver is SchemaResolver {
    // ── Errors ────────────────────────────────────────────────────────────────
    error NotOwner();
    error NotAllowlistedAttester();
    error NotCanaryIssuer();
    error ModelNotActive();
    error ModelNotRegistered();
    error InvalidExpiration();
    error InvalidVerdictClass();
    error InvalidPFakeBps();
    error InvalidSha256();
    error InvalidRefUID();
    error ChallengerCannotBeTarget();
    error ChallengeRateLimitExceeded();
    error InvalidSupersession();
    error InvalidCanaryMetrics();
    error UnknownSchema();
    error ZeroAddress();

    // ── Events ────────────────────────────────────────────────────────────────
    event SchemasSet(bytes32 indexed verdictSchema, bytes32 indexed challengeSchema, bytes32 indexed canaryResultSchema);
    event RateLimitsUpdated(uint256 newLimit, uint256 newWindow);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Constants & Immutables ────────────────────────────────────────────────
    uint256 public constant MAX_TTL = 365 days;
    uint256 public constant MIN_TTL = 1 hours;

    Registry public immutable registry;
    address public owner;

    // ── Configurable State ────────────────────────────────────────────────────
    bytes32 public verdictSchema;
    bytes32 public challengeSchema;
    bytes32 public canaryResultSchema;

    uint256 public challengeLimit;
    uint256 public challengeWindow;

    struct RateLimit {
        uint32 count;
        uint64 windowStart;
    }

    mapping(address => RateLimit) public challengeRateLimits;

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        IEAS eas,
        Registry _registry,
        address _owner,
        uint256 _challengeLimit,
        uint256 _challengeWindow
    ) SchemaResolver(eas) {
        if (address(_registry) == address(0) || _owner == address(0)) revert ZeroAddress();
        registry = _registry;
        owner = _owner;
        challengeLimit = _challengeLimit == 0 ? 10 : _challengeLimit;
        challengeWindow = _challengeWindow == 0 ? 1 hours : _challengeWindow;
    }

    // ── Admin Functions ───────────────────────────────────────────────────────
    function withdraw(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = recipient.call{value: balance}("");
            require(success, "Withdraw failed");
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function setSchemas(
        bytes32 _verdictSchema,
        bytes32 _challengeSchema,
        bytes32 _canaryResultSchema
    ) external onlyOwner {
        verdictSchema = _verdictSchema;
        challengeSchema = _challengeSchema;
        canaryResultSchema = _canaryResultSchema;
        emit SchemasSet(_verdictSchema, _challengeSchema, _canaryResultSchema);
    }

    function setChallengeRateLimit(uint256 _limit, uint256 _window) external onlyOwner {
        if (_limit == 0 || _window == 0) revert ChallengeRateLimitExceeded();
        challengeLimit = _limit;
        challengeWindow = _window;
        emit RateLimitsUpdated(_limit, _window);
    }

    // ── SchemaResolver Hooks ──────────────────────────────────────────────────
    function onAttest(Attestation calldata attestation, uint256 /* value */) internal override returns (bool) {
        bytes32 schema = attestation.schema;

        if (schema == verdictSchema) {
            return _validateVerdict(attestation);
        } else if (schema == challengeSchema) {
            return _validateChallenge(attestation);
        } else if (schema == canaryResultSchema) {
            return _validateCanaryResult(attestation);
        } else {
            revert UnknownSchema();
        }
    }

    function onRevoke(Attestation calldata attestation, uint256 /* value */) internal pure override returns (bool) {
        if (attestation.attester == address(0)) revert ZeroAddress();
        return true;
    }

    // ── Internal Validators ───────────────────────────────────────────────────
    function _validateVerdict(Attestation calldata attestation) internal view returns (bool) {
        if (!registry.isAttester(attestation.attester)) revert NotAllowlistedAttester();

        (
            bytes32 sha256Hash,
            ,
            ,
            bytes32 modelHash,
            bytes32 preprocHash,
            uint16 pFakeBps,
            uint8 verdict,

        ) = abi.decode(
            attestation.data,
            (bytes32, uint64, uint64, bytes32, bytes32, uint16, uint8, bytes32)
        );

        if (sha256Hash == bytes32(0)) revert InvalidSha256();
        if (verdict > 2) revert InvalidVerdictClass();
        if (pFakeBps > 10000) revert InvalidPFakeBps();
        if (!registry.isModelActive(modelHash)) revert ModelNotActive();

        if (
            attestation.expirationTime <= block.timestamp ||
            attestation.expirationTime > block.timestamp + MAX_TTL
        ) {
            revert InvalidExpiration();
        }

        // Validate supersession if refUID is provided
        if (attestation.refUID != bytes32(0)) {
            Attestation memory target = _eas.getAttestation(attestation.refUID);
            if (
                target.uid == bytes32(0) ||
                target.schema != verdictSchema ||
                target.revocationTime != 0
            ) {
                revert InvalidRefUID();
            }

            // Target must be by the same attester OR by any allowlisted attester with newer model
            if (attestation.attester != target.attester) {
                (
                    ,
                    ,
                    ,
                    bytes32 targetModelHash,
                    bytes32 targetPreprocHash,
                    ,
                    ,

                ) = abi.decode(
                    target.data,
                    (bytes32, uint64, uint64, bytes32, bytes32, uint16, uint8, bytes32)
                );

                if (modelHash == targetModelHash && preprocHash == targetPreprocHash) {
                    revert InvalidSupersession();
                }
            }
        }

        return true;
    }

    function _validateChallenge(Attestation calldata attestation) internal returns (bool) {
        if (!registry.isAttester(attestation.attester)) revert NotAllowlistedAttester();
        if (attestation.refUID == bytes32(0)) revert InvalidRefUID();

        Attestation memory target = _eas.getAttestation(attestation.refUID);
        if (
            target.uid == bytes32(0) ||
            target.schema != verdictSchema ||
            target.revocationTime != 0
        ) {
            revert InvalidRefUID();
        }

        if (attestation.attester == target.attester) revert ChallengerCannotBeTarget();

        // Enforce per-attester rate limit
        RateLimit storage limit = challengeRateLimits[attestation.attester];
        if (block.timestamp >= limit.windowStart + challengeWindow) {
            limit.windowStart = uint64(block.timestamp);
            limit.count = 1;
        } else {
            if (limit.count >= challengeLimit) revert ChallengeRateLimitExceeded();
            limit.count++;
        }

        (
            bytes32 challengeModelHash,
            uint16 observedPFakeBps,
            uint8 observedVerdict,

        ) = abi.decode(
            attestation.data,
            (bytes32, uint16, uint8, bytes32)
        );

        (
            ,
            ,
            ,
            bytes32 targetModelHash,
            ,
            ,
            ,

        ) = abi.decode(
            target.data,
            (bytes32, uint64, uint64, bytes32, bytes32, uint16, uint8, bytes32)
        );

        if (challengeModelHash != targetModelHash) revert InvalidRefUID();
        if (observedVerdict > 2) revert InvalidVerdictClass();
        if (observedPFakeBps > 10000) revert InvalidPFakeBps();

        return true;
    }

    function _validateCanaryResult(Attestation calldata attestation) internal view returns (bool) {
        if (attestation.attester != registry.canaryIssuer()) revert NotCanaryIssuer();

        (
            bytes32 modelHash,
            ,
            uint16 aucBps,
            uint16 eceBps,
            uint16 coverageBps,
            uint32 n,

        ) = abi.decode(
            attestation.data,
            (bytes32, bytes32, uint16, uint16, uint16, uint32, bytes32)
        );

        // Model must be registered in Registry
        Registry.ModelInfo memory mInfo = registry.getModel(modelHash);
        if (!mInfo.registered) revert ModelNotRegistered();

        if (aucBps > 10000 || eceBps > 10000 || coverageBps > 10000 || n == 0) {
            revert InvalidCanaryMetrics();
        }

        return true;
    }
}
