import { describe, it, expect } from 'vitest'
import {
  MASTER_ARRANGEMENT_ID,
  getArrangements,
  getActiveArrangementId,
  getActiveSequence,
  createArrangement,
  deleteArrangement,
  renameArrangement,
  setArrangementSequence
} from './arrangement.js'

const makePres = (overrides = {}) => ({
  id: 'p1',
  slides: [
    { id: 's1', label: 'Verse 1', text: 'v1' },
    { id: 's2', label: 'Chorus', text: 'c' },
    { id: 's3', label: 'Verse 2', text: 'v2' },
    { id: 's4', label: 'Bridge', text: 'b' }
  ],
  ...overrides
})

describe('getArrangements', () => {
  it('synthesizes a Master arrangement mirroring slide order when none is stored', () => {
    const pres = makePres()
    const arrangements = getArrangements(pres)
    expect(arrangements).toEqual([{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: ['s1', 's2', 's3', 's4'] }])
  })

  it('returns stored arrangements verbatim when present', () => {
    const custom = [{ id: 'arr-1', name: 'Radio Edit', sequence: ['s2', 's2'] }]
    const pres = makePres({ arrangements: custom })
    expect(getArrangements(pres)).toBe(custom)
  })

  it('returns an empty array for a missing presentation', () => {
    expect(getArrangements(null)).toEqual([])
    expect(getArrangements(undefined)).toEqual([])
  })

  it('handles a presentation with no slides', () => {
    const pres = makePres({ slides: [] })
    expect(getArrangements(pres)).toEqual([{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: [] }])
  })
})

describe('getActiveArrangementId', () => {
  it('defaults to Master when unset', () => {
    expect(getActiveArrangementId(makePres())).toBe(MASTER_ARRANGEMENT_ID)
  })

  it('returns the stored active id', () => {
    expect(getActiveArrangementId(makePres({ activeArrangementId: 'arr-1' }))).toBe('arr-1')
  })
})

describe('getActiveSequence', () => {
  it('returns pres.slides by reference (identity) when no custom arrangement exists', () => {
    const pres = makePres()
    expect(getActiveSequence(pres)).toBe(pres.slides)
  })

  it('resolves a custom arrangement, including repeated entries', () => {
    const pres = makePres({
      arrangements: [{ id: 'arr-1', name: 'Set', sequence: ['s1', 's2', 's3', 's2', 's4', 's2'] }],
      activeArrangementId: 'arr-1'
    })
    const seq = getActiveSequence(pres)
    expect(seq.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's2', 's4', 's2'])
    // Repeated entries are the SAME object reference, not clones
    expect(seq[1]).toBe(seq[3])
    expect(seq[1]).toBe(seq[5])
  })

  it('drops stale slide ids that no longer exist', () => {
    const pres = makePres({
      arrangements: [{ id: 'arr-1', name: 'Set', sequence: ['s1', 'deleted-id', 's2'] }],
      activeArrangementId: 'arr-1'
    })
    expect(getActiveSequence(pres).map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('falls back to pres.slides if every referenced id is stale (no blank grid)', () => {
    const pres = makePres({
      arrangements: [{ id: 'arr-1', name: 'Set', sequence: ['gone-1', 'gone-2'] }],
      activeArrangementId: 'arr-1'
    })
    expect(getActiveSequence(pres)).toBe(pres.slides)
  })

  it('falls back to Master when activeArrangementId points at a nonexistent arrangement', () => {
    const pres = makePres({
      arrangements: [{ id: 'arr-1', name: 'Set', sequence: ['s2'] }],
      activeArrangementId: 'does-not-exist'
    })
    // Falls back to Master (pres.slides), not an arbitrary other custom arrangement
    expect(getActiveSequence(pres)).toBe(pres.slides)
  })

  it('returns Master even when custom arrangements exist, if Master is explicitly active', () => {
    const pres = makePres({
      arrangements: [{ id: 'arr-1', name: 'Set', sequence: ['s2', 's2'] }],
      activeArrangementId: MASTER_ARRANGEMENT_ID
    })
    expect(getActiveSequence(pres)).toBe(pres.slides)
  })

  it('returns an empty array for a missing presentation or missing slides array', () => {
    expect(getActiveSequence(null)).toEqual([])
    expect(getActiveSequence({})).toEqual([])
  })

  it('handles an empty custom sequence (falls back to Master, not blank)', () => {
    const pres = makePres({
      arrangements: [{ id: 'arr-1', name: 'Empty', sequence: [] }],
      activeArrangementId: 'arr-1'
    })
    expect(getActiveSequence(pres)).toBe(pres.slides)
  })
})

describe('createArrangement', () => {
  it('appends a new empty arrangement and returns its id', () => {
    const { arrangements, newId } = createArrangement([{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: [] }], 'My Set')
    expect(arrangements).toHaveLength(2)
    expect(arrangements[1]).toEqual({ id: newId, name: 'My Set', sequence: [] })
  })

  it('defaults the name when none is given', () => {
    const { arrangements } = createArrangement([], '')
    expect(arrangements[0].name).toBe('New Arrangement')
  })

  it('does not mutate the input array', () => {
    const input = [{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: [] }]
    const before = JSON.stringify(input)
    createArrangement(input, 'X')
    expect(JSON.stringify(input)).toBe(before)
  })

  it('generates distinct ids across calls', () => {
    const a = createArrangement([], 'A').newId
    const b = createArrangement([], 'B').newId
    expect(a).not.toBe(b)
  })
})

describe('deleteArrangement', () => {
  it('removes the given arrangement', () => {
    const input = [
      { id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: [] },
      { id: 'arr-1', name: 'Set', sequence: [] }
    ]
    expect(deleteArrangement(input, 'arr-1')).toEqual([{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: [] }])
  })

  it('refuses to delete Master', () => {
    const input = [{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: [] }]
    expect(deleteArrangement(input, MASTER_ARRANGEMENT_ID)).toBe(input)
  })

  it('is a no-op for an unknown id', () => {
    const input = [{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: [] }]
    expect(deleteArrangement(input, 'nope')).toEqual(input)
  })
})

describe('renameArrangement', () => {
  it('renames the matching arrangement only', () => {
    const input = [
      { id: 'arr-1', name: 'Old', sequence: [] },
      { id: 'arr-2', name: 'Other', sequence: [] }
    ]
    const result = renameArrangement(input, 'arr-1', 'New')
    expect(result[0].name).toBe('New')
    expect(result[1].name).toBe('Other')
  })

  it('does not mutate the input array', () => {
    const input = [{ id: 'arr-1', name: 'Old', sequence: [] }]
    renameArrangement(input, 'arr-1', 'New')
    expect(input[0].name).toBe('Old')
  })
})

describe('setArrangementSequence', () => {
  it('replaces the sequence for the matching arrangement', () => {
    const input = [{ id: 'arr-1', name: 'Set', sequence: ['s1'] }]
    const result = setArrangementSequence(input, 'arr-1', ['s1', 's2', 's1'])
    expect(result[0].sequence).toEqual(['s1', 's2', 's1'])
  })

  it('does not mutate the original sequence array', () => {
    const original = ['s1']
    const input = [{ id: 'arr-1', name: 'Set', sequence: original }]
    setArrangementSequence(input, 'arr-1', ['s1', 's2'])
    expect(original).toEqual(['s1'])
  })

  it('leaves other arrangements untouched', () => {
    const input = [
      { id: 'arr-1', name: 'A', sequence: ['s1'] },
      { id: 'arr-2', name: 'B', sequence: ['s2'] }
    ]
    const result = setArrangementSequence(input, 'arr-1', ['s1', 's1'])
    expect(result[1].sequence).toEqual(['s2'])
  })
})
