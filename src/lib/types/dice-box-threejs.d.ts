declare module '@3d-dice/dice-box-threejs' {
  export type DiceBoxOptions = Record<string, unknown>;

  export default class DiceBox {
    rolling?: boolean;
    diceList?: unknown[];
    scene?: unknown;
    camera?: { position?: { z?: number } };
    renderer?: { domElement?: HTMLElement };

    constructor(selector: string, options?: DiceBoxOptions);

    initialize(): Promise<void>;
    roll(notation: string): Promise<unknown>;
    reroll?(diceIndexes: number[]): Promise<unknown>;
    clear?(): void;
    dispose?(): void;
  }
}
