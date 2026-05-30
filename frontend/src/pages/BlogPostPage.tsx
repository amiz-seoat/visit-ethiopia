import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, User, Tag, ArrowLeft, Facebook, Twitter, Linkedin, Mail, ChevronRight } from 'lucide-react';
// Using the same mock data from BlogPage
const blogPosts = [{
  id: '1',
  title: "The Ultimate Guide to Ethiopia's Historic Northern Circuit",
  excerpt: 'Discover the ancient wonders of Lalibela, Axum, and Gondar with our comprehensive guide to planning the perfect northern Ethiopia itinerary.',
  content: "Ethiopia's northern circuit is home to some of the most remarkable historical sites in Africa. From the rock-hewn churches of Lalibela to the ancient stelae of Axum and the castles of Gondar, this region offers an incredible journey through time. This guide will help you plan your perfect northern Ethiopia adventure, including how to get around, where to stay, what to see, and insider tips to make your experience unforgettable.\n\nLalibela, often called the 'Eighth Wonder of the World,' features 11 medieval churches carved from solid rock. Plan to spend at least two full days exploring these remarkable structures, ideally with a knowledgeable local guide who can explain their religious significance and architectural brilliance. The most iconic is Bet Giyorgis (St. George's Church), carved in the shape of a cross and best viewed early morning when the light accentuates its features.\n\nAxum, the ancient capital of the Aksumite Empire, is shrouded in mystery and legend. The massive granite stelae that dominate the town are engineering marvels, especially considering they were erected in the 4th century. Don't miss the Queen of Sheba's Bath and the Church of St. Mary of Zion, which according to Ethiopian Orthodox tradition, houses the Ark of the Covenant.\n\nGondar, known as the 'Camelot of Africa,' boasts an impressive Royal Enclosure with multiple castles built in the 17th and 18th centuries. The architectural influence of various cultures is evident in these structures, reflecting Ethiopia's historical connections with Europe, the Middle East, and India. Nearby Debre Berhan Selassie Church, with its famous ceiling of painted angels, is a must-visit.\n\nTo fully appreciate the northern circuit, consider allocating 10-14 days for your journey. The most efficient way to travel between these sites is by domestic flights, though road travel offers a deeper connection with the stunning landscapes and rural communities. Accommodations range from basic guesthouses to boutique hotels, with options to suit various budgets.\n\nThe best time to visit is during the dry season (October to March), when roads are more accessible and clear skies enhance your experience of these magnificent sites. Regardless of when you visit, prepare to be transformed by Ethiopia's northern treasures – a living museum of human achievement and spiritual devotion.",
  image: 'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80',
  date: 'November 10, 2023',
  author: 'Daniel Kebede',
  category: 'Travel Guides',
  tags: ['Historical Sites', 'Lalibela', 'Axum', 'Gondar', 'Northern Ethiopia'],
  authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80',
  authorBio: "Daniel is a travel writer and photographer with over 10 years of experience exploring Ethiopia's historical sites. He specializes in cultural and historical tourism."
}, {
  id: '2',
  title: "Ethiopia's Coffee Culture: From Bean to Cup",
  excerpt: "Explore the birthplace of coffee and learn about Ethiopia's ancient coffee traditions, from wild forest harvesting to the elaborate coffee ceremony.",
  content: "Ethiopia is widely recognized as the birthplace of coffee, with the legend of Kaldi the goatherd discovering the energizing effects of coffee berries when his goats became unusually spirited after consuming them. Today, coffee remains central to Ethiopian culture, economy, and daily life. This article takes you on a journey through Ethiopia's rich coffee heritage, from the misty forests where wild coffee still grows to the elaborate ceremony that transforms simple beans into a communal experience.\n\nIn the southwestern forests of Ethiopia, particularly in Kaffa (from which coffee derives its name), wild coffee still grows beneath the forest canopy. These ancient coffee forests represent the original genetic diversity of Arabica coffee and are increasingly protected as both cultural and ecological treasures. Some of the world's most distinctive and sought-after coffee varieties originate from specific regions of Ethiopia, including Yirgacheffe, Sidamo, and Harrar, each with its unique flavor profile influenced by local growing conditions.\n\nBeyond being an agricultural product, coffee in Ethiopia is a social institution. The Ethiopian coffee ceremony is a ritual of hospitality and community that can last for hours. The ceremony begins with the washing of green coffee beans, which are then roasted over hot coals in a flat pan. The hostess continuously wafts the aromatic smoke toward guests as an invitation to enjoy the fragrance. The roasted beans are then ground with a traditional mortar and pestle and brewed in a special clay pot called a jebena.\n\nCoffee is typically served in three rounds – Abol (first), Tona (second), and Baraka (blessing) – with each round becoming progressively weaker. Refusing coffee before the third round is considered impolite. The ceremony is accompanied by burning incense to create an immersive sensory experience and is often complemented with small snacks like popcorn or peanuts.\n\nFor visitors to Ethiopia, participating in a coffee ceremony offers insight into the country's social fabric and values of community and hospitality. In Addis Ababa, numerous cultural restaurants offer the experience, while in rural areas, being invited to a family's coffee ceremony is a special honor.\n\nEthiopia's coffee industry faces challenges from climate change and market fluctuations, but initiatives promoting sustainable practices and fair trade are helping preserve this vital heritage. By supporting Ethiopian coffee, consumers worldwide can contribute to protecting not just exceptional quality beans, but a cultural tradition thousands of years in the making.",
  image: 'https://images.unsplash.com/photo-1447933601403-0c44657c85b7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2056&q=80',
  date: 'November 5, 2023',
  author: 'Sarah Johnson',
  category: 'Culture',
  tags: ['Coffee', 'Cultural Traditions', 'Ethiopian Cuisine'],
  authorImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80',
  authorBio: 'Sarah is a food and culture writer who has lived in Ethiopia for 5 years. She specializes in documenting traditional food practices and their cultural significance.'
}, {
  id: '3',
  title: "Wildlife Watching in Ethiopia's National Parks",
  excerpt: "From the Ethiopian wolf to the Gelada baboon, discover the unique and diverse wildlife that can be observed in Ethiopia's stunning national parks and reserves.",
  content: "Ethiopia's varied landscapes and ecosystems harbor an impressive array of wildlife, including numerous endemic species found nowhere else on Earth. From the high-altitude Afroalpine moorlands to lowland savannas, the country's national parks offer remarkable wildlife viewing opportunities for nature enthusiasts. This guide explores the best destinations for wildlife watching in Ethiopia and what you can expect to see at each location.\n\nThe Bale Mountains National Park is a biodiversity hotspot and home to the endangered Ethiopian wolf, the rarest canid in the world with fewer than 500 remaining in the wild. These russet-colored wolves can be observed hunting for rodents on the Sanetti Plateau. The park also harbors mountain nyalas, Menelik's bushbucks, giant mole-rats, and over 300 species of birds including 16 endemics. The Harenna Forest in the southern part of the park is one of the few places where you might glimpse the elusive Bale monkey.\n\nThe Simien Mountains National Park, a UNESCO World Heritage site, is famous for its dramatic scenery and unique wildlife. Here, troops of Gelada baboons (sometimes called 'bleeding heart baboons' for the distinctive red patch on their chests) can be observed at close range as they graze on the high-altitude grasslands. These remarkable primates are the world's only grass-eating monkeys and live in complex social groups that can number several hundred individuals. The park is also home to the endangered Walia ibex and the Ethiopian wolf, though both are more elusive than the geladas.\n\nAwash National Park, located in the Great Rift Valley, offers a different ecosystem and wildlife viewing experience. The savanna landscape supports beisa oryx, greater and lesser kudus, Soemmerring's gazelles, and Salt's dikdiks. The park is also excellent for bird watching, with over 450 species recorded, including the endemic yellow-throated serin.\n\nIn the south, Omo National Park and Mago National Park provide opportunities to see larger savanna species such as buffalo, giraffe, elephant, and various antelope species. These remote parks also offer cultural experiences with the indigenous tribes of the Lower Omo Valley.\n\nThe best time for wildlife viewing in Ethiopia is during the dry season (October to May), when animals concentrate around water sources and vegetation is less dense. Early morning and late afternoon are optimal times for activity. While Ethiopia may not offer the same density of large mammals as East African safari destinations like Kenya or Tanzania, the unique and endemic wildlife, combined with spectacular landscapes and fewer tourists, make it a rewarding destination for nature enthusiasts seeking something different.",
  image: 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80',
  date: 'October 28, 2023',
  author: 'Michael Thompson',
  category: 'Nature & Wildlife',
  tags: ['Wildlife', 'National Parks', 'Ethiopian Wolf', 'Gelada Baboon'],
  authorImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80',
  authorBio: "Michael is a wildlife biologist and conservation photographer who has worked on projects throughout Ethiopia's national parks for the past decade."
}, {
  id: '4',
  title: "The Danakil Depression: Exploring Earth's Most Alien Landscape",
  excerpt: "Journey to one of the hottest, lowest, and most geologically active places on Earth – Ethiopia's surreal Danakil Depression with its acid pools and salt flats.",
  content: "The Danakil Depression in northeastern Ethiopia holds the distinction of being one of the most extreme environments on our planet. With daytime temperatures regularly exceeding 50°C (122°F), lying more than 100 meters below sea level, and featuring a landscape shaped by volcanic activity and salt formations, visiting the Danakil feels like traveling to another world. This guide explores this geological wonder and provides essential information for those brave enough to venture into 'the gateway to hell.'\n\nThe most iconic sight in the Danakil is Dallol, a volcanic crater featuring acid pools, salt formations, and mineral springs in psychedelic colors – fluorescent yellows, vibrant greens, and fiery oranges created by extreme geochemical processes. The constantly changing landscape of Dallol is the result of the interaction between the hot magma below the surface and the salt and water above. These otherworldly formations make it a photographer's paradise, though the intense heat and toxic fumes require caution.\n\nNearby, Lake Karum (Lake Assale) presents a different but equally surreal landscape. Here, Afar tribesmen have harvested salt for centuries, cutting it into uniform blocks and transporting it via camel caravans to highland markets. Watching these salt workers practicing their ancient trade against the backdrop of the blindingly white salt flats is like witnessing a scene from centuries past.\n\nThe Danakil is also home to Erta Ale, one of the world's most active volcanoes featuring a persistent lava lake. The challenging night hike to the crater rim rewards visitors with the mesmerizing sight of molten lava bubbling and churning – a genuine window into the earth's fiery interior.\n\nVisiting the Danakil Depression requires careful planning and preparation. Tours typically depart from Mekele and last 3-4 days, with basic camping accommodations. Due to extreme conditions, visits are best undertaken between November and March when temperatures are merely very hot rather than unbearable. Travelers should be in good health, bring appropriate sun protection, and carry plenty of water.\n\nThe region has experienced security concerns in the past, so it's essential to travel with reputable operators who employ local Afar guides and security personnel. Despite the challenges, the Danakil Depression offers one of travel's most extraordinary experiences – a chance to witness landscapes so extreme and unusual that they're used by scientists to study the potential for life on other planets. For adventurous travelers seeking to experience our planet's most alien environment, the Danakil Depression represents the ultimate destination.",
  image: 'https://images.unsplash.com/photo-1518002054494-3a6f870d4a8f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
  date: 'October 20, 2023',
  author: 'Emma Wilson',
  category: 'Adventure Travel',
  tags: ['Danakil Depression', 'Volcanic Landscapes', 'Extreme Travel', 'Natural Wonders'],
  authorImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80',
  authorBio: "Emma is an adventure travel writer specializing in extreme environments. She has explored some of the world's most challenging landscapes across five continents."
}];
// Function to find related posts based on tags and category
const findRelatedPosts = (currentPost: any, allPosts: any[], limit: number = 3) => {
  return allPosts.filter(post => post.id !== currentPost.id) // Exclude current post
  .sort((a, b) => {
    // Count matching tags
    const aTags = a.tags.filter((tag: string) => currentPost.tags.includes(tag)).length;
    const bTags = b.tags.filter((tag: string) => currentPost.tags.includes(tag)).length;
    // If same category, add points
    const aCategory = a.category === currentPost.category ? 3 : 0;
    const bCategory = b.category === currentPost.category ? 3 : 0;
    return bTags + bCategory - (aTags + aCategory);
  }).slice(0, limit);
};
export function BlogPostPage() {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  // Find the current post
  const post = blogPosts.find(post => post.id === id);
  // If post not found, show error
  if (!post) {
    return <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Post Not Found</h1>
        <p className="mb-6">
          The blog post you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/blog" className="text-amber-600 hover:text-amber-800 font-medium">
          <ArrowLeft size={18} className="inline mr-2" />
          Back to Blog
        </Link>
      </div>;
  }
  // Find related posts
  const relatedPosts = findRelatedPosts(post, blogPosts);
  // Format content with paragraphs
  const formattedContent = post.content.split('\n\n').map((paragraph, index) => <p key={index} className="mb-6">
        {paragraph}
      </p>);
  return <div className="w-full bg-white">
      {/* Hero Section */}
      <div className="relative h-96 bg-cover bg-center" style={{
      backgroundImage: `url(${post.image})`
    }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-12">
          <div className="max-w-4xl">
            <span className="inline-block bg-amber-600 text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {post.title}
            </h1>
            <div className="flex items-center text-white/80">
              <Calendar size={18} className="mr-2" />
              <span className="mr-6">{post.date}</span>
              <User size={18} className="mr-2" />
              <span>By {post.author}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center text-sm text-gray-600">
            <Link to="/" className="hover:text-amber-600">
              Home
            </Link>
            <ChevronRight size={14} className="mx-2" />
            <Link to="/blog" className="hover:text-amber-600">
              Blog
            </Link>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-gray-900 font-medium truncate">
              {post.title}
            </span>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Column - Article Content */}
          <div className="lg:w-2/3">
            <article className="bg-white rounded-lg shadow-sm p-6 md:p-8">
              {/* Article Content */}
              <div className="prose max-w-none">{formattedContent}</div>
              {/* Tags */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-medium mb-3">Tags:</h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag: string) => <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                      <Tag size={14} className="mr-1 text-amber-600" />
                      {tag}
                    </span>)}
                </div>
              </div>
              {/* Share */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-medium mb-3">Share this article:</h3>
                <div className="flex space-x-3">
                  <button className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
                    <Facebook size={18} />
                  </button>
                  <button className="p-2 bg-sky-500 text-white rounded-full hover:bg-sky-600">
                    <Twitter size={18} />
                  </button>
                  <button className="p-2 bg-blue-700 text-white rounded-full hover:bg-blue-800">
                    <Linkedin size={18} />
                  </button>
                  <button className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                    <Mail size={18} />
                  </button>
                </div>
              </div>
              {/* Author Bio */}
              <div className="mt-8 pt-6 border-t">
                <div className="flex items-start">
                  <img src={post.authorImage} alt={post.author} className="w-16 h-16 rounded-full object-cover mr-4" />
                  <div>
                    <h3 className="font-bold text-lg">{post.author}</h3>
                    <p className="text-gray-700 mt-1">{post.authorBio}</p>
                  </div>
                </div>
              </div>
            </article>
            {/* Related Articles */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map(relatedPost => <Link key={relatedPost.id} to={`/blog/${relatedPost.id}`} className="group">
                    <div className="bg-white rounded-lg overflow-hidden shadow-sm border">
                      <div className="h-40 overflow-hidden">
                        <img src={relatedPost.image} alt={relatedPost.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      </div>
                      <div className="p-4">
                        <span className="inline-block bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-medium mb-2">
                          {relatedPost.category}
                        </span>
                        <h3 className="font-bold mb-2 group-hover:text-amber-600 transition-colors line-clamp-2">
                          {relatedPost.title}
                        </h3>
                        <div className="text-gray-500 text-sm flex items-center">
                          <Calendar size={14} className="mr-1" />
                          {relatedPost.date}
                        </div>
                      </div>
                    </div>
                  </Link>)}
              </div>
            </div>
          </div>
          {/* Sidebar */}
          <div className="lg:w-1/3">
            {/* Back to Blog */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border">
              <Link to="/blog" className="flex items-center text-amber-600 hover:text-amber-800 font-medium">
                <ArrowLeft size={18} className="mr-2" />
                Back to Blog
              </Link>
            </div>
            {/* Popular Categories */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border">
              <h3 className="text-lg font-bold mb-4">Categories</h3>
              <div className="space-y-2">
                {Array.from(new Set(blogPosts.map(post => post.category))).map(category => <Link key={category} to={`/blog?category=${category}`} className="block w-full text-left px-3 py-2 rounded-md hover:bg-amber-50 transition-colors text-gray-700">
                    {category}
                    <span className="text-gray-500 text-sm float-right">
                      {blogPosts.filter(post => post.category === category).length}
                    </span>
                  </Link>)}
              </div>
            </div>
            {/* Recent Posts */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 border">
              <h3 className="text-lg font-bold mb-4">Recent Posts</h3>
              <div className="space-y-4">
                {blogPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4).map(recentPost => <Link key={recentPost.id} to={`/blog/${recentPost.id}`} className="flex items-start space-x-3 group">
                      <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden">
                        <img src={recentPost.image} alt={recentPost.title} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-amber-600 transition-colors line-clamp-2">
                          {recentPost.title}
                        </h4>
                        <span className="text-gray-500 text-xs">
                          {recentPost.date}
                        </span>
                      </div>
                    </Link>)}
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
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg">
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