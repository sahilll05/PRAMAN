// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title VerdictResolver
 * @notice PRAMANA EAS SchemaResolver — enforces attestation rules at attest-time.
 *         Skeleton — full implementation in Phase 4 (T4.2).
 * @dev    See spec_schemas.md §3 for full rules.
 *
 * Rules enforced on attest:
 *   Verdict: attester allowlisted; modelHash ACTIVE; expirationTime valid; verdict in {0,1,2};
 *            pFakeBps <= 10000; sha256Hash != 0.
 *   Challenge: attester allowlisted; refUID is valid non-revoked Verdict; challenger != target attester;
 *              per-attester rate limit per window.
 *   CanaryResult: attester == canaryIssuer.
 *
 * onRevoke: only original attester.
 * No payable. No upgradeability in v1.
 */
contract VerdictResolver {
    // ── Errors ────────────────────────────────────────────────────────────────
    error NotImplemented(); // Remove when T4.2 is complete

    // TODO (T4.2): inherit ISchemaResolver from EAS, integrate Registry reference,
    //              implement onAttest / onRevoke with full rule set,
    //              add fuzz + invariant tests, run Slither.
}
