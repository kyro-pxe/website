/** The four status values of the Kyro roadmap. */
export type Status = 'planned' | 'in-progress' | 'working' | 'tested';

export const statusLabel: Record<Status, string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  working: 'Working',
  tested: 'Tested',
};
