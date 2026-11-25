import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getDevice } from '../catalog/index.ts';
import { generationLabel, useI18n, type Params } from '../i18n/index.ts';
import type { TextKey } from '../i18n/keys.ts';
import { displayName } from './DevicePanel.tsx';
import { loadProfiles, MAX_PROFILE_FILE_BYTES, MAX_PROFILE_NAME, MAX_PROFILES, readProfileFile, suggestProfileName, type ProfileData, type updateProfiles } from './profiles.ts';

type Props = {
  onChange: typeof updateProfiles;
  onClose: () => void;
  onSaved: () => void;
};

const FIT = { fit: 'settings.fitFit', fill: 'settings.fitFill', stretch: 'settings.fitStretch' } as const;
const TARGET = { device: 'settings.targetDevice', original: 'settings.targetOriginal', custom: 'settings.targetCustom' } as const;
const COLOUR = { auto: 'settings.colorAuto', color: 'settings.color', grayscale: 'settings.grayscale' } as const;
const DITHER = { none: 'settings.ditherNone', 'floyd-steinberg': 'settings.ditherFs', atkinson: 'settings.ditherAtkinson' } as const;

function ProfileSummary({ profile }: { profile: ProfileData }) {
  const tr = useI18n();
  const { t, locale } = tr;
  const device = profile.deviceId === null ? undefined : getDevice(profile.deviceId);
  const rows: Array<[TextKey, string]> = [
    ['profiles.name', profile.name],
    ['device.title', device ? `${displayName(device)} · ${generationLabel(device, tr)}` : t('device.custom')],
    ['overlay.mode', t(profile.outputMode === 'standard' ? 'overlay.standard' : 'method.crosspoint-overlay')],
  ];
  if (profile.outputMode === 'standard') {
    const s = profile.settings;
    const number = new Intl.NumberFormat(locale);
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumSignificantDigits: 21 });
    rows.push(
      ['settings.size', t(TARGET[s.target])],
      ['device.custom', t('preview.size', { w: s.customWidth, h: s.customHeight })],
      ['settings.fit', t(FIT[s.fit])],
      ['settings.background', s.background],
      ['settings.colorMode', t(COLOUR[s.colorMode])],
      ['settings.auto', t(s.autoTone ? 'profiles.on' : 'profiles.off')],
      ['settings.brightness', number.format(s.brightness)],
      ['settings.contrast', number.format(s.contrast)],
      ['settings.invert', t(s.invert ? 'profiles.on' : 'profiles.off')],
      ['settings.levels', t(`settings.levels${s.levels}`)],
      ['settings.dither', t(DITHER[s.dither])],
      ['settings.format', t(s.format === 'auto' ? 'settings.colorAuto' : `format.${s.format}`)],
      ['settings.quality', percent.format(s.jpegQuality)],
    );
  } else {
    rows.push(['settings.fit', t(FIT[profile.settings.fit])]);
  }
  return (
    <dl class="profile-summary">
      {rows.map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

type Draft = { profile: ProfileData; newName?: string };
type ImportFeedback = { key: TextKey; params?: Params };

export function ProfileImportDialog({ onChange, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);

  useLayoutEffect(() => {
    const d = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    d?.showModal();
    chooseButton.current?.focus();
    return () => {
      d?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const chooseFile = async (file: File) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setDraft(null);
    setFeedback(null);
    const result = await readProfileFile(file);
    if ('error' in result) {
      setFeedback({ key: result.error });
      requestAnimationFrame(() => chooseButton.current?.focus());
    } else {
      const { profile } = result;
      const collection = await loadProfiles();
      const newName = 'profiles' in collection ? suggestProfileName(collection.profiles, profile) : undefined;
      setDraft({ profile, newName });
      if (newName !== undefined) setFeedback({ key: 'profiles.importConflict', params: { name: profile.name } });
      else if ('error' in collection) setFeedback({ key: collection.error });
      requestAnimationFrame(() => title.current?.focus());
    }
    operation.current = false;
    setBusy(false);
  };

  const save = async () => {
    if (!draft || operation.current) return;
    operation.current = true;
    setBusy(true);
    setFeedback(null);
    const name = draft.newName ?? draft.profile.name;
    const result = await onChange({ type: 'save', ...draft.profile, name });
    operation.current = false;
    setBusy(false);
    if ('profiles' in result) {
      onSaved();
    } else if (result.error === 'profiles.duplicate') {
      setDraft({ ...draft, newName: result.suggestedName });
      setFeedback({ key: 'profiles.importConflict', params: { name } });
      requestAnimationFrame(() => nameInput.current?.focus());
    } else {
      setFeedback({ key: result.error });
      requestAnimationFrame(() => (result.error === 'profiles.invalidName' ? nameInput.current : title.current)?.focus());
    }
  };

  return (
    <dialog ref={dialog} class="profile-import-dialog" aria-labelledby="profile-import-title" onCancel={(e) => {
      // The file picker can dispatch its own bubbling cancel event.
      if (e.target !== e.currentTarget) return;
      e.preventDefault();
      if (!operation.current) onClose();
    }}>
      <h3 id="profile-import-title" ref={title} tabIndex={-1}>{t('profiles.import')}</h3>
      <form class="profile-import-form" aria-busy={busy} noValidate onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void chooseFile(file);
        }} />
        {feedback && <p class="hint warn-text" id="profile-import-feedback" role="alert">
          {t(feedback.key, { length: MAX_PROFILE_NAME, max: MAX_PROFILES, maxKiB: MAX_PROFILE_FILE_BYTES / 1024, ...feedback.params })}
        </p>}
        {draft?.newName !== undefined && <div class="field">
          <label class="field-label" for="profile-import-name">{t('profiles.importName')}</label>
          <input id="profile-import-name" ref={nameInput} type="text" value={draft.newName} maxLength={MAX_PROFILE_NAME}
            required readOnly={busy} aria-invalid={feedback?.key === 'profiles.invalidName'}
            aria-describedby={feedback ? 'profile-import-feedback' : undefined} onInput={(e) => {
              setDraft({ ...draft, newName: e.currentTarget.value });
              setFeedback(null);
            }} />
        </div>}
        {draft && <ProfileSummary profile={draft.profile} />}
        <div class="dialog-actions">
          {draft && <button type="submit" class="button primary" disabled={busy}>{t('profiles.save')}</button>}
          <button type="button" ref={chooseButton} class={`button${draft ? '' : ' primary'}`} disabled={busy} onClick={() => fileInput.current?.click()}>
            {t(draft || feedback ? 'profiles.chooseAnotherFile' : 'profiles.chooseFile')}
          </button>
          <button type="button" class="button ghost" disabled={busy} onClick={onClose}>{t('crop.cancel')}</button>
        </div>
      </form>
    </dialog>
  );
}
