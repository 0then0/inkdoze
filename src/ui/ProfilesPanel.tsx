import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.ts';
import type { TextKey } from '../i18n/keys.ts';
import { sanitizeBaseName } from '../io/names.ts';
import type { OutputSettings } from '../pipeline/types.ts';
import { ProfileImportDialog } from './ProfileImportDialog.tsx';
import { encodeProfileFile, loadProfiles, MAX_PROFILE_NAME, MAX_PROFILES, PROFILES_KEY, sameProfileContext, updateProfiles, type ProcessingProfile, type ProfileContext } from './profiles.ts';
import { saveBlob } from './save.ts';

type Props = ProfileContext & {
  batch: OutputSettings;
  onApply: (profile: ProcessingProfile) => void;
};

type Feedback = { key: TextKey; error?: true };

export function ProfilesPanel(props: Props) {
  const [collection, setCollection] = useState<Awaited<ReturnType<typeof loadProfiles>> | null>(null);
  const [feedback, setFeedback] = useState<(Feedback & { scope: string }) | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const scope = `${props.deviceId ?? 'custom'}:${props.outputMode}`;
  const changes = useRef<BroadcastChannel | null>(null);
  const readId = useRef(0);
  const refreshProfiles = useCallback(async () => {
    const id = ++readId.current;
    const list = await loadProfiles();
    if (id === readId.current) setCollection(list);
  }, []);

  useEffect(() => {
    try {
      changes.current = new BroadcastChannel(PROFILES_KEY);
      changes.current.onmessage = () => void refreshProfiles();
    } catch {
      // Storage still works if cross-tab notifications are unavailable.
    }
    void refreshProfiles();
    return () => {
      readId.current = readId.current + 1;
      changes.current?.close();
      changes.current = null;
    };
  }, [refreshProfiles]);

  const changeProfiles: typeof updateProfiles = async (change) => {
    const result = await updateProfiles(change);
    if ('profiles' in result) {
      changes.current?.postMessage(null);
      await refreshProfiles();
    }
    return result;
  };
  const visibleFeedback = feedback && (feedback.scope === scope || feedback.key === 'profiles.storage') ? feedback : null;
  const readError: Feedback | null = collection && 'error' in collection ? { key: collection.error, error: true } : null;

  return (
    <>
      <ProfileControls
        key={scope}
        {...props}
        compatible={collection && 'profiles' in collection ? collection.profiles.filter((profile) => sameProfileContext(profile, props)) : undefined}
        loading={collection === null}
        feedback={visibleFeedback ?? readError}
        onFeedback={(next) => setFeedback(next && { ...next, scope })}
        onChange={changeProfiles}
        onImport={() => {
          setFeedback(null);
          setImportOpen(true);
        }}
      />
      {importOpen && <ProfileImportDialog
        onChange={changeProfiles}
        onClose={() => setImportOpen(false)}
        onSaved={() => {
          setImportOpen(false);
          setFeedback({ scope, key: 'profiles.imported' });
        }}
      />}
    </>
  );
}

type ControlsProps = Props & {
  compatible: ProcessingProfile[] | undefined;
  loading: boolean;
  feedback: Feedback | null;
  onFeedback: (feedback: Feedback | null) => void;
  onChange: typeof updateProfiles;
  onImport: () => void;
};

function ProfileControls({ batch, onApply, compatible, loading, feedback, onFeedback, onChange, onImport, ...context }: ControlsProps) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState('');
  const [editor, setEditor] = useState<'save' | 'rename' | null>(null);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const writing = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const selected = compatible?.find(({ id }) => id === selectedId);

  useEffect(() => {
    if (editor) nameInput.current?.focus();
  }, [editor]);

  const editName = (mode: 'save' | 'rename') => {
    if (editor === mode) {
      nameInput.current?.focus();
      return;
    }
    onFeedback(null);
    setName(mode === 'rename' ? selected?.name ?? '' : '');
    setEditor(mode);
  };

  const changeProfile = async (change: Parameters<typeof updateProfiles>[0], success: TextKey) => {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    onFeedback(null);
    const result = await onChange(change);
    writing.current = false;
    setPending(false);
    if ('error' in result) {
      onFeedback({ key: result.error, error: true });
      return;
    }
    setSelectedId(result.selectedId);
    setEditor(null);
    onFeedback({ key: success });
    const trigger = change.type === 'rename' ? renameButton : saveButton;
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const exportProfile = () => {
    if (!selected) return;
    onFeedback(null);
    try {
      const json = new Blob([encodeProfileFile(selected)], { type: 'application/json' });
      saveBlob(json, `${sanitizeBaseName(`inkdoze-profile-${selected.name}`)}.json`);
    } catch {
      onFeedback({ key: 'profiles.exportFailed', error: true });
    }
  };

  return (
    <section class="profiles" aria-labelledby="profiles-title" aria-busy={pending || loading}>
      <h3 id="profiles-title">{t('profiles.title')}</h3>
      {compatible?.length ? (
        <>
          <select aria-labelledby="profiles-title" title={selected?.name} value={selected?.id ?? ''} disabled={pending} onChange={(e) => {
            setSelectedId(e.currentTarget.value);
            setEditor(null);
            onFeedback(null);
          }}>
            <option value="">{t('profiles.choose')}</option>
            {compatible.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
          <div class="profile-actions">
            <button type="button" class="button small" disabled={!selected || pending} aria-describedby="profile-priority" onClick={() => {
              if (!selected) return;
              onApply(selected);
              onFeedback({ key: 'profiles.applied' });
            }}>
              {t('profiles.apply')}
            </button>
            <button type="button" class="button small" ref={renameButton} disabled={!selected || pending} aria-expanded={editor === 'rename'} onClick={() => editName('rename')}>
              {t('profiles.rename')}
            </button>
            <button type="button" class="button small" disabled={!selected || pending} onClick={() => selected && void changeProfile({ type: 'delete', id: selected.id }, 'profiles.deleted')}>
              {t('profiles.delete')}
            </button>
          </div>
          <p class="hint" id="profile-priority">{t('profiles.priority')}</p>
        </>
      ) : compatible && <p class="hint">{t('profiles.empty')}</p>}
      <button type="button" class="link-button" ref={saveButton} disabled={pending} aria-expanded={editor === 'save'} onClick={() => editName('save')}>
        {t('profiles.saveBatch')}
      </button>
      <div class="profile-actions">
        <button type="button" class="button small" disabled={pending} aria-haspopup="dialog" onClick={(e) => {
          e.currentTarget.focus();
          onImport();
        }}>{t('profiles.import')}</button>
        <button type="button" class="button small" disabled={!selected || pending} onClick={exportProfile}>{t('profiles.export')}</button>
      </div>
      {editor && (
        <form class="field" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (editor === 'save') void changeProfile({ type: 'save', ...context, name, settings: batch }, 'profiles.saved');
          else void changeProfile({ type: 'rename', id: selectedId, name }, 'profiles.renamed');
        }}>
          <label class="field-label" for="profile-name">{t('profiles.name')}</label>
          <input id="profile-name" ref={nameInput} type="text" value={name} required maxLength={MAX_PROFILE_NAME} readOnly={pending}
            aria-invalid={feedback?.key === 'profiles.invalidName' || feedback?.key === 'profiles.duplicate'}
            aria-describedby={feedback?.error ? 'profile-feedback' : undefined}
            onInput={(e) => {
              setName(e.currentTarget.value);
              onFeedback(null);
            }} />
          <div class="profile-actions">
            <button type="submit" class="button small" disabled={pending}>{t('profiles.save')}</button>
            <button type="button" class="button ghost small" disabled={pending} onClick={() => {
              (editor === 'rename' ? renameButton : saveButton).current?.focus();
              setEditor(null);
              onFeedback(null);
            }}>{t('crop.cancel')}</button>
          </div>
        </form>
      )}
      {feedback && (
        <p id="profile-feedback" class={`hint${feedback.error ? ' warn-text' : ''}`} role={feedback.error ? 'alert' : 'status'}>
          {t(feedback.key, { length: MAX_PROFILE_NAME, max: MAX_PROFILES })}
        </p>
      )}
    </section>
  );
}
