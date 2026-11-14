export const builds = { '24H2': '26100', '25H2': '26200' } as const;
export const passes = ['windowsPE', 'offlineServicing', 'specialize', 'oobeSystem'] as const;
export type Pass = (typeof passes)[number];
export interface Account {
  name: string;
  displayName: string;
  password: string;
  group: 'Administrators' | 'Users';
}
export interface Script {
  kind: 'powershell' | 'command';
  content: string;
}
export interface Fragment {
  pass: Pass;
  component: string;
  xml: string;
}
export interface Options {
  schemaVersion: 1;
  name: string;
  description: string;
  windowsBuilds: (keyof typeof builds)[];
  language: string;
  userLocale: string;
  systemLocale: string;
  keyboard: string;
  timeZone: string;
  acceptEula: boolean;
  editionMode: 'interactive' | 'index' | 'name' | 'key';
  editionValue: string;
  diskMode: 'interactive' | 'wipe';
  diskNumber: string;
  diskLayout: '' | 'basic' | 'with-recovery';
  efiSize: number;
  recoverySize: number;
  confirmWipe: boolean;
  computerName: string;
  accounts: Account[];
  autoLogon: string;
  autoLogonCount: number;
  oobe: {
    hideEula: boolean;
    hideOem: boolean;
    hideOnline: boolean;
    hideWireless: boolean;
    protect: '' | '1' | '2' | '3';
  };
  domain: { enabled: boolean; name: string; username: string; password: string; ou: string };
  driversPE: string[];
  driversSystem: string[];
  removeApps: string[];
  scripts: Script[];
  bypass: ('TPM' | 'SecureBoot' | 'RAM' | 'CPU' | 'Storage')[];
  fragments: Fragment[];
}
export interface Issue {
  path: string;
  message: string;
}
export interface Warning {
  code: string;
  severity: 'info' | 'warning';
  message: string;
}
export interface Result {
  xml: string;
  warnings: Warning[];
  wipesDisk: boolean;
}
export interface KyroBundle {
  bundle_version: 0;
  name: string;
  description: string;
  wipes_disk: boolean;
  warnings: string[];
  windows_builds: string[];
  answer_file: string;
}
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const locales = [
  ['en-US', 'English (United States)'],
  ['en-GB', 'English (United Kingdom)'],
  ['de-DE', 'German (Germany)'],
  ['fr-FR', 'French (France)'],
  ['es-ES', 'Spanish (Spain)'],
  ['it-IT', 'Italian (Italy)'],
  ['nl-NL', 'Dutch (Netherlands)'],
  ['pt-BR', 'Portuguese (Brazil)'],
  ['pl-PL', 'Polish (Poland)'],
  ['ja-JP', 'Japanese (Japan)'],
  ['ko-KR', 'Korean (Korea)'],
  ['zh-CN', 'Chinese (Simplified)'],
  ['zh-TW', 'Chinese (Traditional)'],
] as const;
export const timeZones = [
  'UTC',
  'GMT Standard Time',
  'W. Europe Standard Time',
  'Romance Standard Time',
  'Central Europe Standard Time',
  'Eastern Standard Time',
  'Central Standard Time',
  'Mountain Standard Time',
  'Pacific Standard Time',
  'E. South America Standard Time',
  'Tokyo Standard Time',
  'Korea Standard Time',
  'China Standard Time',
  'India Standard Time',
  'AUS Eastern Standard Time',
  'New Zealand Standard Time',
];
export const appCatalogue = [
  'Clipchamp.Clipchamp',
  'Microsoft.BingNews',
  'Microsoft.BingWeather',
  'Microsoft.GamingApp',
  'Microsoft.GetHelp',
  'Microsoft.Getstarted',
  'Microsoft.MicrosoftOfficeHub',
  'Microsoft.MicrosoftSolitaireCollection',
  'Microsoft.People',
  'Microsoft.PowerAutomateDesktop',
  'Microsoft.Todos',
  'Microsoft.WindowsFeedbackHub',
  'Microsoft.XboxGamingOverlay',
  'Microsoft.YourPhone',
  'Microsoft.ZuneMusic',
  'Microsoft.ZuneVideo',
];
export function defaults(): Options {
  return {
    schemaVersion: 1,
    name: 'windows-11',
    description: '',
    windowsBuilds: ['24H2', '25H2'],
    language: '',
    userLocale: '',
    systemLocale: '',
    keyboard: '',
    timeZone: '',
    acceptEula: false,
    editionMode: 'interactive',
    editionValue: '',
    diskMode: 'interactive',
    diskNumber: '',
    diskLayout: '',
    efiSize: 300,
    recoverySize: 1024,
    confirmWipe: false,
    computerName: '',
    accounts: [],
    autoLogon: '',
    autoLogonCount: 1,
    oobe: { hideEula: false, hideOem: false, hideOnline: false, hideWireless: false, protect: '' },
    domain: { enabled: false, name: '', username: '', password: '', ou: '' },
    driversPE: [],
    driversSystem: [],
    removeApps: [],
    scripts: [],
    bypass: [],
    fragments: [],
  };
}
