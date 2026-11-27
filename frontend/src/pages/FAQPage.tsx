import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
    answer: "Many visitors travel to Addis Ababa, the south and the east without problems, but conditions differ a lot by region and can change quickly. Several governments currently advise against travel to parts of Amhara, Tigray and Afar and to some border areas. Before you book, check your government's latest travel advice, ask the provider about the current situation on your route, and consider registering with your embassy. Take normal precautions in cities, such as watching your belongings and avoiding isolated areas after dark."
  }]
}, {
  category: 'Tours & Activities',
  questions: [{
    question: 'What types of tours can I book on Visit Ethiopia?',
    answer: "Tours are offered by independent local operators, so the range depends on who is listed. Typical options include the historic northern circuit (Lalibela, Gondar, Axum, Bahir Dar), trekking in the Simien and Bale Mountains, cultural trips in the south, Addis Ababa city tours, coffee and food experiences, birding, and festival trips for Timket and Meskel. Each listing shows the operator, the itinerary, what is included and the price."
  }, {
    question: 'Can a tour be customized to my interests?',
    answer: "Many operators offer private or tailored trips. Check the listing for customization options, or contact the operator through the details on their company profile before booking. Visit Ethiopia does not design itineraries itself, but our free travel guide (the chat button on every page) can help you work out where to go and when."
  }, {
    question: 'Are tours suitable for families with children?',
    answer: "Many are. City tours and historic sites such as Lalibela and Gondar usually work well for children, while long drives, high-altitude treks and trips to the Danakil are better suited to older children and adults. Check the listing's requirements and ask the operator about age limits and pace before booking."
  }, {
    question: 'What should I pack for my Ethiopian tour?',
    answer: "Packing for Ethiopia depends on your itinerary and the season, but generally we recommend: lightweight, modest clothing (shoulders and knees should be covered, especially when visiting religious sites); a warm layer or jacket for cool evenings, especially in highland areas; comfortable walking shoes or hiking boots; sun protection (hat, sunglasses, sunscreen); a rain jacket or small umbrella during the rainy season; any personal medications and a basic first-aid kit; a camera with extra batteries; and a headlamp or flashlight for potential power outages. If your trip includes trekking or other special activities, ask your operator for a detailed packing list."
  }]
}, {
  category: 'Accommodations',
  questions: [{
    question: 'What types of accommodations are available in Ethiopia?',
    answer: "Ethiopia offers a range of accommodation options to suit different preferences and budgets. In Addis Ababa and major cities, you'll find international-standard hotels with modern amenities. In tourist destinations like Lalibela and Gondar, there are comfortable tourist-class hotels and some boutique options. More remote areas may offer simpler lodges or guesthouses with basic facilities. For nature lovers, there are eco-lodges in places like the Simien Mountains and Bale Mountains. You can compare hotels, lodges and resorts under Hotels, and each tour listing says which accommodation is included."
  }, {
    question: 'Do hotels in Ethiopia have reliable electricity and hot water?',
    answer: 'In major cities and established tourist destinations, hotels generally have reliable electricity and hot water, though brief power outages can occur throughout Ethiopia. Many better hotels have generators for backup power. In more remote areas, electricity may be limited to certain hours of the day, and hot water might not be consistently available. Eco-lodges often use solar power, which can be dependent on weather conditions. If reliable power or hot water matters to you, check the hotel listing or ask the provider before you book.'
  }, {
    question: 'Is Wi-Fi available in Ethiopian hotels?',
    answer: "Wi-Fi availability varies across Ethiopia. Most hotels in Addis Ababa and other major cities offer Wi-Fi, though connection speeds may be slower than what you're accustomed to at home. In smaller towns and rural areas, Wi-Fi might be limited or unavailable. Even where Wi-Fi is offered, connectivity can be intermittent. For those needing regular internet access, we recommend purchasing a local SIM card with a data package upon arrival in Ethiopia, which often provides more reliable connectivity than hotel Wi-Fi. We suggest informing friends and family that you may have limited internet access during portions of your trip."
  }]
}, {
  category: 'Transportation',
  questions: [{
    question: 'How do I get around within Ethiopia?',
    answer: "Ethiopian Airlines runs an extensive domestic network, which is the quickest way to cover long distances. For road travel you can book private vehicles with drivers, airport transfers and intercity transport from the providers listed under Transport. Public buses exist but are slower and less comfortable. Some trips include special transport, such as boats on Lake Tana."
  }, {
    question: 'Are domestic flights reliable in Ethiopia?',
    answer: "Ethiopian Airlines operates the domestic flight network and generally maintains good reliability standards. However, schedule changes and delays can occur due to weather conditions, especially during the rainy season, or operational reasons. Avoid tight connections, and leave at least a day between your last domestic flight and your international departure."
  }, {
    question: 'What is the condition of roads in Ethiopia?',
    answer: 'Road conditions in Ethiopia vary widely. Major highways connecting cities are generally paved and in reasonable condition, while secondary roads may be unpaved, rough, or challenging during the rainy season. Road improvement projects are ongoing throughout the country, but travel times can still be longer than expected based on distance alone due to road conditions, traffic in urban areas, and the mountainous terrain. Allow realistic travel times, and for rough routes choose a 4WD vehicle with an experienced driver.'
  }]
}, {
  category: 'Health & Safety',
  questions: [{
    question: 'What vaccinations do I need for Ethiopia?',
    answer: 'Travelers to Ethiopia should consult with a travel health professional or visit a travel clinic at least 4-6 weeks before departure to get the most current recommendations. Common vaccinations recommended for Ethiopia include: Yellow Fever (required if arriving from or transiting through a country with yellow fever risk), Hepatitis A and B, Typhoid, Tetanus, Diphtheria, and Polio. Depending on your specific itinerary and activities, additional vaccinations like Rabies or Meningitis may be recommended. Malaria prevention measures are also important for many areas of Ethiopia, though the risk is lower in highlands above 2,500 meters. Always get personalized medical advice as recommendations can change and vary based on your health history.'
  }, {
    question: 'Is the food and water safe in Ethiopia?',
    answer: 'To minimize health risks, we recommend drinking only bottled or purified water, which is readily available throughout tourist areas. Avoid tap water, ice made from tap water, and raw fruits and vegetables that you cannot peel yourself. Ethiopian cuisine is delicious and generally prepared freshly, which reduces food safety concerns. When dining out, choose busy restaurants with high turnover. We recommend bringing hand sanitizer and using it regularly, especially before meals. If you have specific dietary requirements or concerns, please inform us in advance so we can make appropriate arrangements.'
  }, {
    question: 'Should I be concerned about altitude sickness in Ethiopia?',
    answer: 'Many popular destinations in Ethiopia, including Addis Ababa (2,355m), Lalibela (2,500m), and the Simien Mountains (which reach over 4,000m), are at high altitudes where altitude sickness can be a concern. Symptoms can include headache, fatigue, shortness of breath, and nausea. To minimize risk, we design itineraries that allow for gradual acclimatization when possible. We recommend staying hydrated, avoiding alcohol during the first days at altitude, taking it easy initially, and considering speaking with your doctor about altitude sickness medication before your trip. If you have heart or lung conditions, please consult your physician before booking a trip to highland areas of Ethiopia.'
  }, {
    question: 'What medical facilities are available for tourists?',
    answer: 'Medical facilities in Ethiopia vary significantly in quality and availability. Addis Ababa has the best medical facilities in the country, including some private clinics and hospitals that can provide reasonable care for minor issues. Outside the capital, medical facilities are more limited and may not meet international standards. We strongly recommend purchasing comprehensive travel insurance that includes emergency medical evacuation coverage before your trip. Bring any prescription medications you need in their original packaging, along with a copy of the prescription. A basic first-aid kit for minor issues is also advisable. Ask your tour operator whether its guides are trained in first aid.'
  }]
}, {
  category: 'Money & Payments',
  questions: [{
    question: 'What currency is used in Ethiopia?',
    answer: "The Ethiopian Birr (ETB) is the official currency of Ethiopia. Banknotes come in denominations of 1, 5, 10, 50, 100, and 200 Birr. While credit cards are accepted at major hotels and some high-end establishments in Addis Ababa, cash is the primary payment method throughout most of the country. We recommend bringing US dollars (issued after 2006 and in good condition) to exchange locally. ATMs are available in major cities but may not always be reliable or accept all international cards. It's advisable to carry enough cash for daily expenses, especially when traveling outside of major urban centers."
  }, {
    question: 'How much should I budget for additional expenses?',
    answer: 'For expenses not included in your booking (such as additional meals, souvenirs, and optional activities), we recommend budgeting approximately $20-40 USD per day for moderate spending. Meals at mid-range restaurants typically cost $5-15 USD, while souvenirs and handicrafts vary widely in price depending on quality and craftsmanship. Tipping is customary in Ethiopia; we suggest $5-10 per day for guides and $3-5 per day for drivers. If your tour includes other service providers like boat operators or site guides, $2-3 per service is appropriate. Note that some higher-end establishments may add a service charge to bills, but additional tipping is still appreciated.'
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
    question: 'How far in advance should I book?',
    answer: "For the high season (October to January) and for festivals such as Timket (19–20 January) and Meskel (late September), book two to four months ahead so hotels and domestic flights are still available. Outside those periods a few weeks is often enough, though availability depends on each provider."
  }, {
    question: 'What is the cancellation policy?',
    answer: 'Each provider sets its own cancellation terms, which are shown on the listing before you book. To cancel, open the booking under My bookings and choose to cancel it. Any refund due is returned through Chapa to your original payment method. If a provider cancels a confirmed booking, you receive a full refund.'
  }, {
    question: 'How do payments work?',
    answer: 'You pay in Ethiopian Birr through Chapa, our payment partner, using the methods shown at checkout. Your booking is only marked as paid once the payment is verified with Chapa, and you can follow its status under My bookings.'
  }, {
    question: 'Do you offer travel insurance?',
    answer: 'No. Visit Ethiopia does not sell insurance, but we strongly recommend a policy that covers trip cancellation, medical treatment and emergency evacuation, since medical facilities outside Addis Ababa are limited. Some tour operators require proof of insurance, so check the listing.'
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
              Ask our free travel guide (the chat button at the bottom of the page) or send us a message.
            </p>
            <Link to="/contact" className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-md transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>;
}