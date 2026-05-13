import { getAccessToken } from '$lib/modules/AuthModule/session';
import { refreshAuthSession } from '$lib/modules/AuthModule/service';
import type { CharacterCard } from '$lib/modules/characters';
import type { MapPosition, SessionMap, SessionMapToken } from '$lib/features/maps/types';
import type {
  DiceRollDieResult,
  DiceRollMechanicsResult,
  DiceRollResult
} from '$lib/modules/dice-roller';
import { webSocketAPI } from '$lib/modules/repository';

export type BackendDiceRollPayload = Partial<DiceRollResult> & {
  clientRollId?: string | null;
  expression?: string | null;
  result?: {
    total?: number | null;
    mechanics?: DiceRollMechanicsResult | null;
  } | null;
  rolls?: Array<{
    die?: string;
    value?: number;
    kind?: string;
    parts?: string[];
  }> | null;
  dice?: DiceRollDieResult[] | null;
  mechanics?: DiceRollMechanicsResult | null;
  label?: string | null;
  characterId?: string | null;
  characterName?: string | null;
  actorLabel?: string | null;
  subjectLabel?: string | null;
  targetName?: string | null;
  rollContext?: 'playerCharacter' | 'npc' | 'generic' | string | null;
  visibility?: 'public' | 'gmOnly' | string | null;
  hidden?: boolean | null;
};

export type CharacterSheetLiveEvent = {
  type?:
    | 'characterSheet.created'
    | 'characterSheet.updated'
    | 'characterSheet.deleted'
    | 'diceRoll.created'
    | 'sessionMap.created'
    | 'sessionMap.updated'
    | 'sessionMap.deleted'
    | 'sessionMap.tokenCreated'
    | 'sessionMap.tokenUpdated'
    | 'sessionMap.tokenDragging'
    | 'sessionMap.tokenMoved'
    | 'sessionMap.tokenDeleted'
    | string;
  characterSheet?: CharacterCard & {
    deletedAt?: string;
  };
  diceRoll?: BackendDiceRollPayload;
  message?: string;
  sessionId?: string;
  mapId?: string;
  actorUserId?: string;
  clientMutationId?: string;
  updatedAt?: string;
  map?: SessionMap;
  token?: SessionMapToken;
  tokenId?: string;
  position?: MapPosition;
  rotation?: number;
  version?: number;
  movedByUserId?: string;
  clientMoveId?: string;
  deletedAt?: string;
};

export type CharacterSheetSubscription = {
  userId: string;
  characterId: string;
};

export type SessionMapSubscription = {
  sessionId: string;
  mapId: string;
};

export type MapTokenDragPreviewPayload = {
  sessionId: string;
  mapId: string;
  tokenId: string;
  position: MapPosition;
  clientMoveId: string;
  phase?: 'dragging';
};

type CharacterSheetLiveSocketOptions = {
  onStatusChange?: (status: CharacterSheetLiveStatus) => void;
  onEvent?: (event: CharacterSheetLiveEvent) => void;
  onError?: (message: string) => void;
  reconnectDelayMs?: number;
  maxConnectionAgeMs?: number;
};

export type CharacterSheetLiveStatus =
  | 'disabled'
  | 'connecting'
  | 'connected'
  | 'closed'
  | 'error';

const awsApiGatewayWebSocketLimitMs = 2 * 60 * 60 * 1000;
const plannedReconnectSafetyWindowMs = 20 * 60 * 1000;
const defaultMaxConnectionAgeMs =
  awsApiGatewayWebSocketLimitMs - plannedReconnectSafetyWindowMs;

export class CharacterSheetLiveSocket {
  private socket: WebSocket | null = null;
  private activeSubscription: CharacterSheetSubscription | null = null;
  private activeMapSubscription: SessionMapSubscription | null = null;
  private manuallyClosed = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private plannedReconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: CharacterSheetLiveSocketOptions = {}) {}

  async connect() {
    this.clearReconnect();
    this.clearPlannedReconnect();

    if (!webSocketAPI) {
      this.options.onStatusChange?.('disabled');
      this.options.onError?.(
        'Brak konfiguracji WebSocket w frontendzie. Ustaw VITE_WS_API_URL, PUBLIC_WEBSOCKET_URL albo PUBLIC_WEBSOCKET_API_ID w pliku .env frontendu i zrestartuj Vite.'
      );
      return;
    }

    this.manuallyClosed = false;

    await refreshAuthSession().catch((error) => {
      this.options.onError?.(
        error instanceof Error
          ? error.message
          : 'Nie udało się odświeżyć tokenu dla połączenia live session.'
      );
    });

    if (this.manuallyClosed) {
      this.options.onStatusChange?.('closed');
      return;
    }

    const accessToken = getAccessToken();

    if (!accessToken) {
      this.options.onStatusChange?.('disabled');
      this.options.onError?.('Brak AccessToken wymaganego do połączenia live session.');
      return;
    }

    this.options.onStatusChange?.('connecting');

    let url: URL;

    try {
      url = new URL(webSocketAPI);
    } catch {
      this.options.onStatusChange?.('disabled');
      this.options.onError?.('Adres WebSocket ma nieprawidłowy format. Oczekiwany format to wss://.../dev.');
      return;
    }

    url.searchParams.set('accessToken', accessToken);

    this.socket?.close(1000, 'Replacing live RPG session connection');

    const socket = new WebSocket(url.toString());
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        return;
      }

      this.options.onStatusChange?.('connected');
      this.schedulePlannedReconnect();
      this.sendSubscription('subscribeCharacterSheet', this.activeSubscription);
      this.sendMapSubscription('subscribeSessionMap', this.activeMapSubscription);
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) {
        return;
      }

      this.handleMessage(event.data);
    });

    socket.addEventListener('error', () => {
      if (this.socket !== socket) {
        return;
      }

      this.options.onStatusChange?.('error');
      this.options.onError?.('Połączenie live session zgłosiło błąd.');
    });

    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) {
        return;
      }

      this.clearPlannedReconnect();

      if (this.manuallyClosed) {
        this.options.onStatusChange?.('closed');
        return;
      }

      this.options.onStatusChange?.('error');
      this.options.onError?.(
        event.code === 1006
          ? 'Połączenie live session zostało odrzucone albo przerwane. Sprawdź URL WebSocket i ważność AccessToken. Ponawiam połączenie...'
          : `Połączenie live session zostało przerwane (${event.code}). Ponawiam połączenie...`
      );
      this.scheduleReconnect();
    });
  }

  subscribe(subscription: CharacterSheetSubscription | null) {
    const previousSubscription = this.activeSubscription;
    this.activeSubscription = subscription;

    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.sendSubscription('unsubscribeCharacterSheet', previousSubscription);
    this.sendSubscription('subscribeCharacterSheet', subscription);
  }

  subscribeSessionMap(subscription: SessionMapSubscription | null) {
    const previousSubscription = this.activeMapSubscription;
    this.activeMapSubscription = subscription;

    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.sendMapSubscription('unsubscribeSessionMap', previousSubscription);
    this.sendMapSubscription('subscribeSessionMap', subscription);
  }

  sendDiceRoll(
    diceRoll: DiceRollResult,
    metadata: { characterId?: string | null; characterName?: string | null } = {}
  ) {
    return this.sendJson({
      action: 'broadcastDiceRoll',
      sessionId: diceRoll.sessionId,
      clientRollId: diceRoll.rollId,
      notation: diceRoll.notation,
      animationSeed: diceRoll.animationSeed ?? null,
      total: diceRoll.total,
      result: {
        total: diceRoll.total,
        mechanics: diceRoll.mechanics ?? null
      },
      rolls: diceRoll.dice.map((die) => ({
        die: `d${die.sides}`,
        value: die.value,
        kind: die.kind,
        parts: die.parts
      })),
      dice: diceRoll.dice,
      mechanics: diceRoll.mechanics ?? null,
      label: diceRoll.targetName ?? diceRoll.mechanics?.checkName ?? diceRoll.notation,
      actorLabel: diceRoll.actorLabel ?? null,
      subjectLabel: diceRoll.subjectLabel ?? null,
      targetName: diceRoll.targetName ?? diceRoll.mechanics?.checkName ?? null,
      rollContext: diceRoll.rollContext ?? 'generic',
      visibility: diceRoll.visibility ?? (diceRoll.hidden ? 'gmOnly' : 'public'),
      characterId: metadata.characterId ?? diceRoll.characterId ?? null,
      characterName: metadata.characterName ?? diceRoll.characterName ?? null
    });
  }

  sendMapTokenDragPreview(payload: MapTokenDragPreviewPayload) {
    return this.sendJson({
      action: 'broadcastMapTokenDrag',
      phase: 'dragging',
      ...payload
    });
  }

  close() {
    this.manuallyClosed = true;
    this.clearReconnect();
    this.clearPlannedReconnect();

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscription('unsubscribeCharacterSheet', this.activeSubscription);
      this.sendMapSubscription('unsubscribeSessionMap', this.activeMapSubscription);
    }

    this.activeSubscription = null;
    this.activeMapSubscription = null;
    this.socket?.close(1000, 'Leaving live RPG session');
    this.socket = null;
    this.options.onStatusChange?.('closed');
  }

  private scheduleReconnect() {
    this.clearReconnect();
    this.reconnectTimeout = setTimeout(() => {
      if (!this.manuallyClosed) {
        this.connect();
      }
    }, this.options.reconnectDelayMs ?? 3000);
  }

  private schedulePlannedReconnect() {
    this.clearPlannedReconnect();

    this.plannedReconnectTimeout = setTimeout(() => {
      if (this.manuallyClosed) {
        return;
      }

      const socket = this.socket;
      this.socket = null;
      socket?.close(1000, 'Scheduled reconnect before AWS WebSocket timeout');
      void this.connect();
    }, this.options.maxConnectionAgeMs ?? defaultMaxConnectionAgeMs);
  }

  private clearReconnect() {
    if (!this.reconnectTimeout) {
      return;
    }

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
  }

  private clearPlannedReconnect() {
    if (!this.plannedReconnectTimeout) {
      return;
    }

    clearTimeout(this.plannedReconnectTimeout);
    this.plannedReconnectTimeout = null;
  }

  private sendSubscription(
    action: 'subscribeCharacterSheet' | 'unsubscribeCharacterSheet',
    subscription: CharacterSheetSubscription | null
  ) {
    if (!subscription || this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        action,
        userId: subscription.userId,
        characterId: subscription.characterId
      })
    );
  }

  private sendMapSubscription(
    action: 'subscribeSessionMap' | 'unsubscribeSessionMap',
    subscription: SessionMapSubscription | null
  ) {
    if (!subscription || this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        action,
        sessionId: subscription.sessionId,
        mapId: subscription.mapId
      })
    );
  }

  private sendJson(payload: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(JSON.stringify(payload));
    return true;
  }

  private handleMessage(data: unknown) {
    if (typeof data !== 'string') {
      return;
    }

    try {
      this.options.onEvent?.(JSON.parse(data) as CharacterSheetLiveEvent);
    } catch {
      this.options.onError?.('Backend wysłał nieprawidłową wiadomość live session.');
    }
  }
}
