# Initial Interaction Audit

The primary paper-cycle control currently changes the simulation identifier, writes an event, and shows a success notification. This was verified in the live preview.

The reported perception that “nothing is clickable” is nevertheless valid at the product level: several controls only change a label or issue a toast, while navigation does not switch to a dedicated operational workspace. The v0.2 update will replace these weak affordances with visible section transitions, interactive awareness/lineage workflows, and explicit state panels.

## v0.2 validation notes

The updated Agent mesh navigation was tested in the live application. It now changes the active workspace label and scrolls the operator directly to the seven-role topology, selected-role explanation, and corresponding tool-scope surface. The primary paper-cycle control was separately verified to increment the simulation identifier and create a visible evidence entry.

The selected-agent scope checker was tested for Sentinel. It displayed the exact scoped permissions, made the missing `execution.request` permission explicit, and wrote a Justification entry in the awareness ledger. The strategy hard-evaluation control was also tested: it retained the candidate in **review** because simulation evidence is incomplete, showed the gate explanation, and recorded that decision in the ledger.

The owner pause was tested end-to-end. Activating it changed the visible runtime state to **Owner pause active**, created an Action-awareness entry, and renamed the control to **Resume fabric**. A subsequent paper-cycle attempt was blocked with an explicit pause explanation and did not create a new run.

The new supervised promotion action was tested. A strategy moved from **research** to **simulation** with a visible status change, an Evolutionary-awareness record, and an explicit confirmation that no live execution path exists.

The outcome-tracker action was tested in the live console. It changed the visible tracker from **inconclusive** to **underperforming**, displayed a declared expectation, realized paper outcome, attribution fields, and deviation, and wrote a Result-awareness ledger entry.

The enhanced promotion path was reloaded and tested through the initial transition to **simulation**. The UI made the conditional **Complete paper evidence** action available only after that stage was reached.

After simulated paper evidence was completed, the evaluator was tested and returned a visible **pass**. The ledger recorded both the Result-awareness evidence and Justification-awareness gate decision, while explicitly confirming that the next available state is decision review rather than execution.

The final promotion action was tested and moved the strategy to **decision**. The visible lineage state reads `stage: decision · never executable`, the event is recorded as Evolutionary awareness, and no execution control or execution scope becomes available.

Agent selection was tested by switching from Sentinel to Atlas. The selected-role explanation and scope registry changed to Atlas while continuing to show that `execution.request` is denied. The server-side catalog refresh was also tested; it completed with a confirmation that provider families were re-read without browser-side provider credentials.

The strategy-variation control was tested and registered `STRAT-ETH-YIELD v0.4` as a research-only lineage branch. The evidence-ledger **Full trace** control was also tested; it preserves the complete visible journal and explicitly explains that each entry exposes its awareness layer and evidence summary.

## v0.3 data-backed control plane verification

The anonymous public-data workflow was tested with the WETH ERC-20 contract `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`. The viewer returned live token metadata, holder count, price, DEX liquidity, 24-hour volume, change, market-cap figures, source attribution, and a fetch timestamp from Blockscout and DexScreener. No sample metric was presented before a successful response.

The workspace navigation was tested by selecting **On-chain viewer**. The page scrolled to the viewer and the persistent control-plane breadcrumb changed from **Control plane** to **On-chain viewer**.
