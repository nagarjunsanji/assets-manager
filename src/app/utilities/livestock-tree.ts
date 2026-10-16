import { Livestock } from '../models/wealth.models';

export interface LivestockTreeNode {
  animal: Livestock;
  children: LivestockTreeNode[];
}

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

export function livestockAgeLabel(animal: Livestock, asOf = new Date()): string {
  if (!animal.birthDate) return 'Not recorded';
  const [year, month, day] = animal.birthDate.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  if (
    Number.isNaN(birth.getTime())
    || birth.getFullYear() !== year
    || birth.getMonth() !== month - 1
    || birth.getDate() !== day
  ) return 'Unknown';

  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  if (birth > today) return 'Unknown';

  let months = (today.getFullYear() - year) * 12 + today.getMonth() - (month - 1);
  if (today.getDate() < day) months--;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0 && remainingMonths === 0) {
    return `${Math.floor((today.getTime() - birth.getTime()) / 86_400_000)} days`;
  }
  return [
    years ? `${years}y` : '',
    remainingMonths ? `${remainingMonths}mo` : '',
  ].filter(Boolean).join(' ') || 'Under 1 month';
}
