/**
 * Appearance → wallpaper rows (fork feature).
 *
 * Kept out of GeneralSection so the upstream file stays a thin host: this
 * owns the picker, the sliders, and broadcasting the live preview.
 */
import type { Key } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";

import { Select, SelectItem } from "@/components/base/select/select";
import { Switch } from "@/components/base/switch/switch";
import { SettingsRow } from "@/components/application/settings/settings-rows";
import { publishWallpaperChange } from "@/features/theme/WorkspaceWallpaperGate";
import {
  MAX_WALLPAPER_BLUR,
  MAX_WALLPAPER_DARKEN,
  MIN_WALLPAPER_BLUR,
  MIN_WALLPAPER_DARKEN,
  resolveWorkspaceWallpaper,
  WALLPAPER_IMAGE_EXTENSIONS,
  WALLPAPER_VIDEO_EXTENSIONS,
  wallpaperFileName,
  WORKSPACE_WALLPAPER_OBJECT_FITS,
  type WorkspaceWallpaperSettings,
} from "@/features/theme/workspaceWallpaper";

const SELECT_TRIGGER = "h-8 w-auto gap-1 rounded-lg px-2 py-1.5";

export function WallpaperSettings({
  value,
  onChange,
}: {
  value: WorkspaceWallpaperSettings;
  /** Persist a patch; the parent owns the read-modify-write save. */
  onChange: (next: WorkspaceWallpaperSettings) => void;
}) {
  const { t } = useTranslation();

  // Push to the live layer immediately, then let the parent persist: the
  // wallpaper is the one setting where you want to see the result instantly.
  const apply = (patch: Partial<WorkspaceWallpaperSettings>) => {
    const next = resolveWorkspaceWallpaper({ ...value, ...patch });
    publishWallpaperChange(next);
    onChange(next);
  };

  const pickFile = async () => {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: t("settings.wallpaperMediaFilter"),
          extensions: [...WALLPAPER_IMAGE_EXTENSIONS, ...WALLPAPER_VIDEO_EXTENSIONS],
        },
      ],
    });
    if (typeof picked === "string" && picked.trim() !== "") {
      apply({ mediaPath: picked, mode: "custom" });
    }
  };

  const active = value.mode === "custom" && value.mediaPath !== null;

  return (
    <>
      <SettingsRow label={t("settings.wallpaper")}>
        <div className="flex items-center gap-2">
          {active && (
            <span
              className="max-w-[160px] truncate text-body-regular text-text-secondary"
              title={value.mediaPath ?? undefined}
            >
              {wallpaperFileName(value.mediaPath ?? "")}
            </span>
          )}
          <button
            type="button"
            onClick={() => void pickFile()}
            className="h-8 cursor-pointer rounded-lg border border-border-button-default px-2 py-1.5 text-body-regular text-text-primary transition-colors hover:bg-background-primary-hover"
          >
            {active ? t("settings.wallpaperChange") : t("settings.wallpaperChoose")}
          </button>
          {active && (
            <button
              type="button"
              onClick={() => apply({ mode: "none", mediaPath: null })}
              className="h-8 cursor-pointer rounded-lg border border-border-button-default px-2 py-1.5 text-body-regular text-text-secondary transition-colors hover:bg-background-primary-hover"
            >
              {t("settings.wallpaperClear")}
            </button>
          )}
        </div>
      </SettingsRow>

      {active && (
        <>
          <SettingsRow label={t("settings.wallpaperFit")}>
            <Select
              aria-label={t("settings.wallpaperFit")}
              selectedKey={value.objectFit}
              onSelectionChange={(key: Key | null) => {
                if (key != null) apply({ objectFit: String(key) as never });
              }}
              triggerClassName={SELECT_TRIGGER}
            >
              {WORKSPACE_WALLPAPER_OBJECT_FITS.map((fit) => (
                <SelectItem key={fit} id={fit}>
                  {t(`settings.wallpaperFit_${fit}`)}
                </SelectItem>
              ))}
            </Select>
          </SettingsRow>

          <SettingsRow label={t("settings.wallpaperBlur")}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                aria-label={t("settings.wallpaperBlur")}
                min={MIN_WALLPAPER_BLUR}
                max={MAX_WALLPAPER_BLUR}
                value={value.blur}
                onChange={(e) => apply({ blur: Number(e.target.value) })}
                className="w-32 cursor-pointer"
              />
              <span className="w-10 text-right text-body-regular text-text-secondary tabular-nums">
                {value.blur}px
              </span>
            </div>
          </SettingsRow>

          <SettingsRow label={t("settings.wallpaperDarken")}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                aria-label={t("settings.wallpaperDarken")}
                min={MIN_WALLPAPER_DARKEN}
                max={MAX_WALLPAPER_DARKEN}
                value={value.darken}
                onChange={(e) => apply({ darken: Number(e.target.value) })}
                className="w-32 cursor-pointer"
              />
              <span className="w-10 text-right text-body-regular text-text-secondary tabular-nums">
                {value.darken}%
              </span>
            </div>
          </SettingsRow>

          <SettingsRow label={t("settings.wallpaperPaused")}>
            <Switch
              aria-label={t("settings.wallpaperPaused")}
              isSelected={value.paused}
              onChange={(paused: boolean) => apply({ paused })}
            />
          </SettingsRow>
        </>
      )}
    </>
  );
}
