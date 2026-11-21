// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "../src/Registry.sol";
import {VerdictResolver} from "../src/VerdictResolver.sol";
import {IEAS} from "../src/interfaces/IEAS.sol";
import {ISchemaRegistry} from "../src/interfaces/ISchemaRegistry.sol";
import {ISchemaResolver} from "../src/interfaces/ISchemaResolver.sol";
import {MockEAS} from "../test/mocks/MockEAS.sol";
import {MockSchemaRegistry} from "../test/mocks/MockSchemaRegistry.sol";

contract DeployScript is Script {
    string public constant VERDICT_SCHEMA =
        "bytes32 sha256Hash, uint64 pHash, uint64 wmId, bytes32 modelHash, bytes32 preprocHash, uint16 pFakeBps, uint8 verdict, bytes32 evidenceHash";
    string public constant CHALLENGE_SCHEMA =
        "bytes32 modelHash, uint16 observedPFakeBps, uint8 observedVerdict, bytes32 evidenceHash";
    string public constant CANARY_SCHEMA =
        "bytes32 modelHash, bytes32 batchId, uint16 aucBps, uint16 eceBps, uint16 coverageBps, uint32 n, bytes32 labelsCommitHash";

    function run() external returns (
        address registryAddr,
        address resolverAddr,
        bytes32 verdictUID,
        bytes32 challengeUID,
        bytes32 canaryUID
    ) {
        uint256 deployerPrivateKey;
        try vm.envUint("DEPLOYER_PRIVATE_KEY") returns (uint256 key) {
            deployerPrivateKey = key;
        } catch {
            // Anvil account 0 default key
            deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }

        address deployer = vm.addr(deployerPrivateKey);
        console.log("=== Deploying PRAMAN Protocol ===");
        console.log("Deployer Address:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        address easAddress;
        address schemaRegistryAddress;

        if (block.chainid == 31337) {
            console.log("Local Anvil detected. Deploying MockEAS & MockSchemaRegistry...");
            MockEAS mockEas = new MockEAS();
            MockSchemaRegistry mockReg = new MockSchemaRegistry();
            easAddress = address(mockEas);
            schemaRegistryAddress = address(mockReg);
        } else {
            easAddress = vm.envAddress("EAS_ADDRESS");
            schemaRegistryAddress = vm.envAddress("SCHEMA_REGISTRY_ADDRESS");
        }

        console.log("EAS Address:", easAddress);
        console.log("SchemaRegistry Address:", schemaRegistryAddress);

        // 1. Deploy Registry
        Registry reg = new Registry(deployer);
        registryAddr = address(reg);
        console.log("Registry deployed at:", registryAddr);

        // 2. Deploy VerdictResolver
        VerdictResolver res = new VerdictResolver(
            IEAS(easAddress),
            reg,
            deployer,
            10,       // 10 challenges per window
            1 hours   // 1 hour window
        );
        resolverAddr = address(res);
        console.log("VerdictResolver deployed at:", resolverAddr);

        // 3. Register EAS Schemas
        ISchemaRegistry schemaRegistry = ISchemaRegistry(schemaRegistryAddress);
        verdictUID = schemaRegistry.register(VERDICT_SCHEMA, ISchemaResolver(resolverAddr), true);
        console.log("Verdict Schema UID:");
        console.logBytes32(verdictUID);

        challengeUID = schemaRegistry.register(CHALLENGE_SCHEMA, ISchemaResolver(resolverAddr), true);
        console.log("Challenge Schema UID:");
        console.logBytes32(challengeUID);

        canaryUID = schemaRegistry.register(CANARY_SCHEMA, ISchemaResolver(resolverAddr), true);
        console.log("CanaryResult Schema UID:");
        console.logBytes32(canaryUID);

        // 4. Set Schema UIDs in VerdictResolver
        res.setSchemas(verdictUID, challengeUID, canaryUID);
        console.log("Schema UIDs configured in VerdictResolver.");

        // 5. Configure initial attester & canary issuer
        address defaultAttester = 0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44;
        address defaultCanaryIssuer = 0xc40Bc4A72631A634865B70296e371466fcEA9AcA;

        reg.addAttester(defaultAttester);
        reg.setCanaryIssuer(defaultCanaryIssuer);
        console.log("Default Attester added:", defaultAttester);
        console.log("Default Canary Issuer set:", defaultCanaryIssuer);

        // 6. Register Model A & Model B
        bytes32 modelAHash = keccak256("model-a-clip-linear-probe-v1");
        bytes32 modelBHash = keccak256("model-b-clip-mlp-probe-v1");
        bytes32 preprocHash = keccak256("clip-vit-b-32-preproc-v1");

        reg.registerModel(modelAHash, preprocHash, "ipfs://model-a-v1", bytes32("0.1.0"));
        reg.registerModel(modelBHash, preprocHash, "ipfs://model-b-v1", bytes32("0.1.0"));
        console.log("Model A & Model B registered in Registry.");

        vm.stopBroadcast();
        console.log("=== Deployment Complete ===");
    }
}
