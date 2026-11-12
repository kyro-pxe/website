import type { Status } from './status';

export interface BootStep {
  /** What happens, as one sentence. May contain `code` in backticks. */
  what: string;
  /** The protocol Kyro serves this step over. */
  protocol: string;
  status: Status;
  note?: string;
}

/**
 * The steps from power-on to Windows Setup and how far Kyro is with each.
 *
 * Source: README, docs/ROADMAP.md and ADR 0001 of the Kyro repository. The
 * roadmap there is authoritative. Update `checkedOn` whenever this list is
 * compared against it.
 */
export const checkedOn = '2026-11-12';

export const bootChain: BootStep[] = [
  {
    what: 'The PC starts a network boot and asks where to find its boot file.',
    protocol: 'DHCP, proxyDHCP',
    status: 'planned',
  },
  {
    what: 'The firmware downloads the iPXE boot loader.',
    protocol: 'TFTP',
    status: 'planned',
  },
  {
    what: 'iPXE fetches its script and shows a menu of the available Windows images.',
    protocol: 'HTTP',
    status: 'planned',
  },
  {
    what: 'wimboot loads `boot.wim` from the ISO into memory and starts Windows PE.',
    protocol: 'HTTP',
    status: 'planned',
  },
  {
    what: 'A start script in Windows PE connects to a read-only share with the contents of the ISO.',
    protocol: 'SMB',
    status: 'planned',
    note: 'The design is decided. Its test in a virtual machine is in progress.',
  },
  {
    what: 'Windows Setup starts from that share and applies an `autounattend.xml`, if one is assigned.',
    protocol: 'SMB, HTTP',
    status: 'planned',
  },
];
