import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const { signingProblems } = createRequire(import.meta.url)('./check-signing.js')

describe('signingProblems', () => {
  it('reports a missing certificate and password', () => {
    const problems = signingProblems({}, () => false)
    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(/CSC_LINK is not set/)
    expect(problems[1]).toMatch(/CSC_KEY_PASSWORD/)
  })

  it('reports a certificate path that is not there', () => {
    expect(signingProblems({ CSC_LINK: 'C:\\certs\\missing.pfx', CSC_KEY_PASSWORD: 'x' }, () => false)[0]).toMatch(/does not exist/)
  })

  it('accepts an existing file, a URL, or an inline base64 certificate', () => {
    expect(signingProblems({ CSC_LINK: 'C:\\certs\\ok.pfx', CSC_KEY_PASSWORD: 'x' }, () => true)).toEqual([])
    expect(signingProblems({ CSC_LINK: 'https://example.org/c.pfx', CSC_KEY_PASSWORD: 'x' }, () => false)).toEqual([])
    expect(signingProblems({ CSC_LINK: 'A'.repeat(300), CSC_KEY_PASSWORD: 'x' }, () => false)).toEqual([])
  })
})
