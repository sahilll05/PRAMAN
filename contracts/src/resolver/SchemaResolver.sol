// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IEAS, Attestation} from "../interfaces/IEAS.sol";
import {ISchemaResolver} from "../interfaces/ISchemaResolver.sol";

/**
 * @title SchemaResolver
 * @notice Base abstract EAS schema resolver enforcing sender authentication.
 */
abstract contract SchemaResolver is ISchemaResolver {
    error AccessDenied();
    error InsufficientValue();
    error NotPayable();

    IEAS internal immutable _eas;

    constructor(IEAS eas) {
        if (address(eas) == address(0)) revert AccessDenied();
        _eas = eas;
    }

    modifier onlyEAS() {
        if (msg.sender != address(_eas)) revert AccessDenied();
        _;
    }

    function isPayable() public pure virtual override returns (bool) {
        return false;
    }

    function attest(Attestation calldata attestation) external payable override onlyEAS returns (bool) {
        if (msg.value > 0 && !isPayable()) revert NotPayable();
        return onAttest(attestation, msg.value);
    }

    function multiAttest(
        Attestation[] calldata attestations,
        uint256[] calldata values
    ) external payable override onlyEAS returns (bool) {
        uint256 total = 0;
        for (uint256 i = 0; i < attestations.length; i++) {
            total += values[i];
            if (!onAttest(attestations[i], values[i])) return false;
        }
        if (msg.value < total) revert InsufficientValue();
        return true;
    }

    function revoke(Attestation calldata attestation) external payable override onlyEAS returns (bool) {
        if (msg.value > 0 && !isPayable()) revert NotPayable();
        return onRevoke(attestation, msg.value);
    }

    function multiRevoke(
        Attestation[] calldata attestations,
        uint256[] calldata values
    ) external payable override onlyEAS returns (bool) {
        uint256 total = 0;
        for (uint256 i = 0; i < attestations.length; i++) {
            total += values[i];
            if (!onRevoke(attestations[i], values[i])) return false;
        }
        if (msg.value < total) revert InsufficientValue();
        return true;
    }

    function onAttest(Attestation calldata attestation, uint256 value) internal virtual returns (bool);
    function onRevoke(Attestation calldata attestation, uint256 value) internal virtual returns (bool);
}
