import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.ts';
import type { TextKey } from '../i18n/keys.ts';
import type { OutputSettings } from '../pipeline/types.ts';
import { loadProfiles, MAX_PROFILE_NAME, MAX_PROFILES, PROFILES_KEY, sameProfileContext, updateProfiles, type ProcessingProfile, type ProfileContext } from './profiles.ts';

type Props = ProfileContext & {
  batch: OutputSettings;
  onApply: (profile: ProcessingProfile) => void;
};

type Feedback = { key: TextKey; error?: true };

export function ProfilesPanel(props: Props) {
  const [profiles, setProfiles] = useState<ProcessingProfile[] | null>(null);
  const [feedback, setFeedback] = useState<(Feedback & { scope: string }) | null>(null);
  const scope = `${props.deviceId ?? 'custom'}:${props.outputMode}`;
  const changes = useRef<BroadcastChannel | null>(null);
  const readId = useRef(0);
  const refreshProfiles = useCallback(async () => {
    const id = ++readId.current;
    const list = await loadProfiles();
    if (id === readId.current) setProfiles(list);
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

  return (
    <ProfileControls
      key={scope}
      {...props}
      compatible={profiles?.filter((profile) => sameProfileContext(profile, props))}
      feedback={feedback && (feedback.scope === scope || feedback.key === 'profiles.storage') ? feedback : null}
      onFeedback={(next) => setFeedback(next && { ...next, scope })}
      onChange={async (change) => {
        const result = await updateProfiles(change);
        if ('profiles' in result) {
          changes.current?.postMessage(null);
          await refreshProfiles();
        }
        return result;
      }}
    />
  );
}

type ControlsProps = Props & {
  compatible: ProcessingProfile[] | undefined;
  feedback: Feedback | null;
  onFeedback: (feedback: Feedback | null) => void;
  onChange: typeof updateProfiles;
};

function ProfileControls({ batch, onApply, compatible, feedback, onFeedback, onChange, ...context }: ControlsProps) {
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

  return (
    <section class="profiles" aria-labelledby="profiles-title" aria-busy={pending || compatible === undefined}>
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
