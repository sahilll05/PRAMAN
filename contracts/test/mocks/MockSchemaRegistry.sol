// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ISchemaRegistry, SchemaRecord} from "../../src/interfaces/ISchemaRegistry.sol";
import {ISchemaResolver} from "../../src/interfaces/ISchemaResolver.sol";

contract MockSchemaRegistry is ISchemaRegistry {
    mapping(bytes32 => SchemaRecord) private _schemas;

    function register(
        string calldata schema,
        ISchemaResolver resolver,
        bool revocable
    ) external override returns (bytes32) {
        bytes32 uid = keccak256(abi.encodePacked(schema, address(resolver), revocable));
        _schemas[uid] = SchemaRecord({
            uid: uid,
            resolver: resolver,
            revocable: revocable,
            schema: schema
        });
        return uid;
    }

    function getSchema(bytes32 uid) external view override returns (SchemaRecord memory) {
        return _schemas[uid];
    }
}
