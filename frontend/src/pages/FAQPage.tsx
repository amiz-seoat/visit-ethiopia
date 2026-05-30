import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
// FAQ categories and questions
const faqData = [{
  category: 'Travel Planning',
  questions: [{
    question: 'What is the best time to visit Ethiopia?',
    answer: "The best time to visit Ethiopia is during the dry season from October to March. This period offers pleasant temperatures and minimal rainfall, making it ideal for exploring historical sites and trekking in the mountains. The rainy season (June to September) can make some roads impassable, especially in rural areas. However, if you're interested in lush landscapes and fewer tourists, the months right after the rainy season (late September and October) can be particularly beautiful."
  }, {
    question: 'How many days do I need to explore Ethiopia?',
    answer: "For a comprehensive experience of Ethiopia's highlights, we recommend at least 10-14 days. This allows time to visit the historic northern circuit (Lalibela, Axum, Gondar, and Bahir Dar), as well as some natural attractions like the Simien Mountains. If you want to include southern regions like the Omo Valley or eastern attractions like the Danakil Depression, consider extending your trip to 2-3 weeks. For those with limited time, a focused 7-day tour of the northern historical sites can still provide a meaningful introduction to Ethiopia's cultural heritage."
  }, {
    question: 'Do I need a visa to visit Ethiopia?',
    answer: 'Yes, most visitors to Ethiopia require a visa. Ethiopia offers an e-visa service that allows tourists to apply online before arrival. Alternatively, visas on arrival are available for many nationalities at Bole International Airport in Addis Ababa. The standard tourist visa is valid for 30 days and can be extended once in Addis Ababa if needed. We recommend applying for the e-visa at least a week before your trip to avoid any last-minute complications.'
  }, {
    question: 'Is Ethiopia safe for tourists?',
    answer: "Ethiopia is generally safe for tourists, especially in the main tourist areas. Like any destination, it's important to take standard precautions such as being aware of your surroundings, avoiding isolated areas after dark, and safeguarding your valuables. We recommend staying informed about current conditions, as certain regions occasionally experience political tensions. Our tours always prioritize safety, and our guides are well-informed about local conditions. We advise travelers to register with their embassy upon arrival and follow any travel advisories issued by their government."
  }]
}, {
  category: 'Tours & Activities',
  questions: [{
    question: 'What types of tours do you offer in Ethiopia?',
    answer: 'We offer a diverse range of tours to suit different interests and travel styles. Our most popular options include historical tours of the northern circuit featuring UNESCO World Heritage sites, cultural experiences in the Omo Valley to meet indigenous tribes, trekking adventures in the Simien and Bale Mountains, wildlife safaris in national parks, photography-focused journeys, and specialized interest tours such as bird watching, coffee tours, and religious festivals. We provide both group tours with set departures and fully customizable private tours tailored to your specific interests and schedule.'
  }, {
    question: 'Can tours be customized to my interests?',
    answer: "Absolutely! We specialize in creating customized itineraries based on your interests, time constraints, and budget. Whether you're interested in history, culture, wildlife, photography, trekking, or a combination of experiences, our travel specialists can design a perfect itinerary for you. We can also accommodate special interests such as bird watching, coffee tours, or attending specific festivals. Simply contact us with your preferences, and we'll work with you to create your ideal Ethiopian adventure."
  }, {
    question: 'Are your tours suitable for families with children?',
    answer: 'Many of our tours can be adapted to be family-friendly, though some activities may have age restrictions for safety reasons. Historical tours of cities like Lalibela and Gondar, as well as wildlife viewing in certain areas, can be engaging for children. For families, we typically recommend a more relaxed pace with plenty of downtime and accommodation options with family facilities. We can customize itineraries with child-friendly activities and ensure transportation is comfortable for young travelers. Please let us know the ages of your children when inquiring so we can tailor recommendations accordingly.'
  }, {
    question: 'What should I pack for my Ethiopian tour?',
    answer: "Packing for Ethiopia depends on your itinerary and the season, but generally we recommend: lightweight, modest clothing (shoulders and knees should be covered, especially when visiting religious sites); a warm layer or jacket for cool evenings, especially in highland areas; comfortable walking shoes or hiking boots; sun protection (hat, sunglasses, sunscreen); a rain jacket or small umbrella during the rainy season; any personal medications and a basic first-aid kit; a camera with extra batteries; and a headlamp or flashlight for potential power outages. If your tour includes trekking or special activities, we'll provide a more detailed packing list specific to your itinerary."
  }]
}, {
  category: 'Accommodations',
  questions: [{
    question: 'What types of accommodations are available in Ethiopia?',
    answer: "Ethiopia offers a range of accommodation options to suit different preferences and budgets. In Addis Ababa and major cities, you'll find international-standard hotels with modern amenities. In tourist destinations like Lalibela and Gondar, there are comfortable tourist-class hotels and some boutique options. More remote areas may offer simpler lodges or guesthouses with basic facilities. For nature lovers, there are eco-lodges in places like the Simien Mountains and Bale Mountains. Our tours typically include the best available accommodations in each location, and we're happy to discuss options to match your comfort expectations and budget."
  }, {
    question: 'Do hotels in Ethiopia have reliable electricity and hot water?',
    answer: 'In major cities and established tourist destinations, hotels generally have reliable electricity and hot water, though brief power outages can occur throughout Ethiopia. Many better hotels have generators for backup power. In more remote areas, electricity may be limited to certain hours of the day, and hot water might not be consistently available. Eco-lodges often use solar power, which can be dependent on weather conditions. We always choose the best available accommodations for our tours and will inform you in advance if any stays will have limited facilities so you can prepare accordingly.'
  }, {
    question: 'Is Wi-Fi available in Ethiopian hotels?',
    answer: "Wi-Fi availability varies across Ethiopia. Most hotels in Addis Ababa and other major cities offer Wi-Fi, though connection speeds may be slower than what you're accustomed to at home. In smaller towns and rural areas, Wi-Fi might be limited or unavailable. Even where Wi-Fi is offered, connectivity can be intermittent. For those needing regular internet access, we recommend purchasing a local SIM card with a data package upon arrival in Ethiopia, which often provides more reliable connectivity than hotel Wi-Fi. We suggest informing friends and family that you may have limited internet access during portions of your trip."
  }]
}, {
  category: 'Transportation',
  questions: [{
    question: 'How do I get around within Ethiopia?',
    answer: "For travel between major destinations in Ethiopia, domestic flights operated by Ethiopian Airlines are the most efficient option, saving considerable time given the country's size and mountainous terrain. For shorter distances or areas not served by flights, road transport is used. Our tours include private vehicles with professional drivers, typically 4WD vehicles or comfortable minivans depending on the terrain and group size. In some remote areas, special transportation like boats on Lake Tana or camels in the Danakil Depression may be part of the experience. Public transportation exists but is generally not recommended for tourists due to comfort and reliability concerns."
  }, {
    question: 'Are domestic flights reliable in Ethiopia?',
    answer: "Ethiopian Airlines operates the domestic flight network and generally maintains good reliability standards. However, schedule changes and delays can occur due to weather conditions, especially during the rainy season, or operational reasons. When planning itineraries that rely on domestic flights, we build in buffer time where possible and always have contingency plans. We recommend avoiding tight connections and booking international departures with at least a day's buffer after your final domestic flight. Our team monitors flight statuses and will adjust your itinerary as needed if disruptions occur."
  }, {
    question: 'What is the condition of roads in Ethiopia?',
    answer: 'Road conditions in Ethiopia vary widely. Major highways connecting cities are generally paved and in reasonable condition, while secondary roads may be unpaved, rough, or challenging during the rainy season. Road improvement projects are ongoing throughout the country, but travel times can still be longer than expected based on distance alone due to road conditions, traffic in urban areas, and the mountainous terrain. Our itineraries account for realistic travel times, and our vehicles are selected for the specific routes, with comfortable 4WD vehicles used for rougher roads. We prioritize safety and comfort, even if it means spending more time on transportation.'
  }]
}, {
  category: 'Health & Safety',
  questions: [{
    question: 'What vaccinations do I need for Ethiopia?',
    answer: 'Travelers to Ethiopia should consult with a travel health professional or visit a travel clinic at least 4-6 weeks before departure to get the most current recommendations. Common vaccinations recommended for Ethiopia include: Yellow Fever (required if arriving from or transiting through a country with yellow fever risk), Hepatitis A and B, Typhoid, Tetanus, Diphtheria, and Polio. Depending on your specific itinerary and activities, additional vaccinations like Rabies or Meningitis may be recommended. Malaria prevention measures are also important for many areas of Ethiopia, though the risk is lower in highlands above 2,500 meters. Always get personalized medical advice as recommendations can change and vary based on your health history.'
  }, {
    question: 'Is the food and water safe in Ethiopia?',
    answer: 'To minimize health risks, we recommend drinking only bottled or purified water, which is readily available throughout tourist areas. Avoid tap water, ice made from tap water, and raw fruits and vegetables that you cannot peel yourself. Ethiopian cuisine is delicious and generally prepared freshly, which reduces food safety concerns. When dining out, choose busy restaurants with high turnover. On our tours, we select restaurants carefully for both authentic experiences and food safety. We recommend bringing hand sanitizer and using it regularly, especially before meals. If you have specific dietary requirements or concerns, please inform us in advance so we can make appropriate arrangements.'
  }, {
    question: 'Should I be concerned about altitude sickness in Ethiopia?',
    answer: 'Many popular destinations in Ethiopia, including Addis Ababa (2,355m), Lalibela (2,500m), and the Simien Mountains (which reach over 4,000m), are at high altitudes where altitude sickness can be a concern. Symptoms can include headache, fatigue, shortness of breath, and nausea. To minimize risk, we design itineraries that allow for gradual acclimatization when possible. We recommend staying hydrated, avoiding alcohol during the first days at altitude, taking it easy initially, and considering speaking with your doctor about altitude sickness medication before your trip. If you have heart or lung conditions, please consult your physician before booking a trip to highland areas of Ethiopia.'
  }, {
    question: 'What medical facilities are available for tourists?',
    answer: 'Medical facilities in Ethiopia vary significantly in quality and availability. Addis Ababa has the best medical facilities in the country, including some private clinics and hospitals that can provide reasonable care for minor issues. Outside the capital, medical facilities are more limited and may not meet international standards. We strongly recommend purchasing comprehensive travel insurance that includes emergency medical evacuation coverage before your trip. Bring any prescription medications you need in their original packaging, along with a copy of the prescription. A basic first-aid kit for minor issues is also advisable. Our guides are trained in first aid and know the locations of the best available medical facilities in each area visited.'
  }]
}, {
  category: 'Money & Payments',
  questions: [{
    question: 'What currency is used in Ethiopia?',
    answer: "The Ethiopian Birr (ETB) is the official currency of Ethiopia. Banknotes come in denominations of 1, 5, 10, 50, 100, and 200 Birr. While credit cards are accepted at major hotels and some high-end establishments in Addis Ababa, cash is the primary payment method throughout most of the country. We recommend bringing US dollars (issued after 2006 and in good condition) to exchange locally. ATMs are available in major cities but may not always be reliable or accept all international cards. It's advisable to carry enough cash for daily expenses, especially when traveling outside of major urban centers."
  }, {
    question: 'How much should I budget for additional expenses?',
    answer: 'For expenses not included in your tour package (such as additional meals, souvenirs, and optional activities), we recommend budgeting approximately $20-40 USD per day for moderate spending. Meals at mid-range restaurants typically cost $5-15 USD, while souvenirs and handicrafts vary widely in price depending on quality and craftsmanship. Tipping is customary in Ethiopia; we suggest $5-10 per day for guides and $3-5 per day for drivers. If your tour includes other service providers like boat operators or site guides, $2-3 per service is appropriate. Note that some higher-end establishments may add a service charge to bills, but additional tipping is still appreciated.'
  }, {
    question: 'Can I use credit cards in Ethiopia?',
    answer: 'Credit card acceptance in Ethiopia is limited primarily to major hotels, upscale restaurants, and some souvenir shops in Addis Ababa. Visa is the most widely accepted card, with MasterCard accepted at fewer locations and American Express rarely accepted. Outside the capital, credit card facilities become increasingly scarce. Even where cards are accepted, network connectivity issues can sometimes prevent transactions. We strongly recommend carrying sufficient cash (Ethiopian Birr) for daily expenses, particularly when traveling to smaller towns and rural areas. Always notify your bank of your travel plans to prevent your card from being blocked for suspicious activity when used in Ethiopia.'
  }]
}, {
  category: 'Cultural Considerations',
  questions: [{
    question: 'What should I know about Ethiopian customs and etiquette?',
    answer: "Ethiopian culture values respect, modesty, and hospitality. When visiting religious sites, both men and women should cover shoulders and knees, and women may need to cover their heads in Orthodox churches. Remove shoes when entering mosques or traditional homes. It's customary to greet people with a handshake, and elders should be greeted first as a sign of respect. Ethiopians typically eat with their right hand from communal dishes; wait to be invited before joining the meal. Photography requires permission, especially of people and religious ceremonies. Public displays of affection are discouraged. The Ethiopian calendar and time system differ from Western standards, which can cause confusion – Ethiopians may refer to 7:00 AM as '1:00' in their time system, as their day starts at dawn."
  }, {
    question: 'How should I dress when visiting religious sites?',
    answer: 'Ethiopia has a rich religious heritage, and proper attire is essential when visiting religious sites. For both men and women, shoulders and knees must be covered. Women should bring a scarf to cover their heads when visiting Orthodox churches, and in some more conservative churches, women may be required to wear a long skirt. Tight-fitting clothes are generally inappropriate. Many churches require visitors to remove their shoes before entering, so easily removable footwear is practical. Some of the most sacred areas of churches may be off-limits to women or to non-Orthodox visitors. Always follow the guidance of local officials and your guide regarding access and appropriate behavior at religious sites.'
  }, {
    question: 'Is it acceptable to photograph people in Ethiopia?',
    answer: 'Photography etiquette is important in Ethiopia. Always ask permission before photographing individuals, especially in rural areas and tribal regions. In some communities, particularly in the Omo Valley, people may expect payment for photographs. Your guide can advise on appropriate amounts and help negotiate when necessary. Some religious ceremonies and artifacts may be prohibited from being photographed, and many churches charge a camera fee. Be respectful of these restrictions. Avoid photographing military installations, government buildings, or infrastructure like bridges and airports, as this can lead to problems with authorities. Taking time to interact and connect with people before requesting photos leads to more meaningful exchanges and often better photographic opportunities.'
  }]
}, {
  category: 'Booking & Reservations',
  questions: [{
    question: 'How far in advance should I book my Ethiopian tour?',
    answer: "We recommend booking your Ethiopian tour at least 3-6 months in advance, especially if you're traveling during the high season (October to January) or planning to attend special events like Timkat (Ethiopian Epiphany) or Meskel (Finding of the True Cross) festivals. This allows time to secure preferred accommodations, domestic flights, and specialized guides. For custom tours or groups of 4 or more, earlier booking (6-12 months ahead) is advisable. Last-minute bookings are sometimes possible, particularly in the shoulder seasons, but may require flexibility in itinerary and accommodation choices. For travelers with specific interests or destinations in mind, earlier planning ensures the best experience."
  }, {
    question: 'What is your cancellation policy?',
    answer: 'Our standard cancellation policy is as follows: Cancellations made more than 60 days before departure receive a 90% refund (10% fee covers administrative costs and non-refundable deposits paid to suppliers). Cancellations 30-60 days before departure receive a 50% refund. Cancellations less than 30 days before departure are non-refundable. We strongly recommend purchasing comprehensive travel insurance that includes cancellation coverage for unforeseen circumstances. Special terms may apply for certain packages, particularly those involving festivals or specialized activities, which will be clearly communicated at the time of booking. In cases of force majeure (natural disasters, political instability, etc.), we work with clients to postpone travel or find alternative solutions.'
  }, {
    question: 'Do you offer travel insurance?',
    answer: 'We do not directly sell travel insurance, but we strongly recommend that all travelers purchase comprehensive travel insurance that includes coverage for trip cancellation/interruption, medical expenses, emergency evacuation, and lost luggage. For trips to Ethiopia, where medical facilities may not meet international standards in all areas, emergency medical evacuation coverage is particularly important. We can recommend reputable insurance providers that offer appropriate coverage for travel to Ethiopia. Please note that many policies require purchase shortly after making your initial trip deposit (often within 14-21 days) to cover pre-existing conditions and certain other benefits. We require proof of insurance before the start of your tour.'
  }]
}];
export function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<{
    [key: string]: boolean;
  }>({});
  // Filter FAQs based on search query
  const filteredFAQs = faqData.map(category => {
    const filteredQuestions = category.questions.filter(q => q.question.toLowerCase().includes(searchQuery.toLowerCase()) || q.answer.toLowerCase().includes(searchQuery.toLowerCase()));
    return {
      ...category,
      questions: filteredQuestions
    };
  }).filter(category => category.questions.length > 0);
  const toggleQuestion = (categoryIndex: number, questionIndex: number) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setExpandedQuestions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  return <div className="w-full bg-gray-50">
      {/* Hero Section */}
      <div className="relative h-64 bg-cover bg-center" style={{
      backgroundImage: "url('https://images.unsplash.com/photo-1574267432553-4b4628081c31?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80')"
    }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl max-w-3xl">
            Find answers to common questions about traveling in Ethiopia
          </p>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <input type="text" placeholder="Search for questions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full py-3 px-4 pr-12 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" />
              <Search size={20} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          {/* Category Tabs */}
          <div className="mb-8 overflow-x-auto">
            <div className="flex space-x-2 pb-2">
              <button onClick={() => setActiveCategory(null)} className={`px-4 py-2 rounded-full whitespace-nowrap ${activeCategory === null ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
                All Categories
              </button>
              {faqData.map((category, index) => <button key={index} onClick={() => setActiveCategory(category.category)} className={`px-4 py-2 rounded-full whitespace-nowrap ${activeCategory === category.category ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
                  {category.category}
                </button>)}
            </div>
          </div>
          {/* FAQ Accordion */}
          {filteredFAQs.length > 0 ? <div className="space-y-8">
              {filteredFAQs.filter(category => activeCategory === null || category.category === activeCategory).map((category, categoryIndex) => <div key={categoryIndex}>
                    <h2 className="text-2xl font-bold mb-4">
                      {category.category}
                    </h2>
                    <div className="space-y-4">
                      {category.questions.map((item, questionIndex) => {
                const key = `${categoryIndex}-${questionIndex}`;
                const isExpanded = expandedQuestions[key] || false;
                return <div key={questionIndex} className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <button className="w-full px-6 py-4 flex items-center justify-between text-left" onClick={() => toggleQuestion(categoryIndex, questionIndex)}>
                              <h3 className="font-medium text-lg">
                                {item.question}
                              </h3>
                              {isExpanded ? <ChevronUp size={20} className="text-amber-600 flex-shrink-0" /> : <ChevronDown size={20} className="text-amber-600 flex-shrink-0" />}
                            </button>
                            {isExpanded && <div className="px-6 py-4 bg-gray-50 border-t">
                                <p className="text-gray-700">{item.answer}</p>
                              </div>}
                          </div>;
              })}
                    </div>
                  </div>)}
            </div> : <div className="text-center py-12">
              <h3 className="text-xl font-medium text-gray-600">
                No questions found matching your search
              </h3>
              <p className="mt-2 text-gray-500">
                Try different keywords or browse by category
              </p>
            </div>}
          {/* Still Have Questions */}
          <div className="mt-12 bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Still Have Questions?</h2>
            <p className="text-gray-700 mb-4">
              We're here to help! Contact our travel experts for personalized
              assistance with planning your Ethiopian adventure.
            </p>
            <a href="/contact" className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-md transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </div>;
}