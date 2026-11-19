// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Attestation} from "./IEAS.sol";

/**
 * @title ISchemaResolver
 * @notice Standard interface for EAS SchemaResolvers.
 */
interface ISchemaResolver {
    function isPayable() external pure returns (bool);
    function attest(Attestation calldata attestation) external payable returns (bool);
    function multiAttest(Attestation[] calldata attestations, uint256[] calldata values) external payable returns (bool);
    function revoke(Attestation calldata attestation) external payable returns (bool);
    function multiRevoke(Attestation[] calldata attestations, uint256[] calldata values) external payable returns (bool);
}
