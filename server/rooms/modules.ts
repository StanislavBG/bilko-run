// Game modules by app id, the only place the host binds a specific game engine.
// Three Winds (3PMahjong) comes from @threewinds/engine, an alias of
// @bilkobibitkov/threewinds-engine on npm. The engine module carries its own
// rules hooks (nextDealer, timeoutAction, and deadlineMs for the R4.6 claim
// window), so a rule change ships as an engine release, not a host edit.
// Sanctioned app-specific host code (docs/host-internals.md).
import type { RoomGameModule } from './runtime.js';
import { threeWindsRoomModule, type RoomState } from '@threewinds/engine';

const threeWinds: RoomGameModule<RoomState> = threeWindsRoomModule;

export const ROOM_MODULES: Record<string, RoomGameModule<any>> = {
  threewinds: threeWinds,
};
