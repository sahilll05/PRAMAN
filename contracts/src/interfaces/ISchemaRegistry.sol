// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ISchemaResolver} from "./ISchemaResolver.sol";

struct SchemaRecord {
    bytes32 uid;
    ISchemaResolver resolver;
    bool revocable;
    string schema;
}

interface ISchemaRegistry {
    function register(string calldata schema, ISchemaResolver resolver, bool revocable) external returns (bytes32);
    function getSchema(bytes32 uid) external view returns (SchemaRecord memory);
}
