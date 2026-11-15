// Game modules by app id, the only place the host binds a specific game engine.
// Three Winds (3PMahjong) comes from @threewinds/engine, an alias of
// @bilkobibitkov/threewinds-engine on npm. Sanctioned app-specific host code
// (docs/host-internals.md).
import type { RoomGameModule } from './runtime.js';
import { threeWindsRoomModule, type RoomState } from '@threewinds/engine';

/** Three Winds rule R4.6: a human has 4 s to act in a claim window. */
export const THREE_WINDS_CLAIM_MS = 4000;

type Deadline = (state: RoomState, seat: number) => number | null | undefined;
const engineDeadline = (threeWindsRoomModule as { deadlineMs?: Deadline }).deadlineMs;

// R4.6 fallback: engine 0.1.0 has no deadlineMs, so the host supplies the claim
// window here. Delete this fallback once the engine ships its own deadlineMs.
const threeWinds: RoomGameModule<RoomState> = {
  ...threeWindsRoomModule,
  deadlineMs: engineDeadline
    ? engineDeadline.bind(threeWindsRoomModule)
    : (state) => (state.phase === 'claim' ? THREE_WINDS_CLAIM_MS : undefined),
};

export const ROOM_MODULES: Record<string, RoomGameModule<any>> = {
  threewinds: threeWinds,
};
