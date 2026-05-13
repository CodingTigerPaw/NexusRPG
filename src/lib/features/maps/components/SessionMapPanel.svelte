<script lang="ts">
  import { Dialog } from "bits-ui";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    createSessionAssetUploadUrl,
    createSessionMap,
    createSessionMapToken,
    deleteSessionAsset,
    deleteSessionMap,
    deleteSessionTokenTemplate,
    deleteSessionMapToken,
    getSessionMap,
    getSessionAssets,
    getSessionTokenTemplates,
    updateSessionMap,
    updateSessionMapToken,
    uploadMapAssetToS3
  } from "../api";
  import AddMapTokenDialog from "./AddMapTokenDialog.svelte";
  import MapCanvas from "./MapCanvas.svelte";
  import type {
    MapDimensions,
    MapGridSettings,
    MapGridType,
    MapPosition,
    MapTokenTemplate,
    SessionAsset,
    SessionMap,
    SessionMapToken
  } from "../types";

  export type MapTokenOwnerOption = {
    userId: string;
    label: string;
    characterId?: string | null;
  };

  type Props = {
    sessionId: string;
    map: SessionMap | null;
    canManageMap: boolean;
    canDeleteMapTokens?: boolean;
    canAssignMapTokenOwners?: boolean;
    currentUserId?: string;
    fitContainer?: boolean;
    ownerOptions?: MapTokenOwnerOption[];
    liveStatus?: string;
    tokenPositions?: Record<string, MapPosition>;
    onMapCreated?: (map: SessionMap) => void;
    onMapUpdated?: (map: SessionMap) => void;
    onMapDeleted?: (mapId: string) => void;
    onMapTokenCreated?: (token: SessionMapToken) => void;
    onMapTokenUpdated?: (token: SessionMapToken) => void;
    onMapTokenDeleted?: (tokenId: string) => void;
    onMapTokenDragPreview?: (token: SessionMapToken, position: MapPosition) => void;
    onMapTokenDrop?: (token: SessionMapToken, position: MapPosition) => void;
  };

  const allowedMapTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const maxMapAssetBytes = 10 * 1024 * 1024;

  // Mapa jest stanem sesji, nie aktywnej postaci, dlatego komponent przyjmuje
  // własny model mapy zamiast czytać dane z aktualnie wybranej karty.
  let {
    sessionId,
    map,
    canManageMap,
    canDeleteMapTokens = false,
    canAssignMapTokenOwners = false,
    currentUserId,
    fitContainer = false,
    ownerOptions = [],
    liveStatus = "disabled",
    tokenPositions = {},
    onMapCreated,
    onMapUpdated,
    onMapDeleted,
    onMapTokenCreated,
    onMapTokenUpdated,
    onMapTokenDeleted,
    onMapTokenDragPreview,
    onMapTokenDrop
  }: Props = $props();

  let mapName = $state("");
  let selectedMapFile = $state<File | null>(null);
  let isUploadingMap = $state(false);
  let uploadMessage = $state("");
  let isMapUploadOpen = $state(false);
  let mapAssets = $state<SessionAsset[]>([]);
  let loadedMapAssetSessionId = $state("");
  let mapAssetLoadRequestId = 0;
  let isLoadingMapAssets = $state(false);
  let loadingMapAssetIds = $state<string[]>([]);
  let deletingMapAssetIds = $state<string[]>([]);
  let isDeletingActiveMap = $state(false);
  let isAddTokenOpen = $state(false);
  let isLayoutSettingsOpen = $state(false);
  let isTokenLibraryOpen = $state(false);
  let isTokenOwnershipOpen = $state(false);
  let tokenTemplates = $state<MapTokenTemplate[]>([]);
  let loadedTokenTemplateSessionId = $state("");
  let tokenTemplateLoadRequestId = 0;
  let isLoadingTokenTemplates = $state(false);
  let placingTokenTemplateId = $state<string | null>(null);
  let deletingTokenTemplateIds = $state<string[]>([]);
  let deletingTokenIds = $state<string[]>([]);
  let tokenListMessage = $state("");
  let assigningTokenIds = $state<string[]>([]);
  let layoutType = $state<MapGridType | "none">("none");
  let layoutCellSize = $state("72");
  let layoutOpacity = $state("0.45");
  let isSavingLayout = $state(false);
  let layoutMessage = $state("");

  $effect(() => {
    const grid = map?.grid;

    layoutType = grid?.enabled ? grid.type : "none";
    layoutCellSize = String(grid?.cellSize ?? 72);
    layoutOpacity = String(grid?.opacity ?? 0.45);
  });

  $effect(() => {
    if (!canManageMap || !sessionId) {
      mapAssets = [];
      loadedMapAssetSessionId = "";
      tokenTemplates = [];
      loadedTokenTemplateSessionId = "";
      return;
    }

    if (loadedMapAssetSessionId !== sessionId) {
      loadedMapAssetSessionId = sessionId;
      void loadMapAssets();
    }

    if (loadedTokenTemplateSessionId === sessionId) {
      return;
    }

    loadedTokenTemplateSessionId = sessionId;
    void loadTokenTemplates();
  });

  function isAllowedMapType(mimeType: string): mimeType is (typeof allowedMapTypes)[number] {
    return allowedMapTypes.includes(mimeType as (typeof allowedMapTypes)[number]);
  }

  function getDefaultMapName(file: File) {
    return file.name.replace(/\.[^.]+$/, "").trim();
  }

  function formatDimensions(dimensions: MapDimensions | null | undefined) {
    return dimensions ? `${dimensions.width} x ${dimensions.height}` : null;
  }

  function mapAssetLabel(asset: SessionAsset) {
    return asset.label?.trim() || asset.fileName?.replace(/\.[^.]+$/, "").trim() || "Mapa sesji";
  }

  function readImageDimensions(file: File) {
    return new Promise<MapDimensions>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.addEventListener("load", () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight
        });
      });
      image.addEventListener("error", () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Nie udało się odczytać wymiarów obrazu mapy."));
      });
      image.src = objectUrl;
    });
  }

  function handleMapFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    selectedMapFile = file;
    uploadMessage = "";

    if (file && !mapName.trim()) {
      mapName = getDefaultMapName(file);
    }
  }

  function validateMapFile(file: File) {
    if (!isAllowedMapType(file.type)) {
      throw new Error("Obsługiwane formaty mapy to JPEG, PNG, WebP albo GIF.");
    }

    if (file.size > maxMapAssetBytes) {
      throw new Error("Mapa może mieć maksymalnie 10 MB.");
    }
  }

  function readPositiveNumber(value: string, fallback: number) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
  }

  function readOpacity(value: string) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0.45;
    }

    return Math.min(1, Math.max(0.05, numericValue));
  }

  function buildLayoutGrid(): MapGridSettings | null {
    if (layoutType === "none") {
      return null;
    }

    return {
      enabled: true,
      type: layoutType,
      cellSize: readPositiveNumber(layoutCellSize, map?.grid?.cellSize ?? 72),
      color: map?.grid?.color ?? "rgba(255,255,255,0.65)",
      opacity: readOpacity(layoutOpacity),
      offsetX: map?.grid?.offsetX ?? 0,
      offsetY: map?.grid?.offsetY ?? 0
    };
  }

  function ownerLabel(userId: string | null | undefined) {
    if (!userId) {
      return "Bez właściciela";
    }

    return ownerOptions.find((option) => option.userId === userId)?.label ?? userId;
  }

  function handleTokenTemplateCreated(template: MapTokenTemplate) {
    tokenTemplates = [
      template,
      ...tokenTemplates.filter((entry) => entry.templateId !== template.templateId)
    ];
    tokenListMessage = "Token został dodany do listy.";
  }

  async function loadMapAssets() {
    const requestId = ++mapAssetLoadRequestId;
    isLoadingMapAssets = true;
    uploadMessage = "";

    try {
      const response = await getSessionAssets(sessionId, { kind: "map" });

      if (requestId !== mapAssetLoadRequestId) {
        return;
      }

      mapAssets = response.assets;
    } catch (error) {
      if (requestId === mapAssetLoadRequestId) {
        uploadMessage =
          error instanceof Error ? error.message : "Nie udało się pobrać biblioteki map.";
      }
    } finally {
      if (requestId === mapAssetLoadRequestId) {
        isLoadingMapAssets = false;
      }
    }
  }

  function templateSize(template: MapTokenTemplate) {
    return (
      template.defaultSize ??
      template.size ?? {
        width: 0.08,
        height: 0.08,
        unit: "relative" as const
      }
    );
  }

  function templateVisibility(template: MapTokenTemplate) {
    return template.defaultVisibility ?? template.visibility ?? "public";
  }

  function templateLockState(template: MapTokenTemplate) {
    return template.defaultLockState ?? template.lockState ?? "unlocked";
  }

  function templateLayer(template: MapTokenTemplate) {
    return template.defaultLayer ?? template.layer ?? "token";
  }

  async function loadTokenTemplates() {
    const requestId = ++tokenTemplateLoadRequestId;
    isLoadingTokenTemplates = true;
    tokenListMessage = "";

    try {
      const response = await getSessionTokenTemplates(sessionId);

      if (requestId !== tokenTemplateLoadRequestId) {
        return;
      }

      tokenTemplates = response.tokenTemplates;
    } catch (error) {
      if (requestId === tokenTemplateLoadRequestId) {
        tokenListMessage =
          error instanceof Error ? error.message : "Nie udało się pobrać biblioteki tokenów.";
      }
    } finally {
      if (requestId === tokenTemplateLoadRequestId) {
        isLoadingTokenTemplates = false;
      }
    }
  }

  async function placeTokenTemplate(template: MapTokenTemplate) {
    if (!map || placingTokenTemplateId) {
      return;
    }

    placingTokenTemplateId = template.templateId;
    tokenListMessage = "";

    try {
      // Kliknięcie szablonu tworzy nową instancję backendową, więc ten sam token
      // z listy może pojawić się na mapie wiele razy jako osobne wystąpienia.
      const token = await createSessionMapToken(sessionId, map.mapId, {
        label: template.label,
        // Szablony korzystają z nowych assetów sesji. Wysyłamy pełny obiekt assetu,
        // bo starsza ścieżka `assetId` może szukać tylko w globalnej tabeli MapAssets.
        asset: template.asset,
        position: { x: 0.5, y: 0.5 },
        size: templateSize(template),
        visibility: templateVisibility(template),
        lockState: templateLockState(template),
        layer: templateLayer(template)
      });

      onMapTokenCreated?.(token);
      tokenListMessage = `Dodano instancję tokena "${template.label}" na środku mapy.`;
    } catch (error) {
      tokenListMessage =
        error instanceof Error ? error.message : "Nie udało się umieścić tokena na mapie.";
    } finally {
      placingTokenTemplateId = null;
    }
  }

  async function deleteTokenTemplate(template: MapTokenTemplate) {
    if (deletingTokenTemplateIds.includes(template.templateId)) {
      return;
    }

    deletingTokenTemplateIds = [...deletingTokenTemplateIds, template.templateId];
    tokenListMessage = "";

    try {
      // Usunięcie szablonu nie dotyka instancji stojących na mapie ani assetu S3.
      // To pozwala GM porządkować bibliotekę bez niszczenia aktualnej sceny.
      await deleteSessionTokenTemplate(sessionId, template.templateId);
      tokenTemplates = tokenTemplates.filter((entry) => entry.templateId !== template.templateId);
      tokenListMessage = `Usunięto szablon tokena "${template.label}".`;
    } catch (error) {
      tokenListMessage =
        error instanceof Error ? error.message : "Nie udało się usunąć szablonu tokena.";
    } finally {
      deletingTokenTemplateIds = deletingTokenTemplateIds.filter(
        (entry) => entry !== template.templateId
      );
    }
  }

  async function deleteTokenFromMap(token: SessionMapToken) {
    if (!map || deletingTokenIds.includes(token.tokenId)) {
      return;
    }

    deletingTokenIds = [...deletingTokenIds, token.tokenId];
    tokenListMessage = "";

    try {
      // Usuwamy wyłącznie instancję z mapy; szablon na liście zostaje, bo jest
      // reużywalnym źródłem kolejnych wystąpień tego samego tokena.
      await deleteSessionMapToken(sessionId, map.mapId, token.tokenId);
      onMapTokenDeleted?.(token.tokenId);
      tokenListMessage = `Usunięto token "${token.label}" z mapy.`;
    } catch (error) {
      tokenListMessage =
        error instanceof Error ? error.message : "Nie udało się usunąć tokena z mapy.";
    } finally {
      deletingTokenIds = deletingTokenIds.filter((entry) => entry !== token.tokenId);
    }
  }

  async function assignTokenOwner(token: SessionMapToken, ownerUserId: string) {
    if (!map || assigningTokenIds.includes(token.tokenId)) {
      return;
    }

    assigningTokenIds = [...assigningTokenIds, token.tokenId];
    tokenListMessage = "";

    const selectedOwner = ownerOptions.find((option) => option.userId === ownerUserId);

    try {
      // Ownership zapisujemy na instancji tokena, bo ten sam szablon tokena może mieć
      // wiele wystąpień przypisanych do różnych graczy w tej samej scenie.
      const updatedToken = await updateSessionMapToken(sessionId, map.mapId, token.tokenId, {
        ownership: {
          ownerUserId: ownerUserId || null,
          characterId: selectedOwner?.characterId ?? null,
          controlledByUserIds: []
        },
        version: token.version
      });

      onMapTokenUpdated?.(updatedToken);
      tokenListMessage = ownerUserId
        ? `Token "${token.label}" przypisano do: ${ownerLabel(ownerUserId)}.`
        : `Token "${token.label}" nie ma już właściciela.`;
    } catch (error) {
      tokenListMessage =
        error instanceof Error ? error.message : "Nie udało się przypisać właściciela tokena.";
    } finally {
      assigningTokenIds = assigningTokenIds.filter((entry) => entry !== token.tokenId);
    }
  }

  async function saveLayoutSettings() {
    if (!map || isSavingLayout) {
      return;
    }

    isSavingLayout = true;
    layoutMessage = "";

    try {
      const grid = buildLayoutGrid();
      let updatedMap: SessionMap;

      try {
        updatedMap = await updateSessionMap(sessionId, map.mapId, {
          grid,
          version: map.version
        });
      } catch (error) {
        if (!isSessionMapVersionConflict(error)) {
          throw error;
        }

        // Ruch tokena może podbić wersję agregatu mapy szybciej niż lokalny stan
        // dostanie pełne odświeżenie, więc przy konflikcie pobieramy bieżącą mapę
        // i ponawiamy tylko zamierzoną zmianę layoutu.
        const freshMap = await getSessionMap(sessionId, map.mapId);
        updatedMap = await updateSessionMap(sessionId, map.mapId, {
          grid,
          version: freshMap.version
        });
      }

      onMapUpdated?.({
        ...map,
        ...updatedMap,
        tokens: updatedMap.tokens?.length ? updatedMap.tokens : map.tokens
      });
      layoutMessage = "Layout mapy został zapisany.";
    } catch (error) {
      layoutMessage =
        error instanceof Error ? error.message : "Nie udało się zapisać layoutu mapy.";
    } finally {
      isSavingLayout = false;
    }
  }

  function isSessionMapVersionConflict(error: unknown) {
    return error instanceof Error && error.message.toLowerCase().includes("version conflict");
  }

  async function loadMapAssetToScreen(asset: SessionAsset) {
    if (loadingMapAssetIds.includes(asset.assetId)) {
      return;
    }

    loadingMapAssetIds = [...loadingMapAssetIds, asset.assetId];
    uploadMessage = "";

    const dimensions = asset.dimensions;
    const name = mapAssetLabel(asset);

    try {
      if (map) {
        // Wybór z biblioteki zmienia tło aktywnego stołu, ale nie kasuje tokenów.
        // Instancje tokenów są osobnym stanem sceny i nie powinny znikać przez samą zmianę assetu.
        const updatedMap = await updateSessionMap(sessionId, map.mapId, {
          name,
          asset,
          dimensions,
          version: map.version
        });

        onMapUpdated?.({
          ...map,
          ...updatedMap,
          tokens: updatedMap.tokens?.length ? updatedMap.tokens : map.tokens
        });
      } else {
        const createdMap = await createSessionMap(sessionId, {
          name,
          asset,
          dimensions,
          defaultViewport: {
            center: { x: 0.5, y: 0.5 },
            zoom: 1
          }
        });

        onMapCreated?.(createdMap);
      }

      uploadMessage = `Mapa "${name}" została załadowana na stół.`;
      isMapUploadOpen = false;
    } catch (error) {
      uploadMessage =
        error instanceof Error ? error.message : "Nie udało się załadować mapy na stół.";
    } finally {
      loadingMapAssetIds = loadingMapAssetIds.filter((entry) => entry !== asset.assetId);
    }
  }

  async function deleteActiveMapFromBattleMap() {
    if (!map || isDeletingActiveMap) {
      return;
    }

    const confirmed = confirm(
      `Usunąć aktywną mapę "${map.name ?? "Mapa aktywna"}" z battlemapy? Wgrany asset zostanie w bibliotece.`
    );

    if (!confirmed) {
      return;
    }

    const deletedMapId = map.mapId;
    isDeletingActiveMap = true;
    uploadMessage = "";

    try {
      // Usuwamy scenę battlemapy, a nie asset obrazu, żeby biblioteka map
      // pozostawała reużywalnym źródłem kolejnych scen i przyszłych wariantów.
      await deleteSessionMap(sessionId, deletedMapId);
      onMapDeleted?.(deletedMapId);
      uploadMessage = "Aktywna mapa została usunięta z battlemapy.";
    } catch (error) {
      uploadMessage =
        error instanceof Error ? error.message : "Nie udało się usunąć aktywnej mapy.";
    } finally {
      isDeletingActiveMap = false;
    }
  }

  async function deleteMapAssetFromLibrary(asset: SessionAsset) {
    if (deletingMapAssetIds.includes(asset.assetId)) {
      return;
    }

    deletingMapAssetIds = [...deletingMapAssetIds, asset.assetId];
    uploadMessage = "";

    try {
      await deleteSessionAsset(sessionId, asset.assetId);
      mapAssets = mapAssets.filter((entry) => entry.assetId !== asset.assetId);
      uploadMessage = `Usunięto mapę "${mapAssetLabel(asset)}" z biblioteki.`;
    } catch (error) {
      uploadMessage =
        error instanceof Error ? error.message : "Nie udało się usunąć mapy z biblioteki.";
    } finally {
      deletingMapAssetIds = deletingMapAssetIds.filter((entry) => entry !== asset.assetId);
    }
  }

  async function uploadSelectedMap() {
    if (!selectedMapFile || isUploadingMap) {
      return;
    }

    isUploadingMap = true;
    uploadMessage = "";

    try {
      validateMapFile(selectedMapFile);

      // Wymiary zapisujemy już w rekordzie assetu, bo późniejszy canvas i tokeny
      // będą potrzebowały stabilnego układu niezależnego od rozmiaru ekranu klienta.
      const dimensions = await readImageDimensions(selectedMapFile);
      const label = mapName.trim() || getDefaultMapName(selectedMapFile);
      const uploadTarget = await createSessionAssetUploadUrl(sessionId, {
        kind: "map",
        label,
        fileName: selectedMapFile.name,
        mimeType: selectedMapFile.type,
        sizeBytes: selectedMapFile.size,
        dimensions
      });

      await uploadMapAssetToS3(uploadTarget.uploadUrl, selectedMapFile, uploadTarget.headers);

      // Upload mapy tworzy asset biblioteki. Samo załadowanie na stół zostaje
      // osobną decyzją GM, tak jak token z biblioteki dopiero potem tworzy instancję.
      const uploadedAsset: SessionAsset = {
        sessionId,
        assetId: uploadTarget.assetId,
        kind: "map",
        url: uploadTarget.assetUrl,
        fileName: selectedMapFile.name,
        mimeType: selectedMapFile.type,
        label,
        dimensions,
        sizeBytes: selectedMapFile.size,
        ...uploadTarget.asset
      };

      mapAssets = [
        uploadedAsset,
        ...mapAssets.filter((entry) => entry.assetId !== uploadedAsset.assetId)
      ];
      selectedMapFile = null;
      mapName = "";
      uploadMessage = "Mapa została dodana do biblioteki. Wybierz ją z listy, aby załadować na stół.";
    } catch (error) {
      uploadMessage = error instanceof Error ? error.message : "Nie udało się dodać mapy.";
    } finally {
      isUploadingMap = false;
    }
  }
</script>

<Card class={["border-border/80 bg-card/95", fitContainer ? "flex h-full min-h-0 flex-col" : ""]}>
  {#if !fitContainer}
    <CardHeader class="gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <CardTitle>Mapa sesji</CardTitle>
        <CardDescription>
          {#if map}
            {map.name ?? "Mapa aktywna"} · tokeny: {map.tokens.length}
          {:else if canManageMap}
            Przygotowane miejsce na mapę dla tej sesji.
          {:else}
            GM nie dodał jeszcze mapy do tej sesji.
          {/if}
        </CardDescription>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span class="rounded-md border bg-background/60 px-2 py-1">Live: {liveStatus}</span>
        {#if canManageMap}
          <span class="rounded-md border bg-background/60 px-2 py-1">Tryb GM</span>
          <Button type="button" variant="outline" onclick={() => (isMapUploadOpen = true)}>
            {map ? "Zmień mapę" : "Dodaj mapę"}
          </Button>
        {/if}
        {#if canManageMap && map}
          <Button type="button" variant="outline" onclick={() => (isLayoutSettingsOpen = true)}>
            Layout
          </Button>
          <Button type="button" variant="outline" onclick={() => (isAddTokenOpen = true)}>
            Dodaj token
          </Button>
          <Button type="button" variant="outline" onclick={() => (isTokenLibraryOpen = true)}>
            Tokeny
          </Button>
          <Button
            type="button"
            variant="outline"
            class="border-destructive/50 text-destructive hover:bg-destructive/10"
            disabled={isDeletingActiveMap}
            onclick={deleteActiveMapFromBattleMap}
          >
            {isDeletingActiveMap ? "Usuwanie..." : "Usuń mapę"}
          </Button>
        {/if}
        {#if canAssignMapTokenOwners && map && map.tokens.length > 0}
          <Button type="button" variant="outline" onclick={() => (isTokenOwnershipOpen = true)}>
            Właściciele
          </Button>
        {/if}
      </div>
    </CardHeader>
  {/if}

  <CardContent class={fitContainer ? "min-h-0 flex-1 overflow-hidden p-0" : ""}>
    {#if map}
      <div class={fitContainer ? "flex h-full min-h-0 flex-col" : "space-y-3"}>
        <div class={fitContainer ? "min-h-0 flex-1" : ""}>
          <MapCanvas
            {map}
            {canManageMap}
            {canDeleteMapTokens}
            {currentUserId}
            {fitContainer}
            {deletingTokenIds}
            {tokenPositions}
            onTokenDelete={canDeleteMapTokens ? deleteTokenFromMap : undefined}
            onTokenDragPreview={onMapTokenDragPreview}
            onTokenDrop={onMapTokenDrop}
          />
        </div>

        {#if !fitContainer}
          <div class="flex shrink-0 flex-wrap gap-2 text-xs text-muted-foreground">
            <span class="rounded-md border bg-background/60 px-2 py-1">ID sesji: {sessionId}</span>
            {#if formatDimensions(map.dimensions ?? map.asset.dimensions)}
              <span class="rounded-md border bg-background/60 px-2 py-1">
                {formatDimensions(map.dimensions ?? map.asset.dimensions)}
              </span>
            {/if}
            {#if map.version !== undefined}
              <span class="rounded-md border bg-background/60 px-2 py-1">Wersja: {map.version}</span>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Pusty stan zostaje tutaj, żeby /play nie musiał znać szczegółów przyszłego UX uploadu mapy. -->
      <div class="flex aspect-video items-center justify-center rounded-md border border-dashed bg-background/40 p-6">
        <div class="max-w-md text-center">
          <p class="text-sm font-medium">
            {canManageMap ? "Brak aktywnej mapy" : "Mapa nie jest jeszcze dostępna"}
          </p>
        </div>
      </div>
    {/if}
  </CardContent>
</Card>

{#if fitContainer && canManageMap}
  <div class="fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 rounded-lg border bg-background/90 p-2 shadow-lg backdrop-blur">
    <span class="sr-only">Kontrolki GM mapy</span>
    <Button
      type="button"
      size="sm"
      variant="outline"
      class="justify-start"
      onclick={() => (isMapUploadOpen = true)}
    >
      {map ? "Mapa" : "Dodaj mapę"}
    </Button>

    {#if map}
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="justify-start"
        onclick={() => (isLayoutSettingsOpen = true)}
      >
        Layout
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="justify-start"
        onclick={() => (isAddTokenOpen = true)}
      >
        + Token
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="justify-start"
        onclick={() => (isTokenLibraryOpen = true)}
      >
        Tokeny
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="justify-start border-destructive/50 text-destructive hover:bg-destructive/10"
        disabled={isDeletingActiveMap}
        onclick={deleteActiveMapFromBattleMap}
      >
        {isDeletingActiveMap ? "..." : "Usuń mapę"}
      </Button>
    {/if}

    {#if canAssignMapTokenOwners && map && map.tokens.length > 0}
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="justify-start"
        onclick={() => (isTokenOwnershipOpen = true)}
      >
        Właściciele
      </Button>
    {/if}
  </div>
{/if}

{#if canManageMap}
  <Dialog.Root open={isMapUploadOpen} onOpenChange={(open) => (isMapUploadOpen = open)}>
    <Dialog.Portal>
      <Dialog.Overlay class="ui-fade-in fixed inset-0 z-40 bg-black/50" />
      <Dialog.Content
        class="ui-dialog-in fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg"
      >
        <div class="space-y-1">
          <Dialog.Title class="text-lg font-semibold">
            Biblioteka map sesji
          </Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground">
            Wgrane mapy są trwałymi assetami sesji. Wybór z listy ładuje mapę na główny ekran stołu.
          </Dialog.Description>
        </div>

        <div class="mt-5 space-y-4">
          <div class="rounded-md border bg-background/40 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-medium">Wgrane mapy</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  Kliknij „Załaduj”, aby pokazać mapę wszystkim graczom.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingMapAssets}
                onclick={loadMapAssets}
              >
                Odśwież
              </Button>
            </div>

            {#if isLoadingMapAssets}
              <div class="mt-4 rounded-md border bg-background/60 px-3 py-4 text-center text-sm text-muted-foreground">
                Ładowanie map...
              </div>
            {:else if mapAssets.length > 0}
              <div class="mt-4 grid gap-2">
                {#each mapAssets as asset (asset.assetId)}
                  <div class="grid gap-3 rounded-md border bg-background p-2 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
                    <div class="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {#if asset.url}
                        <img class="h-full w-full object-cover" src={asset.url} alt="" />
                      {:else}
                        <span class="text-xs text-muted-foreground">Mapa</span>
                      {/if}
                    </div>

                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium">{mapAssetLabel(asset)}</p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        {formatDimensions(asset.dimensions) ?? "Brak wymiarów"}
                      </p>
                    </div>

                    <div class="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={Boolean(loadingMapAssetIds.length) || deletingMapAssetIds.includes(asset.assetId)}
                        onclick={() => loadMapAssetToScreen(asset)}
                      >
                        {loadingMapAssetIds.includes(asset.assetId) ? "Ładowanie..." : "Załaduj"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deletingMapAssetIds.includes(asset.assetId) || loadingMapAssetIds.includes(asset.assetId)}
                        onclick={() => deleteMapAssetFromLibrary(asset)}
                      >
                        {deletingMapAssetIds.includes(asset.assetId) ? "Usuwanie..." : "Usuń"}
                      </Button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="mt-4 rounded-md border border-dashed bg-background/60 px-3 py-4 text-center text-sm text-muted-foreground">
                Nie ma jeszcze zapisanych map w tej sesji.
              </div>
            {/if}
          </div>

          <div class="space-y-2">
            <Label for="session-map-name">Nazwa mapy</Label>
            <Input
              id="session-map-name"
              bind:value={mapName}
              disabled={isUploadingMap}
              placeholder="Piwnica domu Corbitta"
            />
          </div>

          <div class="space-y-2">
            <Label for="session-map-file">Plik mapy</Label>
            <Input
              id="session-map-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={isUploadingMap}
              onchange={handleMapFileChange}
            />
          </div>

          {#if uploadMessage}
            <p class="rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              {uploadMessage}
            </p>
          {/if}

          <div class="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isUploadingMap}
              onclick={() => (isMapUploadOpen = false)}
            >
              Zamknij
            </Button>
            <Button
              type="button"
              disabled={!selectedMapFile || isUploadingMap}
              onclick={uploadSelectedMap}
            >
              {isUploadingMap ? "Dodawanie..." : "Dodaj do biblioteki"}
            </Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

{#if canManageMap && map}
  <Dialog.Root open={isLayoutSettingsOpen} onOpenChange={(open) => (isLayoutSettingsOpen = open)}>
    <Dialog.Portal>
      <Dialog.Overlay class="ui-fade-in fixed inset-0 z-40 bg-black/50" />
      <Dialog.Content
        class="ui-dialog-in fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg"
      >
        <div class="space-y-1">
          <Dialog.Title class="text-lg font-semibold">Layout mapy</Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground">
            Siatkę trzymamy jako konfigurację mapy, bo te same współrzędne tokenów mogą później obsługiwać grid i hexy.
          </Dialog.Description>
        </div>

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label for="session-map-layout-type">Typ layoutu</Label>
            <select
              id="session-map-layout-type"
              class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              bind:value={layoutType}
              disabled={isSavingLayout}
            >
              <option value="none">Bez siatki</option>
              <option value="square">Grid kwadratowy</option>
              <option value="hex-vertical">Hex pionowy</option>
              <option value="hex-horizontal">Hex poziomy</option>
            </select>
          </div>

          <div class="space-y-2">
            <Label for="session-map-layout-cell-size">Rozmiar pola</Label>
            <Input
              id="session-map-layout-cell-size"
              type="number"
              min="8"
              step="1"
              bind:value={layoutCellSize}
              disabled={isSavingLayout || layoutType === "none"}
            />
          </div>

          <div class="space-y-2">
            <Label for="session-map-layout-opacity">Widoczność</Label>
            <Input
              id="session-map-layout-opacity"
              type="number"
              min="0.05"
              max="1"
              step="0.05"
              bind:value={layoutOpacity}
              disabled={isSavingLayout || layoutType === "none"}
            />
          </div>
        </div>

        {#if layoutMessage}
          <p class="mt-4 rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            {layoutMessage}
          </p>
        {/if}

        <div class="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSavingLayout}
            onclick={() => (isLayoutSettingsOpen = false)}
          >
            Zamknij
          </Button>
          <Button type="button" disabled={isSavingLayout} onclick={saveLayoutSettings}>
            {isSavingLayout ? "Zapisywanie..." : "Zapisz layout"}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>

  <Dialog.Root open={isTokenLibraryOpen} onOpenChange={(open) => (isTokenLibraryOpen = open)}>
    <Dialog.Portal>
      <Dialog.Overlay class="ui-fade-in fixed inset-0 z-40 bg-black/50" />
      <Dialog.Content
        class="ui-dialog-in fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="space-y-1">
            <Dialog.Title class="text-lg font-semibold">Tokeny wielokrotnego użycia</Dialog.Title>
            <Dialog.Description class="text-sm text-muted-foreground">
              Każde kliknięcie szablonu tworzy nową instancję na środku mapy.
            </Dialog.Description>
          </div>

          <Button type="button" variant="outline" onclick={() => (isAddTokenOpen = true)}>
            Dodaj token
          </Button>
        </div>

        {#if tokenListMessage}
          <p class="mt-4 rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            {tokenListMessage}
          </p>
        {/if}

        {#if isLoadingTokenTemplates}
          <div class="mt-5 rounded-md border bg-background/40 p-6 text-center text-sm text-muted-foreground">
            Ładowanie biblioteki tokenów...
          </div>
        {:else if tokenTemplates.length > 0}
          <div class="mt-5 flex flex-wrap gap-2">
            {#each tokenTemplates as template (template.templateId)}
              <div class="flex items-center rounded-md border bg-background text-sm">
                <button
                  type="button"
                  class="flex items-center gap-2 px-2 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={Boolean(placingTokenTemplateId) || deletingTokenTemplateIds.includes(template.templateId)}
                  onclick={() => placeTokenTemplate(template)}
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold text-muted-foreground">
                    {#if template.asset.url}
                      <img
                        class="h-full w-full object-cover"
                        src={template.asset.url}
                        alt=""
                      />
                    {:else}
                      {template.label.slice(0, 1).toUpperCase()}
                    {/if}
                  </span>
                  <span>
                    <span class="block font-medium">{template.label}</span>
                    <span class="block text-xs text-muted-foreground">
                      {placingTokenTemplateId === template.templateId
                        ? "Dodawanie instancji..."
                        : "Kliknij, aby dodać nową instancję"}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  class="self-stretch border-l px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Usuń szablon tokena ${template.label}`}
                  title="Usuń szablon z biblioteki"
                  disabled={deletingTokenTemplateIds.includes(template.templateId)}
                  onclick={() => deleteTokenTemplate(template)}
                >
                  {deletingTokenTemplateIds.includes(template.templateId) ? "..." : "Usuń"}
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="mt-5 rounded-md border border-dashed bg-background/40 p-6 text-center text-sm text-muted-foreground">
            Nie ma jeszcze zapisanych szablonów tokenów.
          </div>
        {/if}

        <div class="mt-5 flex justify-end">
          <Button type="button" variant="ghost" onclick={() => (isTokenLibraryOpen = false)}>
            Zamknij
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

{#if canAssignMapTokenOwners && map && map.tokens.length > 0}
  <Dialog.Root open={isTokenOwnershipOpen} onOpenChange={(open) => (isTokenOwnershipOpen = open)}>
    <Dialog.Portal>
      <Dialog.Overlay class="ui-fade-in fixed inset-0 z-40 bg-black/50" />
      <Dialog.Content
        class="ui-dialog-in fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg"
      >
        <div class="space-y-1">
          <Dialog.Title class="text-lg font-semibold">Właściciele tokenów</Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground">
            Ownership zapisujemy na instancji tokena, bo jeden szablon może reprezentować wiele postaci lub przeciwników.
          </Dialog.Description>
        </div>

        {#if tokenListMessage}
          <p class="mt-4 rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            {tokenListMessage}
          </p>
        {/if}

        <div class="mt-5 grid gap-2">
          {#each map.tokens as token (token.tokenId)}
            <div class="grid gap-2 rounded-md border bg-background px-3 py-2 sm:grid-cols-[1fr_16rem] sm:items-center">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{token.label}</p>
                <p class="text-xs text-muted-foreground">
                  Aktualnie: {ownerLabel(token.ownership?.ownerUserId)}
                </p>
              </div>

              <select
                class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={token.ownership?.ownerUserId ?? ""}
                disabled={assigningTokenIds.includes(token.tokenId)}
                onchange={(event) =>
                  assignTokenOwner(token, (event.currentTarget as HTMLSelectElement).value)}
              >
                <option value="">Bez właściciela</option>
                {#each ownerOptions as option (option.userId)}
                  <option value={option.userId}>{option.label}</option>
                {/each}
              </select>
            </div>
          {/each}
        </div>

        <div class="mt-5 flex justify-end">
          <Button type="button" variant="ghost" onclick={() => (isTokenOwnershipOpen = false)}>
            Zamknij
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

{#if canManageMap && map}
  <AddMapTokenDialog
    {sessionId}
    open={isAddTokenOpen}
    onOpenChange={(open) => (isAddTokenOpen = open)}
    onTokenTemplateCreated={handleTokenTemplateCreated}
  />
{/if}
