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
 * The steps from power-on to installed Windows and how far Kyro is with each.
 *
 * Source: README, docs/architecture.md, docs/ROADMAP.md and ADR 0001 of the
 * Kyro repository. The roadmap there is authoritative. Update `checkedOn`
 * and `sourceRevision` whenever this list is compared against it.
 */
export const checkedOn = '2026-11-14';
export const sourceRevision = '65ac0f013db575266f123a32faddbe0636c75f87';

export const bootChain: BootStep[] = [
  { what: 'Kyro answers with boot information', lanes: ['DHCP'], status: 'tested' },
  { what: 'The firmware loads iPXE', lanes: ['TFTP'], status: 'tested' },
  { what: 'Kyro checks that the client is armed', lanes: ['HTTP'], status: 'tested' },
  { what: 'wimboot starts Windows PE', lanes: ['HTTP'], status: 'tested' },
  { what: 'Windows PE opens the install share', lanes: ['SMB'], status: 'tested' },
  { what: 'Windows Setup installs from the share', lanes: ['SMB'], status: 'tested' },
  { what: 'Installed Windows reports completion', lanes: ['HTTP'], status: 'tested' },
];
