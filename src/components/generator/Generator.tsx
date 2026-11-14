import { useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  appCatalogue,
  builds,
  defaults,
  locales,
  MAX_FILE_BYTES,
  passes,
  timeZones,
  type Account,
  type Options,
  type Result,
} from '../../lib/unattend/types';
import {
  exportBundle,
  exportSettings,
  inspectImported,
  parseImport,
  type ImportedProfile,
} from '../../lib/unattend/bundle';
import { generateUnattend } from '../../lib/unattend/generate';
import { OptionsError, validateOptions } from '../../lib/unattend/validate';

const sections = [
  'Profile',
  'Region',
  'Windows Setup',
  'Accounts',
  'System',
  'Apps & scripts',
  'Advanced',
];
const intros = [
  'Name this configuration. Unset options stay interactive in Windows Setup.',
  'Set the language your image contains and the region your users work in.',
  'Choose the image and how Setup should handle the destination disk.',
  'Name the device and create local accounts, or let Windows ask.',
  'Configure the first-run experience, domain join and driver folders.',
  'Remove selected provisioned apps and run commands at first sign-in.',
  'Add hardware bypasses or settings beyond the guided form.',
];
type Format = 'kyro' | 'xml' | 'settings';
function issueLabel(path: string): string {
  const labels: Record<string, string> = {
    name: 'Profile name',
    description: 'Description',
    windowsBuilds: 'Windows builds',
    language: 'Display language',
    userLocale: 'Regional format',
    systemLocale: 'System locale',
    keyboard: 'Keyboard layouts',
    timeZone: 'Time zone',
    editionMode: 'Image selection',
    editionValue: 'Windows image',
    diskMode: 'Partitioning',
    diskNumber: 'Disk number',
    diskLayout: 'GPT layout',
    confirmWipe: 'Disk wipe confirmation',
    efiSize: 'EFI partition',
    recoverySize: 'Recovery partition',
    computerName: 'Computer name',
    accounts: 'Local accounts',
    autoLogon: 'Automatic sign-in',
    autoLogonCount: 'Sign-in count',
    oobe: 'First-run experience',
    domain: 'Domain join',
    driversPE: 'Windows PE drivers',
    driversSystem: 'System drivers',
    removeApps: 'App removal',
    scripts: 'First-logon scripts',
    bypass: 'Hardware bypass',
    fragments: 'XML fragments',
    xml: 'Answer file XML',
  };
  const [field, index] = path.split('.');
  const label = labels[field ?? ''] ?? 'Configuration';
  return index && /^\d+$/.test(index) ? `${label}, item ${Number(index) + 1}` : label;
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ComponentChildren;
}) {
  return (
    <label class="g-field">
      <span class="g-label">{label}</span>
      {children}
      {hint && <span class="g-hint">{hint}</span>}
    </label>
  );
}
function Text({
  label,
  hint,
  value,
  change,
  placeholder,
  password = false,
  multi = false,
  code = false,
}: {
  label: string;
  hint?: string;
  value: string;
  change: (s: string) => void;
  placeholder?: string;
  password?: boolean;
  multi?: boolean;
  code?: boolean;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      {multi ? (
        <textarea
          class={code ? 'g-code-input' : ''}
          rows={code ? 7 : 3}
          value={value}
          onInput={(e) => change(e.currentTarget.value)}
          placeholder={placeholder ?? ''}
          spellcheck={!code}
        />
      ) : (
        <input
          type={password ? 'password' : 'text'}
          autoComplete={password ? 'new-password' : 'off'}
          value={value}
          onInput={(e) => change(e.currentTarget.value)}
          placeholder={placeholder ?? ''}
          spellcheck={false}
        />
      )}
    </Field>
  );
}
function Check({
  label,
  hint,
  checked,
  change,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  change: (v: boolean) => void;
}) {
  return (
    <label class="g-check">
      <input type="checkbox" checked={checked} onChange={(e) => change(e.currentTarget.checked)} />
      <span>
        <span class="g-label">{label}</span>
        {hint && <span class="g-hint">{hint}</span>}
      </span>
    </label>
  );
}
function Select({
  label,
  value,
  change,
  choices,
}: {
  label: string;
  value: string;
  change: (s: string) => void;
  choices: readonly (readonly [string, string])[];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => change(e.currentTarget.value)}>
        {choices.map(([v, title]) => (
          <option value={v}>{title}</option>
        ))}
      </select>
    </Field>
  );
}
function NumberField({
  label,
  value,
  change,
  min,
  max,
}: {
  label: string;
  value: number;
  change: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onInput={(e) => change(e.currentTarget.valueAsNumber)}
      />
    </Field>
  );
}
function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <section class="g-group">
      <h3>{title}</h3>
      {hint && <p class="g-hint">{hint}</p>}
      <div class="g-stack">{children}</div>
    </section>
  );
}
function saveFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function LineList({
  label,
  hint,
  values,
  change,
}: {
  label: string;
  hint: string;
  values: string[];
  change: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState(values.join('\n'));
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={3}
        value={draft}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onChange={(e) =>
          change(
            e.currentTarget.value
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    </Field>
  );
}

export default function Generator() {
  const [o, setOptions] = useState<Options>(defaults);
  const [active, setActive] = useState(0);
  const [format, setFormat] = useState<Format>('kyro');
  const [notice, setNotice] = useState('');
  const [importError, setImportError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [imported, setImported] = useState<ImportedProfile | null>(null);
  const [confirmedImportWipe, setConfirmedImportWipe] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const patch = (value: Partial<Options>) => {
    setOptions((prev) => ({ ...prev, ...value }));
    setReviewed(false);
    setNotice('');
  };
  const account = (i: number, change: Partial<Account>) =>
    patch({
      accounts: o.accounts.map((a, n) => (n === i ? { ...a, ...change } : a)),
      ...(o.autoLogon !== '' && change.name !== undefined && o.accounts[i]?.name === o.autoLogon
        ? { autoLogon: change.name }
        : {}),
    });
  const generated = useMemo((): {
    result?: Result;
    errors: { path: string; message: string }[];
  } => {
    try {
      const errors = validateOptions(o);
      if (errors.length) return { errors };
      return {
        result: imported
          ? inspectImported(imported.xml, imported.warnings, imported.wipesDisk)
          : generateUnattend(o),
        errors: [],
      };
    } catch (e) {
      return {
        errors:
          e instanceof OptionsError
            ? e.issues
            : [
                {
                  path: 'xml',
                  message: e instanceof Error ? e.message : 'Could not generate this file.',
                },
              ],
      };
    }
  }, [o, imported]);
  const output = useMemo(() => {
    if (!generated.result) return { text: '', error: '' };
    try {
      const text =
        format === 'kyro'
          ? exportBundle(o, generated.result, imported?.windowsBuilds)
          : format === 'settings'
            ? exportSettings(o)
            : generated.result.xml;
      if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
        throw new Error('Output exceeds the 2 MiB limit. Reduce script or XML content.');
      return { text, error: '' };
    } catch (e) {
      return { text: '', error: e instanceof Error ? e.message : 'Could not export.' };
    }
  }, [o, generated, format, imported]);
  const warnings = generated.result?.warnings ?? [];
  const needsReview = warnings.some((w) => w.severity === 'warning');
  const blockedWipe = imported && generated.result?.wipesDisk && !confirmedImportWipe;
  const canExport =
    !!output.text &&
    !blockedWipe &&
    (!needsReview || reviewed) &&
    !(imported && format === 'settings');
  const fileName =
    format === 'kyro'
      ? `${o.name}.kyro.json`
      : format === 'settings'
        ? `${o.name}.settings.json`
        : 'autounattend.xml';
  const configured = [
    true,
    !!(o.language || o.userLocale || o.keyboard || o.timeZone || o.systemLocale),
    o.acceptEula || o.diskMode !== 'interactive' || o.editionMode !== 'interactive',
    !!(o.accounts.length || o.computerName),
    o.domain.enabled ||
      !!(o.driversPE.length || o.driversSystem.length) ||
      Object.values(o.oobe).some(Boolean),
    !!(o.scripts.length || o.removeApps.length),
    !!(o.bypass.length || o.fragments.length),
  ];
  const openSection = (n: number, focus = false) => {
    setActive(n);
    if (focus) requestAnimationFrame(() => document.getElementById('g-section-heading')?.focus());
  };
  const tabKey = (e: KeyboardEvent, i: number) => {
    const next =
      e.key === 'ArrowRight'
        ? (i + 1) % 7
        : e.key === 'ArrowLeft'
          ? (i + 6) % 7
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 6
              : -1;
    if (next >= 0) {
      e.preventDefault();
      openSection(next);
      document.getElementById(`g-tab-${next}`)?.focus();
    }
  };
  async function load(file?: File) {
    if (!file) return;
    setLoading(true);
    setImportError('');
    setNotice('');
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('Choose a file smaller than 2 MiB.');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const parsed = parseImport(text);
      if (parsed.kind === 'settings') {
        setOptions(parsed.options);
        setImported(null);
        setActive(0);
        setNotice(
          'Settings loaded. Review the profile and reconfirm any disk wipe before exporting.',
        );
      } else {
        const name =
          parsed.profile.name ||
          file.name
            .replace(/\.(kyro\.json|xml|json)$/i, '')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/^-+/, '')
            .slice(0, 63) ||
          'imported-profile';
        setOptions({ ...defaults(), name, description: parsed.profile.description });
        setImported(parsed.profile);
        setActive(0);
        setFormat('kyro');
        setNotice(
          'Profile imported. Its XML is preserved in the editor; you can edit the bundle metadata here.',
        );
      }
      setReviewed(false);
      setConfirmedImportWipe(false);
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : 'Could not read the file. Choose a UTF-8 file.',
      );
    } finally {
      setLoading(false);
      if (importInput.current) importInput.current.value = '';
    }
  }
  function reset() {
    setOptions(defaults());
    setImported(null);
    setActive(0);
    setReviewed(false);
    setConfirmedImportWipe(false);
    setImportError('');
    setNotice('Configuration reset. Windows Setup will ask for all unset options.');
    setFormat('kyro');
    resetDialog.current?.close();
  }
  function download() {
    if (!canExport) return;
    saveFile(
      output.text,
      fileName,
      format === 'xml' ? 'application/xml;charset=utf-8' : 'application/json;charset=utf-8',
    );
    setNotice(
      `Downloaded ${fileName}. ${format === 'kyro' ? 'Import it on your Kyro server using the command below.' : format === 'settings' ? 'Load this settings file here to edit it later.' : 'Place it at the root of your Windows installation media, or import it into Kyro.'}`,
    );
  }
  return (
    <div class="g-app">
      <div class="g-toolbar">
        <p>
          <span class="g-status-mark" aria-hidden="true" />
          Browser only<span class="g-toolbar-note"> · No account. No uploads. No autosave.</span>
        </p>
        <div class="g-toolbar-actions">
          <input
            class="sr-only"
            type="file"
            accept=".json,.xml"
            ref={importInput}
            onChange={(e) => {
              void load(e.currentTarget.files?.[0]);
            }}
            tabIndex={-1}
            aria-label="Import profile file"
          />
          <button type="button" onClick={() => importInput.current?.click()} disabled={loading}>
            {loading ? 'Reading file…' : 'Import file'}
          </button>
          <button type="button" onClick={() => resetDialog.current?.showModal()}>
            Reset
          </button>
        </div>
      </div>
      <p class="g-notice" role="status" aria-live="polite">
        {notice || (loading ? 'Reading and validating the file…' : '')}
      </p>
      {importError && (
        <p class="g-error" role="alert">
          Import failed: {importError}
        </p>
      )}
      <div class="g-workspace">
        <div class="g-config">
          {!imported && (
            <div class="g-tabs" role="tablist" aria-label="Configuration sections">
              {sections.map((title, i) => (
                <button
                  type="button"
                  role="tab"
                  id={`g-tab-${i}`}
                  aria-controls="g-panel"
                  aria-selected={active === i}
                  tabIndex={active === i ? 0 : -1}
                  onClick={() => openSection(i)}
                  onKeyDown={(e) => tabKey(e, i)}
                >
                  <span class={`g-step ${configured[i] ? 'is-set' : ''}`} aria-hidden="true">
                    {i + 1}
                  </span>
                  {title}
                  <span class="sr-only">
                    {configured[i] ? ', configured' : ', interactive or unset'}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div
            class="g-form-panel"
            id="g-panel"
            role={imported ? undefined : 'tabpanel'}
            aria-labelledby={imported ? 'g-section-heading' : `g-tab-${active}`}
          >
            <div class="g-form-heading">
              <div>
                <p class="g-eyebrow">
                  {imported
                    ? 'Imported profile'
                    : `Configuration ${String(active + 1).padStart(2, '0')} / 07`}
                </p>
                <h2 id="g-section-heading" tabIndex={-1}>
                  {imported ? 'Review your answer file' : sections[active]}
                </h2>
              </div>
              <a class="g-review-link" href="#g-output">
                Review output
              </a>
            </div>
            <p class="g-intro">
              {imported
                ? 'Edit metadata and XML below. Reset this configuration to return to the guided form.'
                : intros[active]}
            </p>
            {(active === 0 || imported) && (
              <>
                <Text
                  label="Profile name"
                  hint="Kyro profile ID: 1 to 63 lowercase letters, digits or hyphens; start with a letter or digit."
                  value={o.name}
                  change={(name) => patch({ name })}
                />
                <Text
                  label="Description"
                  hint="Optional. Up to 2000 UTF-8 bytes, as supported by Kyro."
                  multi
                  value={o.description}
                  change={(description) => patch({ description })}
                />
                {imported ? (
                  <p class="g-callout">
                    Imported target builds:{' '}
                    <strong>
                      {imported.windowsBuilds.join(', ') || 'No restriction declared'}
                    </strong>
                    . Preserved in the bundle.
                  </p>
                ) : (
                  <Group
                    title="Windows 11 target builds"
                    hint="Declares compatibility in Kyro. This does not select or download an ISO; both builds use the same answer file."
                  >
                    <div class="g-two">
                      {(Object.keys(builds) as (keyof typeof builds)[]).map((b) => (
                        <Check
                          label={`${b} · build ${builds[b]}`}
                          checked={o.windowsBuilds.includes(b)}
                          change={(v) =>
                            patch({
                              windowsBuilds: (
                                Object.keys(builds) as (keyof typeof builds)[]
                              ).filter((k) => (k === b ? v : o.windowsBuilds.includes(k))),
                            })
                          }
                        />
                      ))}
                    </div>
                  </Group>
                )}
                {!imported && (
                  <div class="g-callout">
                    <strong>Start with the essentials.</strong>
                    <p>
                      Language, image selection, a target disk, and an account are the main choices
                      for an unattended install. Each section marks what you have configured.
                    </p>
                  </div>
                )}
                <p class="g-hint">
                  Target: Windows 11, x64, UEFI/GPT. Generated settings have not yet been verified
                  in a Windows installation. Test your profile in a VM before deploying.
                </p>
              </>
            )}
            {imported && (
              <>
                <Text
                  label="Answer file XML"
                  hint="Preserved exactly as edited. It is not translated into guided form settings."
                  multi
                  code
                  value={imported.xml}
                  change={(xml) => {
                    setImported({ ...imported, xml });
                    setReviewed(false);
                    setConfirmedImportWipe(false);
                    setNotice('');
                  }}
                />
                {generated.result?.wipesDisk && (
                  <Check
                    label="I have reviewed and accept the imported disk changes"
                    checked={confirmedImportWipe}
                    change={setConfirmedImportWipe}
                  />
                )}
              </>
            )}
            {!imported && active === 1 && (
              <>
                <Select
                  label="Windows display language"
                  value={o.language}
                  change={(v) =>
                    patch({ language: v, userLocale: v, systemLocale: v, keyboard: v })
                  }
                  choices={[
                    ['', 'Ask during setup'],
                    ...locales.map(([id, title]) => [id, `${title} · ${id}`] as const),
                  ]}
                />
                <p class="g-hint">
                  The language must already be present in the ISO. Choosing one fills the defaults
                  below.
                </p>
                <div class="g-two">
                  <Text
                    label="Regional format"
                    value={o.userLocale}
                    placeholder="Unset, e.g. de-DE"
                    change={(userLocale) => patch({ userLocale })}
                  />
                  <Text
                    label="System locale"
                    value={o.systemLocale}
                    placeholder="Unset, e.g. de-DE"
                    change={(systemLocale) => patch({ systemLocale })}
                  />
                </div>
                <Text
                  label="Keyboard layouts"
                  hint="Locale codes or layout IDs separated by semicolons; the first is the default."
                  value={o.keyboard}
                  placeholder="Unset, e.g. en-US;de-DE"
                  change={(keyboard) => patch({ keyboard })}
                />
                <Field
                  label="Time zone"
                  hint="A Windows time zone ID. Leave blank for the regional default."
                >
                  <input
                    list="g-timezones"
                    value={o.timeZone}
                    placeholder="Unset, e.g. W. Europe Standard Time"
                    onInput={(e) => patch({ timeZone: e.currentTarget.value })}
                  />
                </Field>
                <datalist id="g-timezones">
                  {timeZones.map((id) => (
                    <option value={id} />
                  ))}
                </datalist>
              </>
            )}
            {!imported && active === 2 && (
              <>
                <Group
                  title="Windows image"
                  hint={
                    <>
                      List images on your ISO with{' '}
                      <code>DISM /Get-ImageInfo /ImageFile:D:\sources\install.wim</code>.
                    </>
                  }
                >
                  <Select
                    label="Image selection"
                    value={o.editionMode}
                    change={(v) =>
                      patch({ editionMode: v as Options['editionMode'], editionValue: '' })
                    }
                    choices={[
                      ['interactive', 'Ask during setup'],
                      ['index', 'Select by image index'],
                      ['name', 'Select by image name'],
                      ['key', 'Use my product key'],
                    ]}
                  />
                  {o.editionMode !== 'interactive' && (
                    <Text
                      label={
                        o.editionMode === 'index'
                          ? 'Image index'
                          : o.editionMode === 'name'
                            ? 'Exact image name'
                            : 'Product key'
                      }
                      hint={
                        o.editionMode === 'key'
                          ? 'Stored in the output. Activation still requires a valid license.'
                          : 'Must match an image in your media.'
                      }
                      value={o.editionValue}
                      password={o.editionMode === 'key'}
                      change={(editionValue) => patch({ editionValue })}
                    />
                  )}
                  <Check
                    label="Accept Microsoft Software License Terms"
                    hint="Accepts the terms for every machine installed with this profile."
                    checked={o.acceptEula}
                    change={(acceptEula) => patch({ acceptEula })}
                  />
                </Group>
                <Group
                  title="Destination disk"
                  hint="Disk numbers are not guaranteed to be the same across machines."
                >
                  <Select
                    label="Partitioning"
                    value={o.diskMode}
                    change={(v) =>
                      patch({ diskMode: v as Options['diskMode'], confirmWipe: false })
                    }
                    choices={[
                      ['interactive', 'Choose the disk during setup'],
                      ['wipe', 'Erase a disk and install automatically'],
                    ]}
                  />
                  {o.diskMode === 'wipe' && (
                    <>
                      <div class="g-danger">
                        <strong>This will erase the selected disk.</strong>
                        <p>
                          All partitions and data on that disk will be removed. Verify the disk
                          number before using this file.
                        </p>
                      </div>
                      <div class="g-two">
                        <Text
                          label="Disk number"
                          hint="0-based index. Verify in diskpart."
                          value={o.diskNumber}
                          placeholder="Required"
                          change={(diskNumber) => patch({ diskNumber, confirmWipe: false })}
                        />
                        <Select
                          label="GPT layout"
                          value={o.diskLayout}
                          change={(v) =>
                            patch({ diskLayout: v as Options['diskLayout'], confirmWipe: false })
                          }
                          choices={[
                            ['', 'Choose a layout'],
                            ['with-recovery', 'EFI + MSR + Windows + Recovery'],
                            ['basic', 'EFI + MSR + Windows'],
                          ]}
                        />
                      </div>
                      <div class="g-two">
                        <NumberField
                          label="EFI partition (MB)"
                          value={o.efiSize}
                          min={300}
                          max={4096}
                          change={(efiSize) => patch({ efiSize, confirmWipe: false })}
                        />
                        {o.diskLayout === 'with-recovery' && (
                          <NumberField
                            label="Recovery partition (MB)"
                            value={o.recoverySize}
                            min={1024}
                            max={16384}
                            change={(recoverySize) => patch({ recoverySize, confirmWipe: false })}
                          />
                        )}
                      </div>
                      {o.diskLayout === 'basic' && (
                        <p class="g-hint">
                          No separate recovery partition. BitLocker recovery and Windows RE failover
                          may be affected.
                        </p>
                      )}
                      <Check
                        label={`I authorize erasing disk ${o.diskNumber || '(choose a number)'}`}
                        checked={o.confirmWipe}
                        change={(confirmWipe) => patch({ confirmWipe })}
                      />
                    </>
                  )}
                </Group>
              </>
            )}
            {!imported && active === 3 && (
              <>
                <Group title="Device identity">
                  <Text
                    label="Computer name or Kyro pattern"
                    hint="Blank lets Windows generate a name. Maximum 15 characters after substitution. :N keeps the last N characters."
                    value={o.computerName}
                    placeholder="Unset, e.g. PC-{{serial:8}}"
                    change={(computerName) => patch({ computerName })}
                  />
                  <div class="g-token-actions">
                    {['PC-{{serial:8}}', 'PC-{{mac:10}}', 'PC-{{uuid:8}}'].map((v) => (
                      <button type="button" onClick={() => patch({ computerName: v })}>
                        Use <code>{v}</code>
                      </button>
                    ))}
                  </div>
                </Group>
                <Group
                  title="Local accounts"
                  hint="Windows asks for an account when this list is empty. First-logon scripts need an administrator."
                >
                  {!o.accounts.length && (
                    <p class="g-empty">No accounts configured. Windows will ask during setup.</p>
                  )}
                  {o.accounts.map((a, i) => (
                    <fieldset class="g-item">
                      <legend>Account {i + 1}</legend>
                      <div class="g-two">
                        <Text
                          label="Account name"
                          value={a.name}
                          change={(name) => account(i, { name })}
                        />
                        <Text
                          label="Display name (optional)"
                          value={a.displayName}
                          change={(displayName) => account(i, { displayName })}
                        />
                      </div>
                      <div class="g-two">
                        <Text
                          label="Password"
                          hint="Recoverable from generated files."
                          password
                          value={a.password}
                          change={(password) => account(i, { password })}
                        />
                        <Select
                          label="Account type"
                          value={a.group}
                          change={(v) => account(i, { group: v as Account['group'] })}
                          choices={[
                            ['Administrators', 'Administrator'],
                            ['Users', 'Standard user'],
                          ]}
                        />
                      </div>
                      <button
                        type="button"
                        class="g-remove"
                        onClick={() =>
                          patch({
                            accounts: o.accounts.filter((_, n) => n !== i),
                            ...(o.autoLogon === a.name ? { autoLogon: '' } : {}),
                          })
                        }
                      >
                        Remove account {i + 1}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    disabled={o.accounts.length >= 15}
                    onClick={() =>
                      patch({
                        accounts: [
                          ...o.accounts,
                          {
                            name: '',
                            displayName: '',
                            password: '',
                            group: o.accounts.length ? 'Users' : 'Administrators',
                          },
                        ],
                      })
                    }
                  >
                    Add local account
                  </button>
                </Group>
                {!!o.accounts.length && (
                  <Group
                    title="Automatic sign-in"
                    hint="Optional. Scripts wait until the first sign-in."
                  >
                    <Select
                      label="Sign in automatically as"
                      value={o.autoLogon}
                      change={(autoLogon) => patch({ autoLogon })}
                      choices={[
                        ['', 'Do not sign in automatically'],
                        ...o.accounts.filter((a) => a.name).map((a) => [a.name, a.name] as const),
                      ]}
                    />
                    {o.autoLogon && (
                      <>
                        <NumberField
                          label="Requested sign-in count"
                          value={o.autoLogonCount}
                          min={1}
                          max={999}
                          change={(autoLogonCount) => patch({ autoLogonCount })}
                        />
                        <p class="g-hint">
                          Windows may perform one extra automatic sign-in. Verify the count in a VM.
                        </p>
                      </>
                    )}
                  </Group>
                )}
              </>
            )}
            {!imported && active === 4 && (
              <>
                <Group
                  title="First-run experience (OOBE)"
                  hint="These hide individual documented pages; they do not guarantee a fully offline setup."
                >
                  {(
                    [
                      ['hideEula', 'Hide the license terms page'],
                      ['hideOem', 'Hide OEM registration'],
                      ['hideOnline', 'Hide online account screens'],
                      ['hideWireless', 'Hide wireless network setup'],
                    ] as const
                  ).map(([key, label]) => (
                    <Check
                      label={label}
                      checked={o.oobe[key]}
                      change={(v) => patch({ oobe: { ...o.oobe, [key]: v } })}
                    />
                  ))}
                  <Select
                    label="Express settings"
                    value={o.oobe.protect}
                    change={(v) =>
                      patch({ oobe: { ...o.oobe, protect: v as Options['oobe']['protect'] } })
                    }
                    choices={[
                      ['', 'Leave unset'],
                      ['1', 'Enable express settings (1)'],
                      ['2', 'Enable express settings (2)'],
                      ['3', 'Turn off express settings (3)'],
                    ]}
                  />
                </Group>
                <Group title="Active Directory domain">
                  <Check
                    label="Join a domain during setup"
                    hint="Uses plain-text join credentials in the answer file."
                    checked={o.domain.enabled}
                    change={(v) => patch({ domain: { ...o.domain, enabled: v } })}
                  />
                  {o.domain.enabled && (
                    <>
                      <Text
                        label="DNS domain name"
                        value={o.domain.name}
                        placeholder="Your domain FQDN"
                        change={(v) => patch({ domain: { ...o.domain, name: v } })}
                      />
                      <div class="g-two">
                        <Text
                          label="Join account"
                          value={o.domain.username}
                          change={(v) => patch({ domain: { ...o.domain, username: v } })}
                        />
                        <Text
                          label="Join password"
                          password
                          value={o.domain.password}
                          change={(v) => patch({ domain: { ...o.domain, password: v } })}
                        />
                      </div>
                      <Text
                        label="Organizational unit (optional)"
                        value={o.domain.ou}
                        placeholder="Distinguished name of your OU"
                        change={(v) => patch({ domain: { ...o.domain, ou: v } })}
                      />
                    </>
                  )}
                </Group>
                <Group
                  title="Driver folders"
                  hint="Folders must be accessible during the relevant pass. No network credentials are added."
                >
                  <LineList
                    label="Windows PE drivers"
                    hint="One path per line. Storage or network INF driver folders needed during setup."
                    values={o.driversPE}
                    change={(driversPE) => patch({ driversPE })}
                  />
                  <LineList
                    label="Installed system drivers"
                    hint="One path per line. Paths available in offlineServicing."
                    values={o.driversSystem}
                    change={(driversSystem) => patch({ driversSystem })}
                  />
                </Group>
              </>
            )}
            {!imported && active === 5 && (
              <>
                <Group
                  title="Provisioned app removal"
                  hint="Nothing selected by default. Availability varies by ISO; absent packages are skipped."
                >
                  <div class="g-app-list">
                    {appCatalogue.map((app) => (
                      <Check
                        label={app}
                        checked={o.removeApps.includes(app)}
                        change={(v) =>
                          patch({
                            removeApps: v
                              ? [...o.removeApps, app]
                              : o.removeApps.filter((a) => a !== app),
                          })
                        }
                      />
                    ))}
                  </div>
                  <LineList
                    label="Additional package identities"
                    hint="One per line. Use DisplayName from Get-AppxProvisionedPackage -Online."
                    values={o.removeApps.filter((a) => !appCatalogue.includes(a))}
                    change={(v) =>
                      patch({
                        removeApps: [...o.removeApps.filter((a) => appCatalogue.includes(a)), ...v],
                      })
                    }
                  />
                </Group>
                <Group
                  title="First-logon scripts"
                  hint="Run in the order shown after the first sign-in. Windows PowerShell 5.1. Scripts are Base64 encoded; Kyro tokens inside them cannot be substituted."
                >
                  {!o.scripts.length && (
                    <p class="g-empty">No scripts. Add one to customize Windows after sign-in.</p>
                  )}
                  {o.scripts.map((s, i) => (
                    <fieldset class="g-item">
                      <legend>Script {i + 1}</legend>
                      <Select
                        label="Script type"
                        value={s.kind}
                        choices={[
                          ['powershell', 'PowerShell'],
                          ['command', 'Command line (cmd.exe)'],
                        ]}
                        change={(v) =>
                          patch({
                            scripts: o.scripts.map((x, n) =>
                              n === i ? { ...x, kind: v as typeof s.kind } : x,
                            ),
                          })
                        }
                      />
                      <Text
                        label={s.kind === 'powershell' ? 'PowerShell script' : 'Command line'}
                        value={s.content}
                        multi
                        code
                        change={(v) =>
                          patch({
                            scripts: o.scripts.map((x, n) => (n === i ? { ...x, content: v } : x)),
                          })
                        }
                      />
                      <div class="g-item-actions">
                        <button
                          type="button"
                          disabled={!i}
                          onClick={() => {
                            const v = [...o.scripts];
                            [v[i - 1], v[i]] = [v[i]!, v[i - 1]!];
                            patch({ scripts: v });
                          }}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          disabled={i === o.scripts.length - 1}
                          onClick={() => {
                            const v = [...o.scripts];
                            [v[i], v[i + 1]] = [v[i + 1]!, v[i]!];
                            patch({ scripts: v });
                          }}
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          class="g-remove"
                          onClick={() => patch({ scripts: o.scripts.filter((_, n) => n !== i) })}
                        >
                          Remove script {i + 1}
                        </button>
                      </div>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    disabled={o.scripts.length >= 20}
                    onClick={() =>
                      patch({ scripts: [...o.scripts, { kind: 'powershell', content: '' }] })
                    }
                  >
                    Add first-logon script
                  </button>
                </Group>
              </>
            )}
            {!imported && active === 6 && (
              <>
                <Group
                  title="Hardware requirement bypass"
                  hint="Unsupported by Microsoft, may stop working and does not guarantee updates. Kyro also has a per-image bypass switch; check it before using these."
                >
                  <div class="g-two">
                    {(['TPM', 'SecureBoot', 'RAM', 'CPU', 'Storage'] as const).map((check) => (
                      <Check
                        label={`Bypass ${check === 'SecureBoot' ? 'Secure Boot' : check} check`}
                        checked={o.bypass.includes(check)}
                        change={(v) =>
                          patch({
                            bypass: v ? [...o.bypass, check] : o.bypass.filter((b) => b !== check),
                          })
                        }
                      />
                    ))}
                  </div>
                </Group>
                <Group
                  title="Raw XML fragments"
                  hint="Child elements for a component. Preserved unchanged; checked for well-formedness and conflicting elements, not against a Windows schema."
                >
                  {!o.fragments.length && (
                    <p class="g-empty">
                      No extra XML. The guided form controls the entire answer file.
                    </p>
                  )}
                  {o.fragments.map((f, i) => (
                    <fieldset class="g-item">
                      <legend>Fragment {i + 1}</legend>
                      <Select
                        label="Setup pass"
                        value={f.pass}
                        choices={passes.map((p) => [p, p] as const)}
                        change={(v) =>
                          patch({
                            fragments: o.fragments.map((x, n) =>
                              n === i ? { ...x, pass: v as typeof f.pass } : x,
                            ),
                          })
                        }
                      />
                      <Text
                        label="Component name"
                        value={f.component}
                        placeholder="Microsoft-Windows-…"
                        change={(v) =>
                          patch({
                            fragments: o.fragments.map((x, n) =>
                              n === i ? { ...x, component: v } : x,
                            ),
                          })
                        }
                      />
                      <Text
                        label="Child elements"
                        value={f.xml}
                        multi
                        code
                        change={(v) =>
                          patch({
                            fragments: o.fragments.map((x, n) => (n === i ? { ...x, xml: v } : x)),
                          })
                        }
                      />
                      <button
                        type="button"
                        class="g-remove"
                        onClick={() => patch({ fragments: o.fragments.filter((_, n) => n !== i) })}
                      >
                        Remove fragment {i + 1}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    disabled={o.fragments.length >= 20}
                    onClick={() =>
                      patch({
                        fragments: [...o.fragments, { pass: 'specialize', component: '', xml: '' }],
                      })
                    }
                  >
                    Add XML fragment
                  </button>
                </Group>
              </>
            )}
            {!imported && (
              <div class="g-section-footer">
                <span class="g-hint">Unset settings are omitted from the XML.</span>
                <button
                  type="button"
                  onClick={() =>
                    active < 6
                      ? openSection(active + 1, true)
                      : document.getElementById('g-output')?.focus()
                  }
                >
                  {active < 6 ? `Next: ${sections[active + 1]}` : 'Review output'}
                </button>
              </div>
            )}
          </div>
        </div>
        <aside class="g-output" id="g-output" tabIndex={-1} aria-labelledby="g-output-title">
          <div class="g-output-heading">
            <span
              class={`g-status-mark ${generated.errors.length || output.error ? 'has-error' : ''}`}
              aria-hidden="true"
            />
            <h2 id="g-output-title">Your output</h2>
            <span class="g-output-state">
              {generated.errors.length || output.error ? 'Needs attention' : 'Generated'}
            </span>
          </div>
          <div class="g-output-body">
            <Select
              label="Download format"
              value={format}
              change={(v) => {
                setFormat(v as Format);
                setNotice('');
              }}
              choices={[
                ['kyro', 'Kyro profile · .kyro.json'],
                ['xml', 'Windows answer file · .xml'],
                ...(!imported ? [['settings', 'Editable settings · .settings.json'] as const] : []),
              ]}
            />
            <p class="g-hint">
              {format === 'kyro'
                ? 'Version 0 bundle for the current Kyro alpha. Includes XML, build numbers, warnings and disk-wipe metadata.'
                : format === 'xml'
                  ? 'Use with Windows installation media or Kyro. Computer-name patterns require Kyro.'
                  : 'Reload here to edit later. Not a Kyro import bundle. Passwords are stored in clear text.'}
            </p>
            <dl class="g-summary">
              <div>
                <dt>Target</dt>
                <dd>{imported ? 'Imported XML' : 'Windows 11 · x64'}</dd>
              </div>
              <div>
                <dt>Disk</dt>
                <dd>
                  {generated.result?.wipesDisk || o.diskMode === 'wipe'
                    ? 'Erases / changes disks'
                    : 'Choose during setup'}
                </dd>
              </div>
              <div>
                <dt>Accounts</dt>
                <dd>
                  {imported
                    ? 'Review imported XML'
                    : o.accounts.length
                      ? `${o.accounts.length} local ${o.accounts.length === 1 ? 'account' : 'accounts'}`
                      : 'Ask during setup'}
                </dd>
              </div>
            </dl>
            {!!generated.errors.length && (
              <div class="g-errors" role="alert">
                <h3>Fix before exporting</h3>
                <ul>
                  {generated.errors.map((issue) => (
                    <li>
                      <strong>{issueLabel(issue.path)}</strong>: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {output.error && (
              <p class="g-error" role="alert">
                {output.error}
              </p>
            )}
            <div class="g-warnings">
              <h3>
                {warnings.length
                  ? `${warnings.length} ${warnings.length === 1 ? 'note' : 'notes'} to review`
                  : 'No warnings'}
              </h3>
              {warnings.length ? (
                <ul>
                  {warnings.map((w) => (
                    <li class={w.severity === 'warning' ? 'g-warning-item' : ''}>
                      <span class="g-note-kind">
                        {w.severity === 'warning' ? 'Warning' : 'Note'}
                      </span>
                      {w.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="g-hint">
                  {generated.errors.length
                    ? 'Warnings appear when the configuration is valid.'
                    : 'No destructive actions or credentials configured.'}
                </p>
              )}
            </div>
            {needsReview && (
              <Check label="I have reviewed the warnings" checked={reviewed} change={setReviewed} />
            )}
            {blockedWipe && (
              <p class="g-error">Confirm imported disk changes in the XML editor to export.</p>
            )}
            <button type="button" class="g-download" disabled={!canExport} onClick={download}>
              Download{' '}
              {format === 'kyro' ? 'Kyro profile' : format === 'xml' ? 'answer file' : 'settings'}
            </button>
            {!canExport && (
              <p class="g-hint">
                {generated.errors.length || output.error
                  ? 'Resolve the errors to generate a downloadable file.'
                  : 'Review and acknowledge the warnings to download.'}
              </p>
            )}
            <details class="g-preview">
              <summary>
                Preview {format === 'xml' ? 'XML' : 'JSON'}
                <span>
                  {output.text
                    ? `${(new TextEncoder().encode(output.text).length / 1024).toFixed(1)} KB`
                    : 'Unavailable'}
                </span>
              </summary>
              <p class="g-hint">May contain credentials. Visible only when opened.</p>
              <pre tabIndex={0}>
                <code>{output.text || 'Complete the required settings to preview your file.'}</code>
              </pre>
            </details>
            {format === 'kyro' && (
              <div class="g-import-help">
                <h3>Import into Kyro</h3>
                <code>kyro profile import {o.name || 'profile'}.kyro.json</code>
                <p class="g-hint">
                  Save a separate settings file to edit later. Version 0 bundles contain XML, not
                  form settings.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
      <dialog class="g-dialog" ref={resetDialog}>
        <h2>Reset this configuration?</h2>
        <p>
          Current settings and imported XML will be cleared. Download a settings file first if you
          want to keep your work.
        </p>
        <div class="g-item-actions">
          <button type="button" onClick={() => resetDialog.current?.close()} autoFocus>
            Keep editing
          </button>
          <button type="button" class="g-remove" onClick={reset}>
            Reset configuration
          </button>
        </div>
      </dialog>
    </div>
  );
}
