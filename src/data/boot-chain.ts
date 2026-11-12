import type { Status } from './status';

/** The protocols Kyro serves, in the order a booting PC first uses them. */
export const lanes = ['DHCP', 'TFTP', 'HTTP', 'SMB'] as const;
export type Lane = (typeof lanes)[number];

export interface BootStep {
  /** What happens, in a few words. */
  what: string;
  /** The protocols this step is served over. */
  lanes: readonly Lane[];
  status: Status;
}

/**
 * The steps from power-on to Windows Setup and how far Kyro is with each.
 *
 * Source: README, docs/architecture.md, docs/ROADMAP.md and ADR 0001 of the
 * Kyro repository. The roadmap there is authoritative. Update `checkedOn`
 * whenever this list is compared against it.
 */
export const checkedOn = '2026-11-12';

export const bootChain: BootStep[] = [
  { what: 'The PC asks where to boot from', lanes: ['DHCP'], status: 'planned' },
  { what: 'Its firmware loads iPXE', lanes: ['TFTP'], status: 'planned' },
  { what: 'iPXE shows the menu of images', lanes: ['HTTP'], status: 'planned' },
  { what: 'wimboot starts Windows PE', lanes: ['HTTP'], status: 'planned' },
  { what: 'Windows PE opens the install share', lanes: ['SMB'], status: 'planned' },
  { what: 'Windows Setup runs', lanes: ['HTTP', 'SMB'], status: 'planned' },
];
