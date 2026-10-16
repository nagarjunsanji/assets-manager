import { Livestock } from '../models/wealth.models';
import {
  buildLivestockTree, livestockAgeLabel, livestockStageInfo, recordedOffspringCount,
} from './livestock-tree';

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

describe('livestock life stage and recorded offspring', () => {
  const asOf = new Date(2026, 9, 16);

  it('uses the Gir first-calving benchmark for Gir cows and keeps unknown breeds approximate', () => {
    expect(livestockStageInfo(animal('calf', { breed: 'Gir', birthDate: '2026-08-01' }), asOf).stage)
      .toBe('newborn');
    expect(livestockStageInfo(animal('heifer', { breed: 'Gir', birthDate: '2024-01-01' }), asOf).label)
      .toBe('Growing · Gir benchmark');
    expect(livestockStageInfo(animal('cow', { breed: 'Gir', birthDate: '2021-01-01' }), asOf).stage)
      .toBe('productive');
    expect(livestockStageInfo(animal('other', { breed: 'Jersey', birthDate: '2024-01-01' }), asOf).label)
      .toBe('Growing age band');
    expect(livestockStageInfo(animal('other-adult', { breed: 'Jersey', birthDate: '2022-01-01' }), asOf).stage)
      .toBe('productive');
  });

  it('gives mid-life, senior, and deceased animals their respective stages', () => {
    expect(livestockStageInfo(animal('mid', { birthDate: '2017-01-01' }), asOf).stage).toBe('mid-life');
    expect(livestockStageInfo(animal('old', { birthDate: '2012-01-01' }), asOf).stage).toBe('senior');
    const dead = animal('dead', { birthDate: '2020-01-01', lifeStatus: 'Deceased', deathDate: '2022-01-01' });
    expect(livestockStageInfo(dead, asOf).stage).toBe('deceased');
    expect(livestockAgeLabel(dead, asOf)).toBe('2y');
  });

  it('counts only linked offspring quantities and does not infer unrecorded births', () => {
    const offspring = [
      animal('calf-1', { motherId: 'dam', count: 1 }),
      animal('calf-2', { motherId: 'dam', count: 2 }),
      animal('unlinked'),
    ];
    expect(recordedOffspringCount(offspring, 'dam')).toBe(3);
    expect(recordedOffspringCount(offspring, 'other-dam')).toBe(0);
  });
});
