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
    const kind = p.category === 'new_project' ? 'New tourism project' : 'Destination'
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
  cache = { places, chunks }
  return cache
}

export function resetKnowledgeCache() {
  cache = null
}
