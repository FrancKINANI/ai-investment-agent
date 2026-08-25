# Roadmap

Ledgerline continues to increase **observability and review quality** before authority. The PAIA v0.4 foundation adds a validated Capability Registry: every declared research capability has a stable identifier, version, safe scope, and role binding. The roadmap is directional and does not authorize live trading.

## Completed

1. **Wallet connection:** WalletConnect and injected provider support with address display, network info, and disconnect. Mode management with simulation → paper → live progression and confirmation dialog.
2. **Platform API keys:** Full CRUD for exchange keys with encrypted storage, permission warnings, per-platform limits, test/disable/delete, and withdrawal permission alerts.
3. **Security alerts:** Dedicated alerts page with critical/warning/info levels, persistent badge, acknowledge/resolve, and structured audit logging.
4. **Capability governance:** Validated registry with visible role bindings, audit identifiers, and policy-safe scopes.
5. **Operator ergonomics:** Accessible loading, contrast, mobile navigation, and traceable activity review.

## In progress

1. **Evidence quality:** Richer provenance, clearer research completeness, and owner review summaries.
2. **Simulation fidelity:** Stronger paper-proposal lifecycle coverage and scenario analysis without venue access.

## Future

1. **Restricted integrations:** Only after documented scope isolation, revocation, simulation coverage, owner mandate, and security review.
2. **Real KMS integration:** Replace the base64 secret encryption placeholder with AES-256-GCM via a key management service.
3. **WalletConnect v2 modal:** Full WalletConnect v2 integration with session management and multi-chain support.
4. **Exchange API integration:** Real connection testing against live exchange APIs (read-only endpoints first).

No capability manifest can add credentials, wallet keys, signing authority, custody, withdrawal permissions, live execution, or live venue access. Any future real capability would require a separate product decision, independent security design, explicit owner consent, and server-enforced controls. It is not on the current implementation path.
