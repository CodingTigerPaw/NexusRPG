<script lang="ts">
  import { Dialog } from "bits-ui";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    createSessionAssetUploadUrl,
    createSessionTokenTemplate,
    uploadMapAssetToS3
  } from "../api";
  import type { MapAsset, MapDimensions, MapTokenTemplate, MapTokenVisibility } from "../types";

  type Props = {
    sessionId: string;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    onTokenTemplateCreated?: (template: MapTokenTemplate) => void;
  };

  const allowedTokenTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const maxTokenAssetBytes = 2 * 1024 * 1024;

  let { sessionId, open, onOpenChange, onTokenTemplateCreated }: Props = $props();
  let tokenName = $state("");
  let tokenFile = $state<File | null>(null);
  let visibility = $state<MapTokenVisibility>("public");
  let sizePercent = $state("8");
  let isSaving = $state(false);
  let message = $state("");

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isSaving) {
      resetForm();
    }

    onOpenChange?.(nextOpen);
  }

  function resetForm() {
    tokenName = "";
    tokenFile = null;
    visibility = "public";
    sizePercent = "8";
    message = "";
  }

  function isAllowedTokenType(mimeType: string): mimeType is (typeof allowedTokenTypes)[number] {
    return allowedTokenTypes.includes(mimeType as (typeof allowedTokenTypes)[number]);
  }

  function getDefaultTokenName(file: File) {
    return file.name.replace(/\.[^.]+$/, "").trim();
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
        reject(new Error("Nie udało się odczytać wymiarów obrazu tokena."));
      });
      image.src = objectUrl;
    });
  }

  function handleTokenFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    tokenFile = file;
    message = "";

    if (file && !tokenName.trim()) {
      tokenName = getDefaultTokenName(file);
    }
  }

  function readPercent(value: string, label: string, min: number, max: number) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) {
      throw new Error(`${label} musi być liczbą w zakresie ${min}..${max}.`);
    }

    return numericValue;
  }

  function validateTokenFile(file: File) {
    if (!isAllowedTokenType(file.type)) {
      throw new Error("Obsługiwane formaty tokena to JPEG, PNG, WebP albo GIF.");
    }

    if (file.size > maxTokenAssetBytes) {
      throw new Error("Token może mieć maksymalnie 2 MB.");
    }
  }

  async function submitToken(event: SubmitEvent) {
    event.preventDefault();

    if (!tokenFile || isSaving) {
      return;
    }

    const label = tokenName.trim();

    if (!label) {
      message = "Nazwa tokena jest wymagana.";
      return;
    }

    isSaving = true;
    message = "";

    try {
      validateTokenFile(tokenFile);

      const size = readPercent(sizePercent, "Rozmiar tokena", 2, 30) / 100;
      const dimensions = await readImageDimensions(tokenFile);

      // Token zapisujemy jako asset sesji, nie lokalny stan UI, bo biblioteka GM
      // ma przetrwać odświeżenie strony i być dostępna niezależnie od aktywnej mapy.
      const uploadTarget = await createSessionAssetUploadUrl(sessionId, {
        kind: "token",
        label,
        fileName: tokenFile.name,
        mimeType: tokenFile.type,
        sizeBytes: tokenFile.size,
        dimensions
      });

      await uploadMapAssetToS3(uploadTarget.uploadUrl, tokenFile, uploadTarget.headers);

      const asset: MapAsset = {
        assetId: uploadTarget.assetId,
        kind: "token",
        url: uploadTarget.assetUrl,
        fileName: tokenFile.name,
        mimeType: tokenFile.type,
        dimensions,
        sizeBytes: tokenFile.size,
        ...uploadTarget.asset
      };
      const defaultSize = {
        width: size,
        height: size,
        unit: "relative" as const
      };
      const createdTemplate = await createSessionTokenTemplate(sessionId, {
        label,
        assetId: uploadTarget.assetId,
        defaultSize,
        defaultVisibility: visibility,
        defaultLockState: "unlocked",
        defaultLayer: "token"
      });

      // Backend jest źródłem prawdy dla ID szablonu, a frontend uzupełnia asset
      // natychmiast po uploadzie, żeby lista mogła renderować miniaturę bez kolejnego GET.
      onTokenTemplateCreated?.({
        ...createdTemplate,
        sessionId: createdTemplate.sessionId ?? sessionId,
        label: createdTemplate.label ?? label,
        assetId: createdTemplate.assetId ?? uploadTarget.assetId,
        asset: createdTemplate.asset ?? asset,
        defaultSize: createdTemplate.defaultSize ?? defaultSize,
        defaultVisibility: createdTemplate.defaultVisibility ?? visibility,
        defaultLockState: createdTemplate.defaultLockState ?? "unlocked",
        defaultLayer: createdTemplate.defaultLayer ?? "token"
      });

      resetForm();
      onOpenChange?.(false);
    } catch (error) {
      message = error instanceof Error ? error.message : "Nie udało się dodać tokena.";
    } finally {
      isSaving = false;
    }
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="ui-fade-in fixed inset-0 z-40 bg-black/50" />
    <Dialog.Content
      class="ui-dialog-in fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg"
    >
      <div class="space-y-1">
        <Dialog.Title class="text-lg font-semibold">Dodaj token</Dialog.Title>
        <Dialog.Description class="text-sm text-muted-foreground">
          Token trafi na listę pod mapą. Każde kliknięcie na liście utworzy nową instancję na środku.
        </Dialog.Description>
      </div>

      <form class="mt-5 space-y-4" onsubmit={submitToken}>
        <div class="space-y-2">
          <Label for="map-token-name">Nazwa tokena</Label>
          <Input
            id="map-token-name"
            bind:value={tokenName}
            disabled={isSaving}
            placeholder="Kultysta"
          />
        </div>

        <div class="space-y-2">
          <Label for="map-token-file">Obraz tokena</Label>
          <Input
            id="map-token-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={isSaving}
            onchange={handleTokenFileChange}
          />
        </div>

        <div class="space-y-2">
          <Label for="map-token-visibility">Widoczność</Label>
          <select
            id="map-token-visibility"
            class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            bind:value={visibility}
            disabled={isSaving}
          >
            <option value="public">Publiczny</option>
            <option value="gmOnly">Tylko GM</option>
            <option value="hidden">Ukryty</option>
          </select>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="map-token-size">Rozmiar (%)</Label>
            <Input
              id="map-token-size"
              type="number"
              min="2"
              max="30"
              bind:value={sizePercent}
              disabled={isSaving}
            />
          </div>
        </div>

        {#if message}
          <p class="rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        {/if}

        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onclick={() => handleOpenChange(false)}
          >
            Anuluj
          </Button>
          <Button type="submit" disabled={!tokenFile || isSaving}>
            {isSaving ? "Dodawanie..." : "Dodaj do listy"}
          </Button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
