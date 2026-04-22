# PLAN.md

## Mission
Keep scanning through messy repo docs without losing the real task list.

## Focus
Stabilize noisy-fixture extraction.

- [x] Verify archived docs stay ignored
- [ ] Preserve now/next/blocked extraction through extra prose

## Now
- [ ] Wire the shared prompt module into the HUD
- [ ] Fix desktop click-to-open at exact lines
- [x] Ignore a finished cleanup item

## Notes
This section should not affect task extraction.

### Extra context
The parser should skip these paragraphs and still find the task lists above.

## Next
- [ ] Add prompt-file loading later
- [ ] Refresh the README without changing behavior

## Blocked
Waiting on fixture coverage for archived docs.

- [ ] Confirm archived markdown is excluded — test data should stay out of the HUD
