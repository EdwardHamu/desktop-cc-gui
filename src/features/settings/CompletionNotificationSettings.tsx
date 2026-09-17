import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/base/switch/switch";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "@/components/application/settings/settings-rows";
import type { AppSettings } from "@/lib/ipc";

type AlertPatch = Pick<AppSettings, "sessionCompletionToast" | "sessionCompletionSound">;
export function CompletionNotificationSettings({ settings, onSave }: {
  settings: AppSettings;
  onSave: (patch: Partial<AlertPatch>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const save = async (patch: Partial<AlertPatch>) => {
    setSaving(true);
    try { await onSave(patch); }
    finally { setSaving(false); }
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <SettingsSectionLabel>{t("completionNotifications.heading")}</SettingsSectionLabel>
      <SettingsCard>
        <SettingsRow label={t("completionNotifications.toast")} description={t("completionNotifications.toastDescription")}>
          <Switch size="sm" aria-label={t("completionNotifications.toast")}
            isDisabled={saving} isSelected={settings.sessionCompletionToast ?? false}
            onChange={(value) => void save({ sessionCompletionToast: value })} />
        </SettingsRow>
        <SettingsRow label={t("completionNotifications.sound")} description={t("completionNotifications.soundDescription")}>
          <Switch size="sm" aria-label={t("completionNotifications.sound")}
            isDisabled={saving} isSelected={settings.sessionCompletionSound ?? false}
            onChange={(value) => void save({ sessionCompletionSound: value })} />
        </SettingsRow>
      </SettingsCard>
      <p className="text-caption-1-regular text-text-tertiary">{t("completionNotifications.note")}</p>
    </div>
  );
}
