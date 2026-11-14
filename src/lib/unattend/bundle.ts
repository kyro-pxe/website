import versionInfo from '../../../package.json';
import {
  builds,
  MAX_FILE_BYTES,
  type KyroBundle,
  type Options,
  type Result,
  type Warning,
} from './types';
import { OptionsError, validateOptions } from './validate';
import { checkXml } from './xml';

export interface ImportedProfile {
  name: string;
  description: string;
  windowsBuilds: string[];
  xml: string;
  warnings: string[];
  wipesDisk: boolean;
}
const size = (s: string) => new TextEncoder().encode(s).length;
function limited(text: string): string {
  if (size(text) > MAX_FILE_BYTES)
    throw new Error('The file exceeds Kyro’s 2 MiB limit. Reduce script or XML content.');
  return text;
}
export function exportBundle(o: Options, result: Result, importedBuilds?: string[]): string {
  const errors = validateOptions(o);
  if (errors.length) throw new OptionsError(errors);
  const bundle: KyroBundle = {
    bundle_version: 0,
    name: o.name,
    description: o.description,
    wipes_disk: result.wipesDisk,
    warnings: result.warnings.map((w) => w.message),
    windows_builds: importedBuilds ?? o.windowsBuilds.map((b) => builds[b]),
    answer_file: result.xml,
  };
  return limited(`${JSON.stringify(bundle, null, 2)}\n`);
}
export function exportSettings(o: Options): string {
  const errors = validateOptions(o);
  if (errors.length) throw new OptionsError(errors);
  return limited(
    `${JSON.stringify({ format: 'kyro-generator-settings', version: 1, generator: { name: 'kyro-website', version: versionInfo.version }, options: o }, null, 2)}\n`,
  );
}
export function inspectImported(
  xml: string,
  warnings: string[] = [],
  declaredWipe = false,
): Result {
  const parsed = checkXml(xml);
  if (parsed.error) throw new Error(parsed.error);
  const notices: Warning[] = warnings.map((message, i) => ({
    code: `imported-${i}`,
    severity: 'warning',
    message,
  }));
  const add = (code: string, message: string) =>
    notices.push({ code, severity: 'warning', message });
  add(
    'imported-xml',
    'Imported XML is preserved as supplied. Only XML syntax and the root namespace are checked; review its settings before use.',
  );
  if (/<(?:\w+:)?(?:Password|Credentials|ProductKey)\b/i.test(xml))
    add(
      'imported-secrets',
      'This imported file may contain recoverable credentials or product keys. Review downloads and cached answer files.',
    );
  if (/\{\{/.test(xml))
    add(
      'imported-tokens',
      'This file contains token-like text. Only known Kyro tokens in text or CDATA are substituted.',
    );
  if (/LabConfig/i.test(xml))
    add('imported-bypass', 'This imported file mentions an unsupported Windows hardware bypass.');
  const wipesDisk =
    declaredWipe ||
    /diskconfiguration|diskpart|clear-disk|initialize-disk|format-volume|new-partition|<(?:\w+:)?(?:FirstLogonCommands|RunSynchronous|LogonCommands)\b/i.test(
      xml,
    );
  if (wipesDisk)
    add(
      'imported-wipe',
      'The imported file declares or appears to contain disk changes. Review it before confirming export.',
    );
  // Version 0 permits at most 32 warnings. Preserve the imported warnings and combine new notices.
  if (notices.length > 32) {
    const imported = notices.slice(0, warnings.length);
    const added = notices
      .slice(warnings.length)
      .map((n) => n.message)
      .join(' ');
    return {
      xml,
      wipesDisk,
      warnings: [
        ...imported.slice(0, 31),
        {
          code: 'import-review',
          severity: 'warning',
          message: added + ' See the original bundle for any additional warnings.',
        },
      ],
    };
  }
  return { xml, wipesDisk, warnings: notices };
}
export function parseImport(
  text: string,
): { kind: 'settings'; options: Options } | { kind: 'profile'; profile: ImportedProfile } {
  limited(text);
  const source = text.replace(/^\uFEFF/, '').trimStart();
  if (source.startsWith('<')) {
    inspectImported(text);
    return {
      kind: 'profile',
      profile: {
        name: '',
        description: '',
        windowsBuilds: [],
        xml: text,
        warnings: [],
        wipesDisk: false,
      },
    };
  }
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error(
      'Choose a UTF-8 XML answer file, Kyro version 0 bundle, or generator settings JSON.',
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('The imported JSON must be an object.');
  const d = data as Record<string, unknown>;
  if (d['format'] === 'kyro-generator-settings') {
    if (d['version'] !== 1)
      throw new Error('Unsupported generator settings version. This page reads version 1.');
    const errors = validateOptions(d['options']);
    if (errors.length) throw new OptionsError(errors);
    // Reconfirm destructive intent in this browser session after loading saved settings.
    return { kind: 'settings', options: { ...(d['options'] as Options), confirmWipe: false } };
  }
  if (d['bundle_version'] !== 0)
    throw new Error(
      'Unsupported Kyro bundle version. The current alpha and this generator use bundle_version 0.',
    );
  const allowed = [
    'bundle_version',
    'name',
    'description',
    'wipes_disk',
    'warnings',
    'windows_builds',
    'answer_file',
  ];
  if (Object.keys(d).some((k) => !allowed.includes(k)))
    throw new Error('The Kyro bundle contains unknown fields. Version 0 uses a strict field list.');
  if (
    typeof d['answer_file'] !== 'string' ||
    !d['answer_file'] ||
    typeof d['wipes_disk'] !== 'boolean'
  )
    throw new Error('A Kyro bundle needs answer_file text and a wipes_disk boolean.');
  const name = d['name'] ?? '';
  const description = d['description'] ?? '';
  const warnings = d['warnings'] ?? [];
  const windowsBuilds = d['windows_builds'] ?? [];
  if (typeof name !== 'string' || (name && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)))
    throw new Error('The imported profile name is invalid.');
  if (typeof description !== 'string' || size(description) > 2000)
    throw new Error('The imported description exceeds 2000 UTF-8 bytes.');
  if (
    !Array.isArray(warnings) ||
    warnings.length > 32 ||
    warnings.some((w) => typeof w !== 'string' || size(w) > 1000)
  )
    throw new Error('Invalid warnings: use at most 32 strings, each at most 1000 UTF-8 bytes.');
  if (
    !Array.isArray(windowsBuilds) ||
    windowsBuilds.length > 64 ||
    windowsBuilds.some((b) => typeof b !== 'string' || !/^[0-9]{4,6}$/.test(b))
  )
    throw new Error('Use at most 64 Windows builds as 4 to 6 digit build-number strings.');
  inspectImported(d['answer_file'], warnings as string[], d['wipes_disk']);
  return {
    kind: 'profile',
    profile: {
      name,
      description,
      windowsBuilds: windowsBuilds as string[],
      xml: d['answer_file'],
      warnings: warnings as string[],
      wipesDisk: d['wipes_disk'],
    },
  };
}
