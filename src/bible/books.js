/**
 * books — the books of the Bible and every way people (and Bible files) write them.
 *
 * Covers the 66 books plus the deuterocanonical books an NRSV-CE or other
 * Catholic/Orthodox Bible contains. `resolveBook()` accepts full names,
 * abbreviations ("Jn", "1 Cor", "Ps"), OSIS ids ("1Cor", "Phlm"), roman and
 * spelled-out numbers ("II Kings", "First John"), with any spacing or dots.
 */

// [canonical name, aliases]. Aliases for numbered books are written without the number.
const BOOKS = [
  ['Genesis', ['gen', 'ge', 'gn']],
  ['Exodus', ['exod', 'exo', 'ex']],
  ['Leviticus', ['lev', 'le', 'lv']],
  ['Numbers', ['num', 'nu', 'nm', 'nb']],
  ['Deuteronomy', ['deut', 'dt', 'de']],
  ['Joshua', ['josh', 'jos', 'jsh']],
  ['Judges', ['judg', 'jdg', 'jg', 'jdgs']],
  ['Ruth', ['rth', 'ru']],
  ['1 Samuel', ['sam', 'samuel', 'sa', 'sm']],
  ['2 Samuel', ['sam', 'samuel', 'sa', 'sm']],
  ['1 Kings', ['kgs', 'kings', 'ki', 'kg']],
  ['2 Kings', ['kgs', 'kings', 'ki', 'kg']],
  ['1 Chronicles', ['chr', 'chron', 'chronicles', 'ch']],
  ['2 Chronicles', ['chr', 'chron', 'chronicles', 'ch']],
  ['Ezra', ['ezr']],
  ['Nehemiah', ['neh', 'ne']],
  ['Esther', ['esth', 'est', 'es']],
  ['Job', ['jb']],
  ['Psalms', ['ps', 'psalm', 'psa', 'pss', 'psm']],
  ['Proverbs', ['prov', 'pro', 'prv', 'pr']],
  ['Ecclesiastes', ['eccl', 'eccles', 'ecc', 'qoh', 'qoheleth']],
  ['Song of Solomon', ['song', 'songofsongs', 'songofsol', 'sos', 'sng', 'canticles', 'canticleofcanticles', 'cant']],
  ['Isaiah', ['isa', 'is']],
  ['Jeremiah', ['jer', 'je', 'jr']],
  ['Lamentations', ['lam', 'la']],
  ['Ezekiel', ['ezek', 'eze', 'ezk']],
  ['Daniel', ['dan', 'da', 'dn']],
  ['Hosea', ['hos', 'ho']],
  ['Joel', ['jl']],
  ['Amos', ['am']],
  ['Obadiah', ['obad', 'ob']],
  ['Jonah', ['jon', 'jnh']],
  ['Micah', ['mic', 'mi']],
  ['Nahum', ['nah', 'na']],
  ['Habakkuk', ['hab', 'hb']],
  ['Zephaniah', ['zeph', 'zep', 'zp']],
  ['Haggai', ['hag', 'hg']],
  ['Zechariah', ['zech', 'zec', 'zc']],
  ['Malachi', ['mal', 'ml']],
  ['Matthew', ['matt', 'mat', 'mt']],
  ['Mark', ['mrk', 'mar', 'mk', 'mr']],
  ['Luke', ['luk', 'lk']],
  ['John', ['joh', 'jhn', 'jn']],
  ['Acts', ['act', 'ac', 'actsoftheapostles']],
  ['Romans', ['rom', 'ro', 'rm']],
  ['1 Corinthians', ['cor', 'corinthians', 'co']],
  ['2 Corinthians', ['cor', 'corinthians', 'co']],
  ['Galatians', ['gal', 'ga']],
  ['Ephesians', ['eph', 'ephes']],
  ['Philippians', ['phil', 'php', 'pp']],
  ['Colossians', ['col', 'co']],
  ['1 Thessalonians', ['thess', 'thessalonians', 'thes', 'th']],
  ['2 Thessalonians', ['thess', 'thessalonians', 'thes', 'th']],
  ['1 Timothy', ['tim', 'timothy', 'ti']],
  ['2 Timothy', ['tim', 'timothy', 'ti']],
  ['Titus', ['tit']],
  ['Philemon', ['philem', 'phlm', 'phm']],
  ['Hebrews', ['heb']],
  ['James', ['jas', 'jm']],
  ['1 Peter', ['pet', 'peter', 'pe', 'pt']],
  ['2 Peter', ['pet', 'peter', 'pe', 'pt']],
  ['1 John', ['jn', 'john', 'joh', 'jhn']],
  ['2 John', ['jn', 'john', 'joh', 'jhn']],
  ['3 John', ['jn', 'john', 'joh', 'jhn']],
  ['Jude', ['jud', 'jd']],
  ['Revelation', ['rev', 're', 'rv', 'revelations', 'apocalypse', 'apoc']],

  // Deuterocanon (NRSV-CE and other Catholic / Orthodox Bibles)
  ['Tobit', ['tob', 'tb']],
  ['Judith', ['jdt', 'jth']],
  ['Additions to Esther', ['addesth', 'addtoesther', 'greekesther', 'esthergreek', 'restofesther']],
  ['Wisdom', ['wis', 'wisdomofsolomon', 'ws']],
  ['Sirach', ['sir', 'ecclesiasticus', 'ecclus', 'wisdomofsirach', 'benSira']],
  ['Baruch', ['bar']],
  ['Letter of Jeremiah', ['epjer', 'letterjeremiah', 'epistleofjeremiah', 'lje']],
  ['Prayer of Azariah', ['prazar', 'songofthethreeyoungmen', 'songofthreeyouths', 'azariah']],
  ['Susanna', ['sus']],
  ['Bel and the Dragon', ['bel', 'beldragon']],
  ['1 Maccabees', ['macc', 'maccabees', 'mac', 'ma']],
  ['2 Maccabees', ['macc', 'maccabees', 'mac', 'ma']],
  ['1 Esdras', ['esd', 'esdras']],
  ['2 Esdras', ['esd', 'esdras']],
  ['Prayer of Manasseh', ['prman', 'manasseh', 'prayerofmanasses']]
]

const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

const NUMBER_FORMS = {
  1: ['1', 'i', '1st', 'first'],
  2: ['2', 'ii', '2nd', 'second'],
  3: ['3', 'iii', '3rd', 'third']
}

const lookup = new Map() // normalized alias -> canonical name

function add(alias, name) {
  const k = key(alias)
  // first claim wins, so a short alias shared by two books ("co") keeps its first owner
  if (k && !lookup.has(k)) lookup.set(k, name)
}

for (const [name, aliases] of BOOKS) {
  add(name, name)
  const numbered = name.match(/^([123]) (.+)$/)
  if (numbered) {
    const [, n, base] = numbered
    for (const prefix of NUMBER_FORMS[n]) {
      add(prefix + base, name)
      for (const a of aliases) add(prefix + a, name)
    }
  } else {
    for (const a of aliases) add(a, name)
  }
}

/** Every book name, in Bible order. */
export const BOOK_NAMES = BOOKS.map(([name]) => name)

/**
 * The canonical book for what someone typed or a file called it, or null.
 * An unambiguous prefix of a full name also works ("revel" -> Revelation).
 */
export function resolveBook(input) {
  const k = key(input)
  if (!k) return null
  if (lookup.has(k)) return lookup.get(k)
  if (k.length >= 3) {
    const matches = new Set()
    for (const name of BOOK_NAMES) if (key(name).startsWith(k)) matches.add(name)
    if (matches.size === 1) return [...matches][0]
  }
  return null
}
