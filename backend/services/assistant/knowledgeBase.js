/**
 * Curated travel knowledge base (backend/data/knowledge/*.json): historic and
 * natural sites, plus the new tourism projects (Beautifying Sheger, Dine for
 * Ethiopia / Dine for Generations). Each place is split into retrievable chunks.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', 'data', 'knowledge')

/** Common alternative spellings / transliterations, matched as place names. */
const ALIASES = {
  lalibela: 'lalibala lalibella roha',
  'gondar-fasil-ghebbi': 'gonder gondor fasil fasilides castle castles camelot',
  axum: 'aksum axsum obelisk obelisks stelae',
  'bahir-dar-lake-tana': 'bahirdar bahar tana blue nile falls tis abay tissisat',
  'simien-mountains': 'semien simen ras dashen gelada',
  'harar-jugol': 'harer hyena',
  'danakil-depression-erta-ale': 'dallol afar danakil ertale volcano salt',
  'bale-mountains': 'bale sanetti harenna wolf',
  'omo-valley': 'omo jinka turmi mursi hamer',
  'tigray-rock-hewn-churches-gheralta': 'gheralta geralta abuna yemata hawzen',
  'arba-minch-nechisar': 'arbaminch nechisar nech sar chamo abaya',
  'konso-cultural-landscape': 'konso',
  'sof-omar-caves': 'sofomar',
  'yeha-debre-damo': 'yeha debre damo',
  'awash-national-park': 'awash',
  'dire-dawa': 'diredawa',
  'tiya-stelae': 'tiya tia',
  'unity-park-addis-ababa': 'andinet unity palace',
  'entoto-park-addis-ababa': 'entoto',
  'friendship-park-addis-ababa': 'wodajinet sheger friendship',
  'addis-ababa-riverside-corridors': 'riverside corridor kechene kebena',
  'adwa-victory-memorial': 'adwa zero kilometre kilometer',
  'ethiopian-science-museum': 'science museum',
  'abrehot-library': 'abrehot library',
  'gorgora-eco-resort': 'gorgora',
  'halala-kella-resort-koysha': 'halala kella koysha dawro',
  'chebera-churchura-elephant-paw-lodge': 'chebera churchura elephant paw',
  'wonchi-dendi-ecotourism-village': 'wonchi wenchi crater',
  'beynouna-village-lake-beseka': 'beynouna beynuna beynona beyinuna beseka metehara',
  'logo-hayk-resort': 'logo hayk haik hayq lake hayk wollo',
  'denbi-eco-lodge': 'denbi dembi',
  'shabeely-resort-jigjiga': 'shabeely shabelle jigjiga',
  'niin-lee-palm-lodge-afar': 'niin lee palm',
  'haroo-dendi-lodge': 'haroo dendi',
  'arba-minch-conference-resort': 'arba minch conference',
  'jimma-boye-lake-project': 'jimma boye',
  // North & east
  'lake-tana-monasteries-zege-peninsula': 'zege ura kidane mehret monastery monasteries island islands tana',
  'debre-berhan-selassie-church-gondar': 'debre birhan selassie angels ceiling',
  'mekele-city': 'mekelle mekele makale tigray',
  'wukro-chirkos': 'wukro cherkos chirkos',
  'negash-al-nejashi-mosque': 'negash nejashi najashi mosque',
  'lake-afrera': 'afrera afdera giulietti salt',
  'lake-abbe': 'abbe abhe chimneys',
  'asaita': 'asayita aussa awsa sultanate',
  'babile-elephant-sanctuary': 'babile elephants elephant',
  'dakata-valley-of-marvels': 'dakata marvels rock formations',
  'jijiga': 'jigjiga somali',
  'lake-hayk-istifanos-monastery': 'hayq haik istifanos stephen',
  'dessie-kombolcha': 'dessie dese kombolcha wollo',
  'guassa-community-conservation-area': 'guassa menz gelada wolf',
  'ankober': 'ankober menelik shewa shoa',
  // South & west
  'hawassa-lake-hawassa': 'hawassa awassa awasa amora gedel fish market sidama',
  'lake-langano': 'langano bishangari',
  'abijatta-shalla-national-park': 'abijata abijatta shalla shala flamingo flamingos',
  'lake-ziway-tulu-gudo': 'ziway zway batu tulu gudo',
  'bishoftu-crater-lakes': 'bishoftu debre zeyit zeit babogaya hora kuriftu crater',
  'mount-zuqualla-monastery': 'zuqualla zuquala zikuala',
  'debre-libanos-blue-nile-gorge': 'debre libanos portuguese bridge gorge',
  'menagesha-suba-forest': 'menagesha suba forest',
  'adadi-mariam-rock-church': 'adadi mariam',
  'melka-kunture-balchit': 'melka kunture balchit prehistoric obsidian',
  'dorze-chencha-gamo-highlands': 'dorze chencha gamo weaving beehive',
  'senkelle-swaynes-hartebeest-sanctuary': 'senkele senkelle hartebeest',
  'yabelo-borana-singing-wells': 'yabelo borana borena singing wells sod',
  'wondo-genet-hot-springs': 'wondo genet wendo hot springs',
  'gedeo-cultural-landscape': 'gedeo dilla stelae',
  'jimma-abba-jifar-palace': 'abba jifar jiffar palace jimma',
  'kafa-biosphere-reserve-bonga': 'kafa kaffa bonga coffee forest wild',
  'gambella-national-park': 'gambella gambela kob migration',
  // Addis sights, festivals, food
  'national-museum-of-ethiopia': 'lucy dinkinesh national museum fossil',
  'holy-trinity-cathedral-addis-ababa': 'trinity selassie kidist haile tomb',
  'ethnological-museum-addis-ababa': 'ethnological genete leul sidist kilo',
  'red-terror-martyrs-memorial-museum': 'red terror derg martyrs',
  'merkato-addis-ababa': 'merkato mercato market shopping',
  'st-georges-cathedral-addis-ababa': 'george georges giorgis piassa piazza',
  'zoma-museum-addis-ababa': 'zoma',
  'tomoca-addis-coffee-culture': 'tomoca coffee cafe cafes macchiato',
  'timket-ethiopian-epiphany': 'timket timkat epiphany january',
  'meskel-festival': 'meskel maskal demera cross september',
  'genna-ethiopian-christmas-lalibela': 'genna gena christmas january',
  'irreecha-festival': 'irreecha irrecha thanksgiving oromo bishoftu',
  'fichee-chambalaalaa-sidama-new-year': 'fichee fiche chambalaalaa chambalala sidama new year',
  'ashenda-ashendye-festival': 'ashenda ashendye shadey solel august girls',
  'ethiopian-coffee-ceremony': 'coffee ceremony buna jebena',
  'ethiopian-cuisine-guide': 'injera wat wot kitfo tibs shiro doro fasting vegan vegetarian dishes cuisine',
  'great-ethiopian-run': 'great run marathon race running',
  'addis-international-convention-center': 'aicc convention center centre',
  'meskel-square-renovation': 'meskel square plaza',
  'arada-park-addis-ababa': 'arada park',
  'felege-gion-eco-resort-bahir-dar': 'felege gion',
  'sorga-eco-lodge-nekemte': 'sorga nekemte wollega',
}

/** How each category is labelled in answers and in the generated place index. */
const KIND = {
  new_project: 'New tourism project',
  festival: 'Festival',
  food: 'Food and drink',
  experience: 'Experience',
  museum: 'Museum',
  market: 'Market',
  religious: 'Religious site',
  historic: 'Historic site',
  culture: 'Cultural site',
  cultural: 'Cultural site',
  city: 'City',
  lake: 'Lake',
  nature: 'Nature',
  wildlife: 'Wildlife and national park',
}

const GROUPS = [
  ['Historic and religious sites', ['historic', 'religious']],
  ['Nature, lakes and wildlife', ['nature', 'lake', 'wildlife']],
  ['Cities and culture', ['city', 'culture', 'cultural', 'market']],
  ['Museums in Addis Ababa', ['museum']],
  ['Festivals and events', ['festival']],
  ['Food, coffee and experiences', ['food', 'experience']],
  ['New tourism projects', ['new_project']],
]

const firstSentence = (t = '') => (t.match(/^.*?[.!?](\s|$)/)?.[0] || t).trim().slice(0, 170)

/**
 * Generated "index" chunks so broad questions ("which places do you know?",
 * "what festivals are there?") get a complete list instead of a few top matches.
 */
function indexChunks(places) {
  const chunks = []
  const lines = []
  const grouped = new Set()
  for (const [label, cats] of GROUPS) {
    const members = places.filter((p) => cats.includes(p.category))
    if (!members.length) continue
    members.forEach((p) => grouped.add(p.id))
    lines.push(`${label} (${members.length}): ${members.map((p) => p.name).join('; ')}`)
    chunks.push({
      id: `index#${cats[0]}`,
      placeId: `index-${cats[0]}`,
      title: `Guide index: ${label}`,
      section: 'index',
      category: 'index',
      coordinates: null,
      sources: [],
      boostText: `${label} list all which`,
      text: `${label} covered by the Visit Ethiopia guide (${members.length}):\n${members
        .map((p) => `- ${p.name} (${p.region}): ${firstSentence(p.summary)}`)
        .join('\n')}`,
    })
  }
  const other = places.filter((p) => !grouped.has(p.id))
  if (other.length) lines.push(`Other (${other.length}): ${other.map((p) => p.name).join('; ')}`)
  chunks.unshift({
    id: 'index#all',
    placeId: 'index-all',
    title: 'Guide index: all places',
    section: 'index',
    category: 'index',
    coordinates: null,
    sources: [],
    boostText: 'places destinations list all which know cover recommend attractions guide index',
    text: `The Visit Ethiopia travel guide covers ${places.length} places and topics:\n${lines.join('\n')}`,
  })
  return chunks
}

function list(items) {
  return (items || []).filter(Boolean).map((x) => `- ${x}`).join('\n')
}

function venues(items) {
  return (items || [])
    .map((v) => `- ${v.name}${v.area ? ` (${v.area})` : ''}${v.cuisine ? `, ${v.cuisine}` : ''}${v.description ? `: ${v.description}` : ''}`)
    .join('\n')
}

let cache = null

export function loadKnowledge() {
  if (cache) return cache
  const places = []
  for (const file of fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const rows = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8'))
    for (const p of rows) places.push(p)
  }

  const chunks = []
  for (const p of places) {
    const kind = KIND[p.category] || 'Destination'
    const header = `${p.name} — ${kind} in ${p.region}${p.nearestCity ? ` (near ${p.nearestCity})` : ''}`
    const base = {
      placeId: p.id,
      title: p.name,
      coordinates: p.coordinates || null,
      sources: p.sources || [],
      category: p.category,
      boostText: `${p.name} ${p.nearestCity || ''} ${ALIASES[p.id] || ''}`,
    }
    const status = p.status ? `Status: ${p.status}\n` : ''
    const initiative = p.initiative ? `Initiative: ${p.initiative}\n` : ''
    chunks.push({
      ...base,
      id: `${p.id}#overview`,
      section: 'overview',
      text: `${header}\n${status}${initiative}${p.summary}\n\n${p.details || ''}\n\nHighlights:\n${list(p.highlights)}`,
    })
    chunks.push({
      ...base,
      id: `${p.id}#practical`,
      section: 'practical',
      text: `${header} — practical information\n${status}Best time to visit: ${p.bestTimeToVisit || 'n/a'}\nGetting there: ${p.gettingThere || 'n/a'}\nTips:\n${list(p.tips)}${p.confidenceNotes ? `\nNotes and current advisories: ${p.confidenceNotes}` : ''}`,
    })
    if ((p.hotels || []).length || (p.restaurants || []).length) {
      chunks.push({
        ...base,
        id: `${p.id}#stay-eat`,
        section: 'stay-eat',
        boostText: `${base.boostText} hotel hotels lodge resort stay accommodation restaurant restaurants food eat`,
        text: `${header} — where to stay and eat\nHotels and lodges:\n${venues(p.hotels) || '- none listed'}\nRestaurants:\n${venues(p.restaurants) || '- none listed (visitors usually eat at their lodge)'}`,
      })
    }
  }
  chunks.push(...indexChunks(places))
  cache = { places, chunks }
  return cache
}

export function resetKnowledgeCache() {
  cache = null
}
