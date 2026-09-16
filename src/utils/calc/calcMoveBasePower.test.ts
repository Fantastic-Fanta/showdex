import { type AbilityName, type MoveName } from '@smogon/calc';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { type CalcdexBattleField, type CalcdexPokemon } from '@showdex/interfaces/calc';
import { calcMoveBasePower } from './calcMoveBasePower';

// minimal stand-in for Showdown's global Dex, which only exists in the client
const moves: Record<string, [type: string, basePower: number]> = {
  Thunderbolt: ['Electric', 90],
  Flamethrower: ['Fire', 90],
  Surf: ['Water', 90],
  Tackle: ['Normal', 40],
};

const modGen = (gen: number) => ({
  gen,
  moves: {
    get: (name: string) => {
      const [type, basePower] = moves[name] || [];
      const legacyBasePower = name === 'Thunderbolt' && gen < 6 ? 95 : basePower;

      return type ? { exists: true, name, type, basePower: legacyBasePower } : { exists: false };
    },
  },
});

const pokemon = (ability?: string) => ({
  speciesForme: 'Pikachu',
  ability: ability as AbilityName,
}) as CalcdexPokemon;

const field = (conditions: Partial<CalcdexBattleField>) => conditions as CalcdexBattleField;

beforeAll(() => {
  vi.stubGlobal('Dex', { ...modGen(9), forGen: modGen, mod: () => modGen(9) });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('calcMoveBasePower() — Mud Sport & Water Sport', () => {
  it('halves Electric moves under Mud Sport in gen 3 (95 -> 47)', () => {
    expect(calcMoveBasePower('gen3ou', pokemon(), 'Thunderbolt' as MoveName, {
      field: field({ isMudSport: true }),
    })).toBe(47);
  });

  it('weakens Electric moves to 1352/4096 under Mud Sport in gens 5+ (90 -> 30)', () => {
    expect(calcMoveBasePower('gen6ou', pokemon(), 'Thunderbolt' as MoveName, {
      field: field({ isMudSport: true }),
    })).toBe(30);
  });

  it('weakens Fire moves under Water Sport (90 -> 30)', () => {
    expect(calcMoveBasePower('gen5ou', pokemon(), 'Flamethrower' as MoveName, {
      field: field({ isWaterSport: true }),
    })).toBe(30);
  });

  it('ignores moves of other types', () => {
    const sports = field({ isMudSport: true, isWaterSport: true });

    expect(calcMoveBasePower('gen6ou', pokemon(), 'Surf' as MoveName, { field: sports })).toBe(90);
    expect(calcMoveBasePower('gen6ou', pokemon(), 'Thunderbolt' as MoveName, {
      field: field({ isWaterSport: true }),
    })).toBe(90);
  });

  it('does nothing when neither is active', () => {
    expect(calcMoveBasePower('gen6ou', pokemon(), 'Thunderbolt' as MoveName, { field: field({}) })).toBe(90);
    expect(calcMoveBasePower('gen6ou', pokemon(), 'Thunderbolt' as MoveName)).toBe(90);
  });

  it('weakens Galvanize-boosted Normal moves under Mud Sport (40 -> 48 -> 16)', () => {
    expect(calcMoveBasePower('gen7ou', pokemon('Galvanize'), 'Tackle' as MoveName, {
      field: field({ isMudSport: true }),
    })).toBe(16);
  });

  it('ignores Electric moves turned Normal by Normalize', () => {
    expect(calcMoveBasePower('gen5ou', pokemon('Normalize'), 'Thunderbolt' as MoveName, {
      field: field({ isMudSport: true }),
    })).toBe(95);
  });
});
