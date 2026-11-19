// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title Registry
 * @notice PRAMANA Registry: manages model hashes, attester allowlist, canary-issuer role.
 *         Skeleton — full implementation in Phase 4 (T4.1).
 * @dev    See spec_schemas.md §3 for the full spec.
 *
 * Roles:
 *   - owner: deployer (testnet EOA; mainnet: Safe multisig)
 *   - attesters: allowlisted accounts that may submit Verdict/Challenge attestations
 *   - canaryIssuer: single account that may submit CanaryResult attestations
 *
 * Model status:
 *   0 = ACTIVE, 1 = DEPRECATED, 2 = DEGRADED
 */
contract Registry {
    // ── Errors ────────────────────────────────────────────────────────────────
    error NotOwner();
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidStatus();
    error InvalidModelHash();
    error ZeroAddress();

    // ── Events ────────────────────────────────────────────────────────────────
    event ModelRegistered(bytes32 indexed modelHash, bytes32 preprocHash, string uri, bytes32 specVersion);
    event ModelStatusChanged(bytes32 indexed modelHash, uint8 newStatus);
    event AttesterAdded(address indexed attester);
    event AttesterRemoved(address indexed attester);
    event CanaryIssuerSet(address indexed canaryIssuer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── State ─────────────────────────────────────────────────────────────────
    address public owner;
    address public canaryIssuer;

    struct ModelInfo {
        bytes32 preprocHash;
        string uri;
        bytes32 specVersion;
        uint8 status; // 0=ACTIVE, 1=DEPRECATED, 2=DEGRADED
        bool registered;
    }

    mapping(bytes32 => ModelInfo) public models;
    mapping(address => bool) public attesters;

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ── Ownership management ─────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // ── Model management ─────────────────────────────────────────────────────
    function registerModel(
        bytes32 modelHash,
        bytes32 preprocHash,
        string calldata uri,
        bytes32 specVersion
    ) external onlyOwner {
        if (modelHash == bytes32(0)) revert InvalidModelHash();
        if (models[modelHash].registered) revert AlreadyRegistered();
        models[modelHash] = ModelInfo({
            preprocHash: preprocHash,
            uri: uri,
            specVersion: specVersion,
            status: 0, // ACTIVE
            registered: true
        });
        emit ModelRegistered(modelHash, preprocHash, uri, specVersion);
    }

    function setModelStatus(bytes32 modelHash, uint8 status) external onlyOwner {
        if (!models[modelHash].registered) revert NotRegistered();
        if (status > 2) revert InvalidStatus();
        models[modelHash].status = status;
        emit ModelStatusChanged(modelHash, status);
    }

    function isModelActive(bytes32 modelHash) external view returns (bool) {
        ModelInfo storage m = models[modelHash];
        return m.registered && m.status == 0;
    }

    function getModel(bytes32 modelHash) external view returns (ModelInfo memory) {
        if (!models[modelHash].registered) revert NotRegistered();
        return models[modelHash];
    }

    // ── Attester allowlist ────────────────────────────────────────────────────
    function addAttester(address attester) external onlyOwner {
        if (attester == address(0)) revert ZeroAddress();
        attesters[attester] = true;
        emit AttesterAdded(attester);
    }

    function removeAttester(address attester) external onlyOwner {
        if (attester == address(0)) revert ZeroAddress();
        attesters[attester] = false;
        emit AttesterRemoved(attester);
    }

    function isAttester(address attester) external view returns (bool) {
        return attesters[attester];
    }

    // ── Canary issuer ─────────────────────────────────────────────────────────
    function setCanaryIssuer(address _canaryIssuer) external onlyOwner {
        if (_canaryIssuer == address(0)) revert ZeroAddress();
        canaryIssuer = _canaryIssuer;
        emit CanaryIssuerSet(_canaryIssuer);
    }
}
