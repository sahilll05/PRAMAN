// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IEAS, Attestation} from "../../src/interfaces/IEAS.sol";
import {ISchemaResolver} from "../../src/interfaces/ISchemaResolver.sol";

/**
 * @title MockEAS
 * @notice Mock implementation of EAS for testing SchemaResolvers.
 */
contract MockEAS is IEAS {
    mapping(bytes32 => Attestation) private _attestations;
    uint256 private _nonce;

    function setAttestation(bytes32 uid, Attestation memory att) external {
        _attestations[uid] = att;
    }

    function getAttestation(bytes32 uid) external view override returns (Attestation memory) {
        return _attestations[uid];
    }

    function isAttestationValid(bytes32 uid) external view override returns (bool) {
        Attestation memory att = _attestations[uid];
        return att.uid != bytes32(0) && att.revocationTime == 0;
    }

    function attestThroughResolver(
        ISchemaResolver resolver,
        Attestation memory att
    ) external payable returns (bytes32, bool) {
        bytes32 uid = keccak256(abi.encodePacked(_nonce++, att.attester, att.schema, block.timestamp));
        att.uid = uid;
        _attestations[uid] = att;

        bool ok = resolver.attest{value: msg.value}(att);
        return (uid, ok);
    }

    function revokeThroughResolver(
        ISchemaResolver resolver,
        bytes32 uid
    ) external payable returns (bool) {
        Attestation storage att = _attestations[uid];
        require(att.uid != bytes32(0), "Attestation does not exist");
        att.revocationTime = uint64(block.timestamp);

        return resolver.revoke{value: msg.value}(att);
    }
}
