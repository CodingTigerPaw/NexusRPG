import type { SessionMapToken } from "../types";

export type MapPermissionContext = {
  canManageMap: boolean;
  currentUserId?: string;
};

export function canMoveMapToken(token: SessionMapToken, context: MapPermissionContext) {
  if (token.lockState === "locked" || token.lockState === "positionLocked") {
    return false;
  }

  if (context.canManageMap) {
    return true;
  }

  if (!context.currentUserId) {
    return false;
  }

  // Ruch gracza opieramy na bezpośrednim właścicielu tokena, żeby lista
  // dodatkowych kontrolujących nie dawała przypadkowego prawa do ruchu na mapie.
  return token.ownership?.ownerUserId === context.currentUserId;
}
