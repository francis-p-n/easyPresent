/**
 * Checks that a code-signing certificate is set up before a release build, so an unsigned
 * installer is never shipped by accident. electron-builder signs automatically when it finds
 * the certificate in these environment variables:
 *
 *   CSC_LINK          path to the .pfx / .p12 file (or a base64 string of it)
 *   CSC_KEY_PASSWORD  its password
 *
 * See docs/CODE_SIGNING.md. Run through `npm run build:signed`.
 */
const fs = require('node:fs')

/** Returns a list of problems (empty when the build can be signed). */
function signingProblems(env = process.env, exists = fs.existsSync) {
  const problems = []
  const link = env.CSC_LINK
  if (!link) {
    problems.push('CSC_LINK is not set (the path to your .pfx certificate file).')
  } else if (!/^https?:|^data:|^[A-Za-z0-9+/=]{200,}$/.test(link) && !exists(link)) {
    problems.push(`CSC_LINK points to a file that does not exist: ${link}`)
  }
  if (!env.CSC_KEY_PASSWORD) problems.push('CSC_KEY_PASSWORD is not set (the certificate password).')
  return problems
}

module.exports = { signingProblems }

if (require.main === module) {
  const problems = signingProblems()
  if (problems.length) {
    console.error('Cannot build a signed installer:')
    for (const p of problems) console.error('  - ' + p)
    console.error('Set them up as described in docs/CODE_SIGNING.md, or run "npm run build" for an unsigned test build.')
    process.exit(1)
  }
  console.log('Signing certificate found. Building a signed installer.')
}
