import React, { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Tag, ChevronRight, Search } from 'lucide-react';
// Mock data for blog posts
const blogPosts = [{
  id: '1',
  title: "The Ultimate Guide to Ethiopia's Historic Northern Circuit",
  excerpt: 'Discover the ancient wonders of Lalibela, Axum, and Gondar with our comprehensive guide to planning the perfect northern Ethiopia itinerary.',
  content: "Ethiopia's northern circuit is home to some of the most remarkable historical sites in Africa. From the rock-hewn churches of Lalibela to the ancient stelae of Axum and the castles of Gondar, this region offers an incredible journey through time. This guide will help you plan your perfect northern Ethiopia adventure, including how to get around, where to stay, what to see, and insider tips to make your experience unforgettable.\n\nLalibela, often called the 'Eighth Wonder of the World,' features 11 medieval churches carved from solid rock. Plan to spend at least two full days exploring these remarkable structures, ideally with a knowledgeable local guide who can explain their religious significance and architectural brilliance. The most iconic is Bet Giyorgis (St. George's Church), carved in the shape of a cross and best viewed early morning when the light accentuates its features.\n\nAxum, the ancient capital of the Aksumite Empire, is shrouded in mystery and legend. The massive granite stelae that dominate the town are engineering marvels, especially considering they were erected in the 4th century. Don't miss the Queen of Sheba's Bath and the Church of St. Mary of Zion, which according to Ethiopian Orthodox tradition, houses the Ark of the Covenant.\n\nGondar, known as the 'Camelot of Africa,' boasts an impressive Royal Enclosure with multiple castles built in the 17th and 18th centuries. The architectural influence of various cultures is evident in these structures, reflecting Ethiopia's historical connections with Europe, the Middle East, and India. Nearby Debre Berhan Selassie Church, with its famous ceiling of painted angels, is a must-visit.\n\nTo fully appreciate the northern circuit, consider allocating 10-14 days for your journey. The most efficient way to travel between these sites is by domestic flights, though road travel offers a deeper connection with the stunning landscapes and rural communities. Accommodations range from basic guesthouses to boutique hotels, with options to suit various budgets.\n\nThe best time to visit is during the dry season (October to March), when roads are more accessible and clear skies enhance your experience of these magnificent sites. Regardless of when you visit, prepare to be transformed by Ethiopia's northern treasures – a living museum of human achievement and spiritual devotion.",
  image: 'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80',
  date: 'November 10, 2023',
  author: 'Daniel Kebede',
  category: 'Travel Guides',
  tags: ['Historical Sites', 'Lalibela', 'Axum', 'Gondar', 'Northern Ethiopia']
}, {
  id: '2',
  title: "Ethiopia's Coffee Culture: From Bean to Cup",
  excerpt: "Explore the birthplace of coffee and learn about Ethiopia's ancient coffee traditions, from wild forest harvesting to the elaborate coffee ceremony.",
  content: "Ethiopia is widely recognized as the birthplace of coffee, with the legend of Kaldi the goatherd discovering the energizing effects of coffee berries when his goats became unusually spirited after consuming them. Today, coffee remains central to Ethiopian culture, economy, and daily life. This article takes you on a journey through Ethiopia's rich coffee heritage, from the misty forests where wild coffee still grows to the elaborate ceremony that transforms simple beans into a communal experience.\n\nIn the southwestern forests of Ethiopia, particularly in Kaffa (from which coffee derives its name), wild coffee still grows beneath the forest canopy. These ancient coffee forests represent the original genetic diversity of Arabica coffee and are increasingly protected as both cultural and ecological treasures. Some of the world's most distinctive and sought-after coffee varieties originate from specific regions of Ethiopia, including Yirgacheffe, Sidamo, and Harrar, each with its unique flavor profile influenced by local growing conditions.\n\nBeyond being an agricultural product, coffee in Ethiopia is a social institution. The Ethiopian coffee ceremony is a ritual of hospitality and community that can last for hours. The ceremony begins with the washing of green coffee beans, which are then roasted over hot coals in a flat pan. The hostess continuously wafts the aromatic smoke toward guests as an invitation to enjoy the fragrance. The roasted beans are then ground with a traditional mortar and pestle and brewed in a special clay pot called a jebena.\n\nCoffee is typically served in three rounds – Abol (first), Tona (second), and Baraka (blessing) – with each round becoming progressively weaker. Refusing coffee before the third round is considered impolite. The ceremony is accompanied by burning incense to create an immersive sensory experience and is often complemented with small snacks like popcorn or peanuts.\n\nFor visitors to Ethiopia, participating in a coffee ceremony offers insight into the country's social fabric and values of community and hospitality. In Addis Ababa, numerous cultural restaurants offer the experience, while in rural areas, being invited to a family's coffee ceremony is a special honor.\n\nEthiopia's coffee industry faces challenges from climate change and market fluctuations, but initiatives promoting sustainable practices and fair trade are helping preserve this vital heritage. By supporting Ethiopian coffee, consumers worldwide can contribute to protecting not just exceptional quality beans, but a cultural tradition thousands of years in the making.",
  image: 'https://images.unsplash.com/photo-1447933601403-0c44657c85b7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2056&q=80',
  date: 'November 5, 2023',
  author: 'Sarah Johnson',
  category: 'Culture',
  tags: ['Coffee', 'Cultural Traditions', 'Ethiopian Cuisine']
}, {
  id: '3',
  title: "Wildlife Watching in Ethiopia's National Parks",
  excerpt: "From the Ethiopian wolf to the Gelada baboon, discover the unique and diverse wildlife that can be observed in Ethiopia's stunning national parks and reserves.",
  content: "Ethiopia's varied landscapes and ecosystems harbor an impressive array of wildlife, including numerous endemic species found nowhere else on Earth. From the high-altitude Afroalpine moorlands to lowland savannas, the country's national parks offer remarkable wildlife viewing opportunities for nature enthusiasts. This guide explores the best destinations for wildlife watching in Ethiopia and what you can expect to see at each location.\n\nThe Bale Mountains National Park is a biodiversity hotspot and home to the endangered Ethiopian wolf, the rarest canid in the world with fewer than 500 remaining in the wild. These russet-colored wolves can be observed hunting for rodents on the Sanetti Plateau. The park also harbors mountain nyalas, Menelik's bushbucks, giant mole-rats, and over 300 species of birds including 16 endemics. The Harenna Forest in the southern part of the park is one of the few places where you might glimpse the elusive Bale monkey.\n\nThe Simien Mountains National Park, a UNESCO World Heritage site, is famous for its dramatic scenery and unique wildlife. Here, troops of Gelada baboons (sometimes called 'bleeding heart baboons' for the distinctive red patch on their chests) can be observed at close range as they graze on the high-altitude grasslands. These remarkable primates are the world's only grass-eating monkeys and live in complex social groups that can number several hundred individuals. The park is also home to the endangered Walia ibex and the Ethiopian wolf, though both are more elusive than the geladas.\n\nAwash National Park, located in the Great Rift Valley, offers a different ecosystem and wildlife viewing experience. The savanna landscape supports beisa oryx, greater and lesser kudus, Soemmerring's gazelles, and Salt's dikdiks. The park is also excellent for bird watching, with over 450 species recorded, including the endemic yellow-throated serin.\n\nIn the south, Omo National Park and Mago National Park provide opportunities to see larger savanna species such as buffalo, giraffe, elephant, and various antelope species. These remote parks also offer cultural experiences with the indigenous tribes of the Lower Omo Valley.\n\nThe best time for wildlife viewing in Ethiopia is during the dry season (October to May), when animals concentrate around water sources and vegetation is less dense. Early morning and late afternoon are optimal times for activity. While Ethiopia may not offer the same density of large mammals as East African safari destinations like Kenya or Tanzania, the unique and endemic wildlife, combined with spectacular landscapes and fewer tourists, make it a rewarding destination for nature enthusiasts seeking something different.",
  image: 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80',
  date: 'October 28, 2023',
  author: 'Michael Thompson',
  category: 'Nature & Wildlife',
  tags: ['Wildlife', 'National Parks', 'Ethiopian Wolf', 'Gelada Baboon']
}, {
  id: '4',
  title: "The Danakil Depression: Exploring Earth's Most Alien Landscape",
  excerpt: "Journey to one of the hottest, lowest, and most geologically active places on Earth – Ethiopia's surreal Danakil Depression with its acid pools and salt flats.",
  content: "The Danakil Depression in northeastern Ethiopia holds the distinction of being one of the most extreme environments on our planet. With daytime temperatures regularly exceeding 50°C (122°F), lying more than 100 meters below sea level, and featuring a landscape shaped by volcanic activity and salt formations, visiting the Danakil feels like traveling to another world. This guide explores this geological wonder and provides essential information for those brave enough to venture into 'the gateway to hell.'\n\nThe most iconic sight in the Danakil is Dallol, a volcanic crater featuring acid pools, salt formations, and mineral springs in psychedelic colors – fluorescent yellows, vibrant greens, and fiery oranges created by extreme geochemical processes. The constantly changing landscape of Dallol is the result of the interaction between the hot magma below the surface and the salt and water above. These otherworldly formations make it a photographer's paradise, though the intense heat and toxic fumes require caution.\n\nNearby, Lake Karum (Lake Assale) presents a different but equally surreal landscape. Here, Afar tribesmen have harvested salt for centuries, cutting it into uniform blocks and transporting it via camel caravans to highland markets. Watching these salt workers practicing their ancient trade against the backdrop of the blindingly white salt flats is like witnessing a scene from centuries past.\n\nThe Danakil is also home to Erta Ale, one of the world's most active volcanoes featuring a persistent lava lake. The challenging night hike to the crater rim rewards visitors with the mesmerizing sight of molten lava bubbling and churning – a genuine window into the earth's fiery interior.\n\nVisiting the Danakil Depression requires careful planning and preparation. Tours typically depart from Mekele and last 3-4 days, with basic camping accommodations. Due to extreme conditions, visits are best undertaken between November and March when temperatures are merely very hot rather than unbearable. Travelers should be in good health, bring appropriate sun protection, and carry plenty of water.\n\nThe region has experienced security concerns in the past, so it's essential to travel with reputable operators who employ local Afar guides and security personnel. Despite the challenges, the Danakil Depression offers one of travel's most extraordinary experiences – a chance to witness landscapes so extreme and unusual that they're used by scientists to study the potential for life on other planets. For adventurous travelers seeking to experience our planet's most alien environment, the Danakil Depression represents the ultimate destination.",
  image: 'https://images.unsplash.com/photo-1518002054494-3a6f870d4a8f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  date: 'October 20, 2023',
  author: 'Emma Wilson',
  category: 'Adventure Travel',
  tags: ['Danakil Depression', 'Volcanic Landscapes', 'Extreme Travel', 'Natural Wonders']
}, {
  id: '5',
  title: "Timkat Festival: Experiencing Ethiopia's Colorful Epiphany Celebration",
  excerpt: "Learn about Ethiopia's most spectacular religious festival, Timkat, which commemorates the baptism of Christ with vibrant processions and ceremonies.",
  content: "Timkat, the Ethiopian Orthodox celebration of Epiphany, is arguably the most spectacular festival in Ethiopia's religious calendar. Taking place annually on January 19th (or January 20th in leap years), Timkat commemorates the baptism of Jesus in the Jordan River and transforms cities across Ethiopia into scenes of color, devotion, and joy. This article explores the rich traditions of Timkat and provides guidance for travelers wishing to experience this extraordinary cultural event.\n\nThe festivities begin on Timkat Eve, when priests from each church carry wrapped tabots (replicas of the Ark of the Covenant) on their heads in elaborate processions. Accompanied by chanting, drums, and sistra (traditional rattles), the clergy in their dazzling brocaded vestments are followed by thousands of white-robed participants. The tabots are taken to a nearby body of water where they remain overnight in a tent as priests and the most devout worshippers maintain an all-night vigil.\n\nThe main Timkat ceremony occurs the following morning at dawn. Priests perform prayers and bless the water, which symbolizes the Jordan River. The water is then sprinkled on participants, some of whom immerse themselves fully in the blessed water to renew baptismal vows. The atmosphere is one of profound spiritual significance combined with communal celebration. After the religious ceremonies, the festivities continue with feasting, singing, and dancing.\n\nOn the third day, the tabots are returned to their churches in similarly colorful processions, marking the conclusion of the festival. Throughout Timkat, Ethiopian Orthodox Christians wear their finest traditional clothing. Women don elegant white cotton dresses with colorful borders, while men wear white shammas (cotton togas) often with bright colored stripes.\n\nWhile Timkat is celebrated throughout Ethiopia, certain locations offer particularly memorable experiences. Gondar is especially renowned for its Timkat celebrations centered around the historic Fasilides Bath, a stone pool that is filled with water specially for the occasion. Lalibela and Addis Ababa also host impressive ceremonies, though each town and village across Ethiopia marks the occasion in its own way.\n\nFor travelers wishing to experience Timkat, planning ahead is essential. Accommodations in popular locations like Gondar and Lalibela book up months in advance. Visitors should be respectful observers, dressing modestly and following local customs. Photography is generally permitted but should be done discreetly and respectfully, particularly during the more solemn religious moments.\n\nExperiencing Timkat offers a window into the soul of Ethiopian Orthodox Christianity, a faith that has shaped the country's culture for over 1,600 years. The festival's combination of profound religious devotion, community participation, and joyful celebration makes it one of Africa's most moving and visually stunning cultural events.",
  image: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  date: 'October 15, 2023',
  author: 'Abebe Kebede',
  category: 'Festivals & Events',
  tags: ['Timkat', 'Religious Festivals', 'Cultural Events', 'Ethiopian Orthodox Church']
}, {
  id: '6',
  title: "Ethiopian Cuisine: A Beginner's Guide to Injera, Wat, and Beyond",
  excerpt: 'Discover the unique flavors and traditions of Ethiopian cuisine, from the sourdough flatbread injera to spicy stews and traditional coffee ceremonies.',
  content: "Ethiopian cuisine stands as one of Africa's most distinctive and flavorful culinary traditions. With its communal dining style, unique ingredients, and complex flavors developed over centuries, Ethiopian food offers a dining experience unlike any other. This guide introduces the essential elements of Ethiopian cuisine and the cultural significance behind this remarkable food tradition.\n\nAt the heart of Ethiopian cuisine is injera, a sourdough flatbread with a slightly spongy texture made from teff, an ancient grain native to the Ethiopian highlands. Rich in nutrients and naturally gluten-free, teff is fermented to create injera's distinctive tangy flavor. Served as both plate and utensil, large pieces of injera are laid flat on a traditional mesob (woven basket table) and topped with various stews and vegetables. Diners tear off pieces of injera to scoop up the accompanying dishes, making Ethiopian dining an inherently communal experience where sharing food from the same plate symbolizes bonds of loyalty and friendship.\n\nThe most common accompaniments to injera are wats (stews) that range from spicy to mild. Key wat, a spicy beef stew, is considered by many to be Ethiopia's national dish. Its deep, complex flavor comes from berbere, a distinctive Ethiopian spice blend that typically includes chili peppers, garlic, ginger, basil, korarima (Ethiopian cardamom), rue, ajwain, nigella, and fenugreek. Doro wat, made with chicken and hard-boiled eggs, is traditionally prepared for special occasions and holidays.\n\nFor vegetarians and vegans, Ethiopian cuisine is a paradise. During Orthodox fasting periods (which total over 200 days per year), many Ethiopians abstain from animal products, resulting in a rich tradition of plant-based dishes. These include misir wat (spiced red lentils), shiro (seasoned chickpea powder stew), gomen (collard greens), tikil gomen (cabbage and potatoes), and kik alicha (yellow split peas in a mild turmeric sauce).\n\nNo introduction to Ethiopian cuisine would be complete without mentioning the coffee ceremony. As the birthplace of coffee, Ethiopia treats its preparation and consumption as a revered social ritual. The ceremony involves roasting green coffee beans over hot coals, grinding them by hand, and brewing the coffee in a traditional clay pot called a jebena. Served in small cups, the coffee is typically enjoyed through three rounds, accompanied by burning incense and snacks like popcorn or roasted barley.\n\nEthiopian cuisine reflects the country's history, geography, and cultural values. The emphasis on communal dining fosters connection, while the complex flavors demonstrate culinary sophistication developed over millennia. For travelers to Ethiopia, participating in a traditional meal or coffee ceremony offers insight into the country's culture that goes far beyond mere sustenance – it's an expression of Ethiopian identity, hospitality, and community.",
  image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2064&q=80',
  date: 'October 8, 2023',
  author: 'Makeda Haile',
  category: 'Food & Cuisine',
  tags: ['Ethiopian Food', 'Injera', 'Coffee Ceremony', 'Culinary Traditions']
}, {
  id: '7',
  title: "Trekking in the Simien Mountains: Ethiopia's Spectacular Highland Wilderness",
  excerpt: 'Plan your hiking adventure in the UNESCO-listed Simien Mountains, home to dramatic landscapes and rare wildlife like the Gelada baboon and Walia ibex.',
  content: "The Simien Mountains in northern Ethiopia offer some of Africa's most spectacular trekking experiences. With their jagged peaks, deep valleys, and sheer escarpments dropping 1,500 meters, these UNESCO World Heritage-listed mountains have been described as 'the chess pieces of the gods.' This guide covers everything you need to know to plan an unforgettable trekking adventure in this highland wilderness.\n\nFormed by massive erosion of an ancient volcanic plateau, the Simien Mountains feature dramatic landscapes unlike anywhere else on the continent. The park's highest peak, Ras Dashen, stands at 4,550 meters (14,928 feet), making it Ethiopia's highest mountain and the fourth-highest in Africa. The mountains are characterized by their distinctive shape – flat plateaus separated by steep valleys – creating a landscape that inspired the local name 'Semien,' meaning 'north' but also 'south,' as the mountains appear to rise in the north and fall in the south regardless of the viewer's position.\n\nBeyond the stunning scenery, the Simiens are renowned for their unique wildlife. The mountains are home to several endangered endemic species, most notably the Gelada baboon (sometimes called the bleeding-heart baboon for the distinctive red patch on its chest). These remarkable primates are the world's only grass-eating monkeys and can be observed in troops of several hundred, often allowing hikers to approach within a few meters. More elusive but still possible to spot are the Walia ibex, an endangered wild goat found nowhere else on Earth, and the Ethiopian wolf, Africa's most endangered carnivore.\n\nTrekking routes in the Simiens range from short day hikes to multi-week expeditions. The classic route is a 3-4 day trek from Sankaber to Chennek, following the escarpment edge with its breathtaking views. More ambitious hikers can continue to Ras Dashen, typically a 7-8 day round trip. The park has basic but adequate camping facilities at established sites, and trekking requires guides, scouts, and usually mules to carry equipment – all of which create employment for local communities.\n\nThe best time to trek in the Simiens is during the dry season from October to March. The landscape is at its most verdant just after the rainy season ends in September/October, while the clearest skies for mountain views are typically in November and December. Nights at altitude can be cold year-round, with temperatures sometimes dropping below freezing, so appropriate warm clothing is essential.\n\nTrekking in the Simiens offers more than just natural beauty; it's also a cultural experience. The mountains are home to communities who have practiced traditional agriculture on the vertiginous slopes for centuries. Passing through villages and witnessing this ancient way of life provides insight into Ethiopia's remarkable cultural diversity and resilience.\n\nFor those seeking adventure in a landscape of primordial beauty, the Simien Mountains represent one of Africa's greatest trekking destinations – a place where the natural world inspires awe at every turn.",
  image: 'https://images.unsplash.com/photo-1591194620700-3b18f1f99460?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  date: 'October 1, 2023',
  author: 'Thomas Ngeze',
  category: 'Adventure Travel',
  tags: ['Trekking', 'Simien Mountains', 'Hiking', 'Wildlife']
}, {
  id: '8',
  title: "Photography Guide: Capturing Ethiopia's Diverse Beauty",
  excerpt: "Tips and techniques for photographers looking to document Ethiopia's incredible landscapes, historical sites, wildlife, and cultural moments.",
  content: "Ethiopia presents photographers with an extraordinary diversity of subjects – from the otherworldly landscapes of the Danakil Depression to ancient historical monuments, unique wildlife, and vibrant cultural traditions. This comprehensive guide offers practical advice for capturing compelling images across Ethiopia's varied environments, whether you're a seasoned professional or an enthusiastic amateur.\n\nLandscape photography in Ethiopia benefits from the country's remarkable geographical diversity. In the highlands, the dramatic escarpments of the Simien Mountains create spectacular opportunities, especially during the golden hours of early morning and late afternoon when the light accentuates the rugged terrain. Wide-angle lenses (16-35mm) help capture the expansive vistas, while a polarizing filter reduces haze and enhances the deep blues of the sky. For the surreal landscapes of the Danakil Depression, protecting your equipment from heat and sulfuric gases is essential – bring appropriate covers and consider silica gel packs to combat humidity. The otherworldly colors of Dallol's acid pools are most vivid in the softer light of early morning before the harsh midday sun flattens the scene.\n\nEthiopia's historical monuments require different approaches. The rock-hewn churches of Lalibela present particular challenges due to their dark interiors. A fast lens (f/2.8 or wider) and a camera with good high-ISO performance are valuable here. Consider bringing a small, portable tripod, though be aware that some churches may restrict their use. External flash is typically prohibited, making natural light techniques crucial. When photographing the ancient stelae of Axum or the castles of Gondar, including people in the frame provides a sense of scale that conveys the monuments' impressive dimensions.\n\nWildlife photography in Ethiopia often focuses on endemic species like the Gelada baboon, Ethiopian wolf, and Walia ibex. For these subjects, a telephoto lens (at least 200mm, ideally 400mm or longer) is essential. Gelada baboons are relatively approachable, allowing for intimate portraits that capture their expressive faces and distinctive red chest patches. The Ethiopian wolf and Walia ibex are more elusive, requiring patience and fieldcraft. Research their behavior patterns and habitat preferences to increase your chances of successful encounters.\n\nPerhaps the most rewarding photographic opportunities in Ethiopia come from its cultural diversity and traditions. When photographing people, ethical considerations are paramount. Always ask permission before taking someone's photo, be prepared to pay a small fee in some regions (particularly the Omo Valley), and take time to establish rapport. For cultural events like Timkat (Epiphany) or Meskel (Finding of the True Cross), arrive early to secure good positions, as these colorful festivals draw large crowds. A zoom lens in the 24-70mm range offers versatility for these dynamic events.\n\nRegardless of your photographic focus, certain practical considerations apply throughout Ethiopia. Dust is omnipresent, so bring cleaning equipment and change lenses sparingly. Power can be unreliable outside major cities, making spare batteries and portable chargers valuable. And perhaps most importantly, remember that while capturing compelling images is rewarding, taking time to simply experience and appreciate Ethiopia's wonders without a camera to your eye will enrich both your journey and your photography.",
  image: 'https://images.unsplash.com/photo-1516353181993-22242a87a0af?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  date: 'September 25, 2023',
  author: 'Lisa Chen',
  category: 'Photography',
  tags: ['Photography', 'Travel Tips', 'Landscapes', 'Cultural Photography']
}];
// Categories for filtering
const categories = ['All Categories', 'Travel Guides', 'Culture', 'Nature & Wildlife', 'Adventure Travel', 'Festivals & Events', 'Food & Cuisine', 'Photography'];
export function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const filteredPosts = blogPosts.filter(post => {
    // Filter by category
    if (activeCategory !== 'All Categories' && post.category !== activeCategory) {
      return false;
    }
    // Filter by search query
    if (searchQuery && !post.title.toLowerCase().includes(searchQuery.toLowerCase()) && !post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });
  return <div className="w-full bg-white">
      {/* Hero Section */}
      <div className="relative h-80 bg-cover bg-center" style={{
      backgroundImage: "url('https://images.unsplash.com/photo-1516353181993-22242a87a0af?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')"
    }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Travel Blog</h1>
          <p className="text-xl max-w-3xl">
            Stories, guides, and insights to inspire your Ethiopian adventure
          </p>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Column - Blog Posts */}
          <div className="lg:w-2/3">
            {/* Search and Categories */}
            <div className="mb-8">
              <div className="relative mb-6">
                <input type="text" placeholder="Search blog posts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full py-3 px-4 pr-12 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" />
                <Search size={20} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <div className="flex overflow-x-auto space-x-2 pb-2">
                {categories.map(category => <button key={category} onClick={() => setActiveCategory(category)} className={`px-4 py-2 rounded-full whitespace-nowrap ${activeCategory === category ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {category}
                  </button>)}
              </div>
            </div>
            {/* Featured Post */}
            {filteredPosts.length > 0 && <div className="mb-12">
                <Link to={`/blog/${filteredPosts[0].id}`} className="block">
                  <div className="relative h-80 rounded-lg overflow-hidden mb-4">
                    <img src={filteredPosts[0].image} alt={filteredPosts[0].title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-6">
                      <span className="inline-block bg-amber-600 text-white px-3 py-1 rounded-full text-sm font-medium mb-2">
                        {filteredPosts[0].category}
                      </span>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                        {filteredPosts[0].title}
                      </h2>
                      <div className="flex items-center text-white/80">
                        <Calendar size={16} className="mr-2" />
                        <span>{filteredPosts[0].date}</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <p className="text-gray-700 mb-4">{filteredPosts[0].excerpt}</p>
                <Link to={`/blog/${filteredPosts[0].id}`} className="flex items-center text-amber-600 hover:text-amber-800 font-medium">
                  Read Full Article
                  <ChevronRight size={16} className="ml-1" />
                </Link>
              </div>}
            {/* Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredPosts.slice(1).map(post => <div key={post.id} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 border">
                  <Link to={`/blog/${post.id}`}>
                    <div className="h-48 overflow-hidden">
                      <img src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" />
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-center mb-2">
                      <span className="inline-block bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-medium">
                        {post.category}
                      </span>
                      <span className="text-gray-500 text-sm ml-auto flex items-center">
                        <Calendar size={14} className="mr-1" />
                        {post.date}
                      </span>
                    </div>
                    <Link to={`/blog/${post.id}`}>
                      <h3 className="font-bold text-lg mb-2 hover:text-amber-600 transition-colors">
                        {post.title}
                      </h3>
                    </Link>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        By {post.author}
                      </span>
                      <Link to={`/blog/${post.id}`} className="text-sm font-medium text-amber-600 hover:text-amber-800 flex items-center">
                        Read More
                        <ChevronRight size={16} className="ml-1" />
                      </Link>
                    </div>
                  </div>
                </div>)}
            </div>
            {filteredPosts.length === 0 && <div className="text-center py-12">
                <h3 className="text-xl font-medium text-gray-600">
                  No posts found matching your criteria
                </h3>
                <p className="mt-2 text-gray-500">
                  Try adjusting your search or category filters
                </p>
              </div>}
            {/* Pagination */}
            {filteredPosts.length > 0 && <div className="mt-12 flex justify-center">
                <nav className="flex items-center space-x-2">
                  <button className="px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
                    Previous
                  </button>
                  <button className="px-3 py-1 bg-amber-600 text-white rounded-md">
                    1
                  </button>
                  <button className="px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
                    2
                  </button>
                  <button className="px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
                    Next
                  </button>
                </nav>
              </div>}
          </div>
          {/* Sidebar */}
          <div className="lg:w-1/3">
            {/* About the Blog */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border">
              <h3 className="text-lg font-bold mb-4">About Our Blog</h3>
              <p className="text-gray-700 mb-4">
                Welcome to the Visit Ethiopia blog, where we share travel tips,
                cultural insights, and stories to inspire your journey through
                this remarkable country.
              </p>
              <Link to="/about" className="text-amber-600 hover:text-amber-800 font-medium">
                Learn more about us
              </Link>
            </div>
            {/* Popular Categories */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border">
              <h3 className="text-lg font-bold mb-4">Categories</h3>
              <div className="space-y-2">
                {categories.filter(cat => cat !== 'All Categories').map(category => <button key={category} onClick={() => setActiveCategory(category)} className="block w-full text-left px-3 py-2 rounded-md hover:bg-amber-50 transition-colors">
                      <span className={activeCategory === category ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                        {category}
                      </span>
                      <span className="text-gray-500 text-sm float-right">
                        {blogPosts.filter(post => post.category === category).length}
                      </span>
                    </button>)}
              </div>
            </div>
            {/* Popular Tags */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border">
              <h3 className="text-lg font-bold mb-4">Popular Tags</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(blogPosts.flatMap(post => post.tags))).map(tag => <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-gray-200 cursor-pointer">
                    <Tag size={14} className="mr-1 text-amber-600" />
                    {tag}
                  </span>)}
              </div>
            </div>
            {/* Newsletter Signup */}
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg mb-8">
              <h3 className="text-lg font-bold mb-2">
                Subscribe to Our Newsletter
              </h3>
              <p className="text-gray-700 mb-4">
                Get the latest travel tips and stories delivered to your inbox
              </p>
              <form className="space-y-3">
                <input type="email" placeholder="Your email address" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" required />
                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>;
}