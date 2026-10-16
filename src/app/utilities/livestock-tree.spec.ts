import { Livestock } from '../models/wealth.models';
import { buildLivestockTree, livestockAgeLabel } from './livestock-tree';

function animal(id: string, overrides: Partial<Livestock> = {}): Livestock {
  return {
    id,
    animalType: 'Cow',
    breed: id,
    count: 1,
    initialCount: 1,
    purchaseValue: 0,
    currentValue: 100,
    milkLitresPerDay: 0,
    milkPricePerLitre: 0,
    monthlyFeedCost: 0,
    monthlyMedicineCost: 0,
    insured: false,
    ...overrides,
  };
}

describe('livestock family tree', () => {
  it('groups calves under their linked mother and keeps unlinked animals as roots', () => {
    const mother = animal('mother', { gender: 'Female' });
    const calf = animal('calf', { motherId: 'mother' });
    const unlinked = animal('unlinked');

    const tree = buildLivestockTree([mother, calf, unlinked]);

    expect(tree.map((node) => node.animal.id)).toEqual(['mother', 'unlinked']);
    expect(tree[0].children.map((node) => node.animal.id)).toEqual(['calf']);
  });

  it('keeps orphaned, invalid, and cyclic relationships visible without recursion loops', () => {
    const orphan = animal('orphan', { motherId: 'missing' });
    const male = animal('male', { gender: 'Male' });
    const invalidChild = animal('invalid-child', { motherId: 'male' });
    const first = animal('first', { gender: 'Female', motherId: 'second' });
    const second = animal('second', { gender: 'Female', motherId: 'first' });

    const tree = buildLivestockTree([orphan, male, invalidChild, first, second]);
    const collectIds = (nodes: ReturnType<typeof buildLivestockTree>): string[] =>
      nodes.flatMap((node) => [node.animal.id, ...collectIds(node.children)]);

    expect(collectIds(tree).sort()).toEqual(['first', 'invalid-child', 'male', 'orphan', 'second']);
  });
});

describe('livestock age label', () => {
  const asOf = new Date(2026, 9, 16);

  it('formats age in years and months', () => {
    expect(livestockAgeLabel(animal('calf', { birthDate: '2023-07-15' }), asOf)).toBe('3y 3mo');
  });

  it('handles young animals, missing dates, invalid dates, and future dates', () => {
    expect(livestockAgeLabel(animal('young', { birthDate: '2026-10-10' }), asOf)).toBe('6 days');
    expect(livestockAgeLabel(animal('missing'), asOf)).toBe('Not recorded');
    expect(livestockAgeLabel(animal('invalid', { birthDate: '2026-02-30' }), asOf)).toBe('Unknown');
    expect(livestockAgeLabel(animal('future', { birthDate: '2026-10-17' }), asOf)).toBe('Unknown');
  });
});
