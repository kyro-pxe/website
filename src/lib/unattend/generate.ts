import {
  appCatalogue,
  locales,
  passes,
  timeZones,
  type Options,
  type Pass,
  type Result,
  type Warning,
} from './types';
import { base64Utf16, checkXml, escapeXml, namespaceAttributes, psLiteral } from './xml';
import { OptionsError, validateOptions } from './validate';

interface Node {
  name: string;
  content: string | Node[];
  attrs: Record<string, string>;
  raw?: string;
}
const element = (
  name: string,
  content: string | number | boolean | Node[],
  attrs: Record<string, string> = {},
): Node => ({
  name,
  content: Array.isArray(content) ? content : escapeXml(String(content)),
  attrs,
});
const add = (name: string, content: Node[]) => element(name, content, { 'wcm:action': 'add' });
function serialize(node: Node, depth: number): string {
  if (node.raw !== undefined) return node.raw;
  const indent = '  '.repeat(depth);
  const attrs = Object.entries(node.attrs)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join('');
  if (typeof node.content === 'string')
    return `${indent}<${node.name}${attrs}>${node.content}</${node.name}>`;
  return `${indent}<${node.name}${attrs}>\n${node.content.map((c) => serialize(c, depth + 1)).join('\n')}\n${indent}</${node.name}>`;
}
function component(name: string, nodes: Node[]): Node {
  return element('component', nodes, {
    name,
    processorArchitecture: 'amd64',
    publicKeyToken: '31bf3856ad364e35',
    language: 'neutral',
    versionScope: 'nonSxS',
  });
}
function synchronous(commands: string[]): Node {
  if (commands.length > 500)
    throw new OptionsError([
      {
        path: 'scripts',
        message:
          'Scripts need more than 500 setup commands. Shorten the combined scripts to fit Windows Setup’s command limit.',
      },
    ]);
  if (commands.some((c) => c.length > 259))
    throw new OptionsError([
      {
        path: 'scripts',
        message:
          'A setup command exceeds Windows Setup’s 259-character limit. Shorten the script or app list.',
      },
    ]);
  return element(
    'RunSynchronous',
    commands.map((command, i) =>
      add('RunSynchronousCommand', [element('Order', i + 1), element('Path', command)]),
    ),
  );
}

export function generateUnattend(o: Options): Result {
  const issues = validateOptions(o);
  if (issues.length) throw new OptionsError(issues);
  const warnings: Warning[] = [];
  const warn = (code: string, message: string, severity: Warning['severity'] = 'warning') => {
    if (!warnings.some((w) => w.code === code)) warnings.push({ code, message, severity });
  };
  const tree = new Map<Pass, Map<string, Node[]>>(passes.map((p) => [p, new Map()]));
  const put = (pass: Pass, name: string, nodes: Node[]) => {
    if (!nodes.length) return;
    const key = `Microsoft-Windows-${name}`;
    const group = tree.get(pass)!;
    group.set(key, [...(group.get(key) ?? []), ...nodes]);
  };
  const language: Node[] = [];
  if (o.keyboard) language.push(element('InputLocale', o.keyboard));
  if (o.systemLocale) language.push(element('SystemLocale', o.systemLocale));
  if (o.language) language.push(element('UILanguage', o.language));
  if (o.userLocale) language.push(element('UserLocale', o.userLocale));
  put('windowsPE', 'International-Core-WinPE', [
    ...(o.language ? [element('SetupUILanguage', [element('UILanguage', o.language)])] : []),
    ...language,
  ]);
  put('oobeSystem', 'International-Core', language);
  if (o.language)
    warn(
      'image-language',
      'The display language must already be present in the Windows image; this file does not install language packs.',
      'info',
    );
  if (
    [o.language, o.userLocale, o.systemLocale].some(
      (v) => v && !locales.some(([id]) => id === v),
    ) ||
    (o.timeZone && !timeZones.includes(o.timeZone))
  )
    warn(
      'unknown-value',
      'A locale or time zone is outside the built-in list. Verify that Windows supports the value.',
    );
  const peCommands: string[] = [];
  for (const check of ['TPM', 'SecureBoot', 'RAM', 'CPU', 'Storage'])
    if ((o.bypass as string[]).includes(check))
      peCommands.push(
        `reg.exe add HKLM\\SYSTEM\\Setup\\LabConfig /v Bypass${check}Check /t REG_DWORD /d 1 /f`,
      );
  if (o.bypass.length)
    warn(
      'labconfig-bypass',
      'LabConfig bypass is unsupported by Microsoft, may stop working, and unsupported devices are not guaranteed updates. Kyro also has a per-image bypass switch.',
    );
  const setup: Node[] = [];
  const image: Node[] = [];
  if (o.editionMode === 'index' || o.editionMode === 'name')
    image.push(
      element('InstallFrom', [
        add('MetaData', [
          element('Key', o.editionMode === 'index' ? '/IMAGE/INDEX' : '/IMAGE/NAME'),
          element('Value', o.editionValue),
        ]),
      ]),
    );
  if (o.diskMode === 'wipe') {
    warn(
      'disk-wipe',
      `Disk ${o.diskNumber} will be erased and repartitioned without asking. Verify the disk number on each target machine.`,
    );
    if (o.diskLayout === 'basic') {
      const creates = [
        add('CreatePartition', [
          element('Order', 1),
          element('Type', 'EFI'),
          element('Size', o.efiSize),
        ]),
        add('CreatePartition', [element('Order', 2), element('Type', 'MSR'), element('Size', 16)]),
        add('CreatePartition', [
          element('Order', 3),
          element('Type', 'Primary'),
          element('Extend', true),
        ]),
      ];
      const modifies = [
        add('ModifyPartition', [
          element('Order', 1),
          element('PartitionID', 1),
          element('Format', 'FAT32'),
          element('Label', 'System'),
        ]),
        add('ModifyPartition', [
          element('Order', 2),
          element('PartitionID', 3),
          element('Format', 'NTFS'),
          element('Label', 'Windows'),
          element('Letter', 'C'),
        ]),
      ];
      setup.push(
        element('DiskConfiguration', [
          add('Disk', [
            element('DiskID', o.diskNumber),
            element('WillWipeDisk', true),
            element('CreatePartitions', creates),
            element('ModifyPartitions', modifies),
          ]),
          element('WillShowUI', 'OnError'),
        ]),
      );
      warn(
        'no-recovery',
        'The basic layout creates no separate recovery partition. BitLocker recovery and automatic Windows RE failover may be affected.',
      );
    } else {
      const commands = [
        `select disk=${o.diskNumber}`,
        'clean',
        'convert gpt',
        `create partition efi size=${o.efiSize}`,
        'format quick fs=fat32 label=System',
        'create partition msr size=16',
        'create partition primary',
        `shrink minimum=${o.recoverySize}`,
        'format quick fs=ntfs label=Windows',
        'create partition primary',
        'format quick fs=ntfs label=Recovery',
        'set id=de94bba4-06d1-4d40-a16a-bfd50179d6ac',
        'gpt attributes=0x8000000000000001',
      ];
      commands.forEach((line, i) =>
        peCommands.push(`cmd.exe /d /c ${i ? '>>' : '>'}"%TEMP%\\kyro-disk.txt" echo ${line}`),
      );
      peCommands.push('cmd.exe /d /c diskpart.exe /s "%TEMP%\\kyro-disk.txt" || exit /b 1');
    }
    image.push(
      element('InstallTo', [element('DiskID', o.diskNumber), element('PartitionID', 3)]),
      element('WillShowUI', 'OnError'),
    );
  }
  if (image.length) setup.push(element('ImageInstall', [element('OSImage', image)]));
  const userData: Node[] = [];
  if (o.acceptEula) {
    userData.push(element('AcceptEula', true));
    warn(
      'eula-accepted',
      'This file accepts the Microsoft Software License Terms for every machine installed with it.',
      'info',
    );
  }
  if (o.editionMode === 'key') {
    userData.push(
      element('ProductKey', [
        element('Key', o.editionValue.toUpperCase()),
        element('WillShowUI', 'OnError'),
      ]),
    );
    warn(
      'product-key',
      'The answer file contains your product key. Treat downloads and the boot network as readable by others.',
    );
  }
  if (userData.length) setup.push(element('UserData', userData));
  if (peCommands.length) setup.push(synchronous(peCommands));
  put('windowsPE', 'Setup', setup);
  const shell: Node[] = [];
  if (o.computerName) shell.push(element('ComputerName', o.computerName));
  if (o.timeZone) shell.push(element('TimeZone', o.timeZone));
  put('specialize', 'Shell-Setup', shell);
  if (/\{\{/.test(o.computerName))
    warn(
      'kyro-tokens',
      'Computer-name tokens require Kyro. Standalone Windows Setup cannot resolve them. :N keeps the last N characters.',
    );
  if (o.domain.enabled) {
    const d = o.domain;
    put('specialize', 'UnattendedJoin', [
      element('Identification', [
        element('Credentials', [
          element('Domain', d.name),
          element('Password', d.password),
          element('Username', d.username),
        ]),
        element('JoinDomain', d.name),
        ...(d.ou ? [element('MachineObjectOU', d.ou)] : []),
      ]),
    ]);
    warn(
      'domain-join-credentials',
      'Domain credentials are written in plain text. Use an account restricted to joining computers to the intended organizational unit.',
    );
  }
  const drivers = (paths: string[]): Node[] =>
    paths.length
      ? [
          element(
            'DriverPaths',
            paths.map((path, i) =>
              element('PathAndCredentials', [element('Path', path)], {
                'wcm:action': 'add',
                'wcm:keyValue': String(i + 1),
              }),
            ),
          ),
        ]
      : [];
  put('windowsPE', 'PnpCustomizationsWinPE', drivers(o.driversPE));
  put('offlineServicing', 'PnpCustomizationsNonWinPE', drivers(o.driversSystem));
  const specializeCommands: string[] = [];
  for (const app of o.removeApps) {
    const script = `Get-AppxProvisionedPackage -Online|Where-Object DisplayName -eq '${app}'|Remove-AppxProvisionedPackage -Online`;
    specializeCommands.push(`powershell.exe -NoProfile -Command "${script}"`);
  }
  if (o.removeApps.some((a) => !appCatalogue.includes(a)))
    warn(
      'unknown-app',
      'A custom app identity is outside the catalogue. If it is absent from the image, nothing is removed.',
      'info',
    );
  const oobeShell: Node[] = [];
  if (o.accounts.length)
    oobeShell.push(
      element('UserAccounts', [
        element(
          'LocalAccounts',
          o.accounts.map((a) =>
            add('LocalAccount', [
              element('Password', [
                element('Value', base64Utf16(`${a.password}Password`)),
                element('PlainText', false),
              ]),
              ...(a.displayName ? [element('DisplayName', a.displayName)] : []),
              element('Group', a.group),
              element('Name', a.name),
            ]),
          ),
        ),
      ]),
    );
  if (o.accounts.some((a) => !a.password))
    warn('empty-password', 'At least one local account has an empty password.');
  if (o.accounts.some((a) => a.password) || o.domain.enabled || o.autoLogon)
    warn(
      'plaintext-password',
      'Passwords are recoverable, even when Base64 encoded. They remain in answer files cached under C:\\Windows\\Panther and may be readable on Kyro’s unauthenticated boot network. Settings downloads contain passwords in clear text.',
    );
  const auto = o.accounts.find((a) => a.name === o.autoLogon);
  if (auto) {
    oobeShell.push(
      element('AutoLogon', [
        element('Password', [
          element('Value', base64Utf16(`${auto.password}Password`)),
          element('PlainText', false),
        ]),
        element('Enabled', true),
        element('LogonCount', o.autoLogonCount),
        element('Username', auto.name),
      ]),
    );
    warn(
      'autologon',
      `Windows will automatically sign in as ${auto.name}. Windows may perform an additional automatic logon beyond the requested count; verify this in a VM.`,
    );
  }
  const pages: Node[] = [];
  for (const [key, name] of [
    ['hideEula', 'HideEULAPage'],
    ['hideOem', 'HideOEMRegistrationScreen'],
    ['hideOnline', 'HideOnlineAccountScreens'],
    ['hideWireless', 'HideWirelessSetupInOOBE'],
  ] as const)
    if (o.oobe[key]) pages.push(element(name, true));
  if (o.oobe.protect) pages.push(element('ProtectYourPC', o.oobe.protect));
  if (pages.length) oobeShell.push(element('OOBE', pages));
  if (o.scripts.length) {
    // FirstLogonCommands can start concurrently. One runner preserves the displayed script order.
    const program = o.scripts
      .map((s) =>
        s.kind === 'command'
          ? `& $env:ComSpec /d /s /c ${psLiteral(s.content)}\nif ($LASTEXITCODE -ne 0) { throw 'Command failed' }`
          : `& {\n${s.content}\n}`,
      )
      .join('\n');
    const encoded = base64Utf16(`$ErrorActionPreference = 'Stop'\n${program}`);
    let command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
    if (command.length > 1024) {
      const file = '%WINDIR%\\Setup\\Scripts\\kyro-firstlogon.b64';
      specializeCommands.push(
        'cmd.exe /d /c if not exist "%WINDIR%\\Setup\\Scripts" mkdir "%WINDIR%\\Setup\\Scripts"',
      );
      for (let i = 0; i < encoded.length; i += 120)
        specializeCommands.push(
          `cmd.exe /d /c ${i ? '>>' : '>'}"${file}" echo ${encoded.slice(i, i + 120)}`,
        );
      command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=$env:WINDIR+'\\Setup\\Scripts\\kyro-firstlogon.b64';$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String([IO.File]::ReadAllText($p)));Remove-Item -LiteralPath $p; & ([scriptblock]::Create($s))"`;
    }
    oobeShell.push(
      element('FirstLogonCommands', [
        add('SynchronousCommand', [
          element('Order', 1),
          element('Description', 'Kyro first-logon scripts (in order)'),
          element('CommandLine', command),
        ]),
      ]),
    );
    warn(
      'custom-scripts',
      'Custom scripts run with the privileges of the first signed-in user and can change disks. The bundle conservatively declares disk changes so Kyro requires confirmation. Review and test scripts before deploying.',
    );
    if (!auto)
      warn(
        'scripts-await-signin',
        'First-logon scripts wait for someone to sign in. Automatic logon is not configured.',
        'info',
      );
    if ((auto ?? o.accounts[0])?.group !== 'Administrators')
      warn(
        'first-logon-needs-admin',
        'First-logon commands need an administrator. Verify which account signs in first.',
      );
  }
  if (specializeCommands.length) put('specialize', 'Deployment', [synchronous(specializeCommands)]);
  put('oobeSystem', 'Shell-Setup', oobeShell);
  for (const [index, f] of o.fragments.entries()) {
    const group = tree.get(f.pass)!;
    const content = group.get(f.component) ?? [];
    const existing = new Set(
      content.flatMap((n) => (n.raw === undefined ? [n.name] : checkXml(n.raw, true).children)),
    );
    const children = checkXml(f.xml, true).children;
    const duplicate = children.find(
      (name, i) => existing.has(name) || children.indexOf(name) !== i,
    );
    if (duplicate)
      throw new OptionsError([
        {
          path: `fragments.${index}.xml`,
          message: `${duplicate} conflicts with another setting in ${f.pass}/${f.component}. Remove one source.`,
        },
      ]);
    content.push({ name: '', content: '', attrs: {}, raw: f.xml });
    group.set(f.component, content);
    warn(
      'raw-xml',
      'Advanced XML is checked for well-formedness and conflicts only. Its Windows settings have not been validated.',
    );
    if (/LabConfig/i.test(f.xml))
      warn(
        'labconfig-bypass',
        'Advanced XML mentions LabConfig. Hardware bypasses are unsupported and may stop working.',
      );
  }
  const settings: Node[] = [];
  for (const pass of passes) {
    const group = tree.get(pass)!;
    if (group.size)
      settings.push(
        element(
          'settings',
          [...group.entries()].map(([name, nodes]) => component(name, nodes)),
          { pass },
        ),
      );
  }
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<unattend ${namespaceAttributes}>${settings.length ? `\n${settings.map((n) => serialize(n, 1)).join('\n')}\n` : ''}</unattend>\n`;
  const parsed = checkXml(xml);
  if (parsed.error) throw new OptionsError([{ path: 'xml', message: parsed.error }]);
  const withoutName = { ...o, computerName: '' };
  if (/\{\{(?:mac|serial|uuid|callback_url)(?::\d+)?\}\}/.test(JSON.stringify(withoutName)))
    warn(
      'token-outside-computer-name',
      'A Kyro token appears outside the computer name. Kyro substitutes visible XML text, but cannot replace tokens inside Base64-encoded scripts or passwords.',
    );
  const wipesDisk =
    o.diskMode === 'wipe' ||
    o.scripts.length > 0 ||
    /diskconfiguration|diskpart|clear-disk|initialize-disk|format-volume|new-partition/i.test(xml);
  if (wipesDisk && o.diskMode !== 'wipe' && !o.scripts.length)
    warn(
      'custom-disk-change',
      'Advanced XML or a command appears to modify disks. Kyro will require confirmation before arming a client.',
    );
  return { xml, warnings, wipesDisk };
}
