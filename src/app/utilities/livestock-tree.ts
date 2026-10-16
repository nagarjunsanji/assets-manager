import { Livestock } from '../models/wealth.models';

export interface LivestockTreeNode {
  animal: Livestock;
  children: LivestockTreeNode[];
}

export type LivestockLifeStage =
  | 'newborn'
  | 'growing'
  | 'productive'
  | 'mid-life'
  | 'senior'
  | 'deceased'
  | 'unknown';

export interface LivestockStageInfo {
  stage: LivestockLifeStage;
  label: string;
  ageDays: number | null;
}

const GIR_FIRST_CALVING_DAYS = 1_534;
const OTHER_COW_MATURITY_BAND_DAYS = 3 * 365;
const DAY_MS = 86_400_000;

export function buildLivestockTree(animals: Livestock[]): LivestockTreeNode[] {
  const byId = new Map(animals.map((animal) => [animal.id, animal]));
  const childrenByMother = new Map<string, Livestock[]>();
  const hasMother = new Set<string>();

  for (const animal of animals) {
    const mother = animal.motherId ? byId.get(animal.motherId) : undefined;
    if (!mother || mother.gender !== 'Female' || mother.id === animal.id) continue;
    const children = childrenByMother.get(mother.id) ?? [];
    children.push(animal);
    childrenByMother.set(mother.id, children);
    hasMother.add(animal.id);
  }

  const visited = new Set<string>();
  const buildNode = (animal: Livestock): LivestockTreeNode | null => {
    if (visited.has(animal.id)) return null;
    visited.add(animal.id);
    const children = (childrenByMother.get(animal.id) ?? [])
      .map(buildNode)
      .filter((node): node is LivestockTreeNode => node !== null);
    return { animal, children };
  };

  const roots = animals.filter((animal) => !hasMother.has(animal.id))
    .map(buildNode)
    .filter((node): node is LivestockTreeNode => node !== null);
  for (const animal of animals) {
    if (!visited.has(animal.id)) {
      const node = buildNode(animal);
      if (node) roots.push(node);
    }
  }
  return roots;
}

export function recordedOffspringCount(animals: Livestock[], motherId: string): number {
  return animals
    .filter((animal) => animal.motherId === motherId)
    .reduce((count, animal) => count + Math.max(0, animal.count), 0);
}

export function livestockStageInfo(animal: Livestock, asOf = new Date()): LivestockStageInfo {
  const ageAsOf = animal.lifeStatus === 'Deceased' && animal.deathDate
    ? parseDate(animal.deathDate) ?? asOf
    : asOf;
  if (animal.lifeStatus === 'Deceased') {
    return { stage: 'deceased', label: 'Deceased', ageDays: animal.birthDate ? ageInDays(animal.birthDate, ageAsOf) : null };
  }
  const ageDays = animal.birthDate ? ageInDays(animal.birthDate, ageAsOf) : null;
  if (ageDays === null) return { stage: 'unknown', label: 'Age not recorded', ageDays: null };
  if (ageDays < 90) return { stage: 'newborn', label: 'Newborn / young animal', ageDays };

  if (animal.animalType === 'Cow') {
    const isGir = animal.breed.trim().toLowerCase() === 'gir';
    if (ageDays < (isGir ? GIR_FIRST_CALVING_DAYS : OTHER_COW_MATURITY_BAND_DAYS)) {
      return { stage: 'growing', label: isGir ? 'Growing · Gir benchmark' : 'Growing age band', ageDays };
    }
    if (ageDays < 8 * 365) return { stage: 'productive', label: 'Mature age band', ageDays };
    if (ageDays < 12 * 365) return { stage: 'mid-life', label: 'Mid-life age band', ageDays };
    return { stage: 'senior', label: 'Senior age band', ageDays };
  }

  if (ageDays < 365) return { stage: 'growing', label: 'Growing', ageDays };
  if (ageDays < 5 * 365) return { stage: 'productive', label: 'Adult age band', ageDays };
  if (ageDays < 8 * 365) return { stage: 'mid-life', label: 'Mid-life age band', ageDays };
  return { stage: 'senior', label: 'Senior age band', ageDays };
}

export function livestockAgeLabel(animal: Livestock, asOf = new Date()): string {
  if (!animal.birthDate) return 'Not recorded';
  const ageAsOf = animal.lifeStatus === 'Deceased' && animal.deathDate
    ? parseDate(animal.deathDate) ?? asOf
    : asOf;
  const ageDays = ageInDays(animal.birthDate, ageAsOf);
  if (ageDays === null) return 'Unknown';
  const [year, month, day] = animal.birthDate.split('-').map(Number);

  let months = (ageAsOf.getFullYear() - year) * 12 + ageAsOf.getMonth() - (month - 1);
  if (ageAsOf.getDate() < day) months--;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0 && remainingMonths === 0) {
    return `${ageDays} days`;
  }
  return [
    years ? `${years}y` : '',
    remainingMonths ? `${remainingMonths}mo` : '',
  ].filter(Boolean).join(' ') || 'Under 1 month';
}

function ageInDays(birthDate: string, asOf: Date): number | null {
  const [year, month, day] = birthDate.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return null;
  const birth = new Date(year, month - 1, day);
  if (
    Number.isNaN(birth.getTime())
    || birth.getFullYear() !== year
    || birth.getMonth() !== month - 1
    || birth.getDate() !== day
  ) return null;
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  if (birth > today) return null;
  return Math.floor((today.getTime() - birth.getTime()) / DAY_MS);
}

function parseDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
