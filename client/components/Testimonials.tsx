import React from 'react'


const testimonials = [
  {
    text: "This is really solid. Honestly, I wasn't familiar with the product before now, but if this is what you've been shilling on X, then it is definitely worth it fr.\nThe app feels super smooth, fast, and has that pro-level quality.",
    name: 'Olamii.sui',
    handle: '@OlamiPo___',
    img: '/commmember1.png',
  },
  {
    text: "Presana literally took all the problems associated with sui events and solved them with one product...",
    name: 'Tobi',
    handle: '@sheisTobi_',
    img: '/commmember3.png',
  },

  {
    text: "One of the best apps I've seen in a while. Up to par with existing apps and has a unique use case.",
    name: 'Cleanwater',
    handle: '@CleanwaterSui',
    img: '/commmember2.png',
  },

  {
    text: "Presana has taken events transparency to another level! Head counts, events attendances, etc are now onchain with Presana. Can’t wait to see Sui protocols use this tool for their events all over the world. Im convinced this is definitely, the dynamic tool for the present, and the future of events in our beloved ecosystem.",
    name: 'Zibah.sui',
    handle: '@ZibahTheCreator',
    img: '/commmember4.png',
  },
];

const Testimonials = () => {
  return (
    <section className=" bg-white">
      <div className="container mx-auto px-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-xl overflow-hidden border border-gray-200">

          {/* Center column - First on mobile */}
          <div className="relative flex flex-col justify-end bg-gradient-to-br from-[#439DFF] to-[#007AFF] text-white px-8 py-16 md:py-0 md:min-h-[420px] order-1 md:order-2">
            {/* Icon in top left */}
            <img src="/communitylogo.png" alt="Community Icon" className="absolute top-6 left-6 w-6 h-6" />
            {/* Text at the bottom */}
            <div className="mt-auto mb-2">
              <h2 className="text-5xl sm:text-3xl md: font-semibold sm:font-normal leading-tight text-left pb-10">
                What the<br />Community <br />is Saying
              </h2>
            </div>
          </div>

          {/* Left column - Second on mobile */}
          <div className="flex flex-col justify-between divide-y divide-gray-200 bg-white order-2 md:order-1">
            <div className="p-8 flex-1 flex flex-col justify-center">
              <p className="text-sm font-normal text-[#101928] mb-4">{testimonials[0].text}</p>
              <div className="flex items-center gap-3 mt-auto">
                <img src={testimonials[0].img} alt={testimonials[0].name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="font-bold text-sm text-[#101928]">{testimonials[0].name}</div>
                  <div className="text-xs font-normal text-[#667185]">{testimonials[0].handle}</div>
                </div>
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-center">
              <p className="text-sm font-normal text-[#101928] mb-4">{testimonials[2].text}</p>
              <div className="flex items-center gap-3 mt-auto">
                <img src={testimonials[2].img} alt={testimonials[2].name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-sm">{testimonials[2].name}</div>
                  <div className="text-xs font-normal text-[#667185]">{testimonials[2].handle}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Third on mobile */}
          <div className="flex flex-col justify-between divide-y divide-gray-200 bg-white order-3 md:order-3 border-t md:border-t-0 border-gray-200">
            <div className="p-8 flex-1 flex flex-col justify-center">
              <p className="text-sm font-normal text-[#101928] mb-4">{testimonials[1].text}</p>
              <div className="flex items-center gap-3 mt-auto">
                <img src={testimonials[1].img} alt={testimonials[1].name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-sm">{testimonials[1].name}</div>
                  <div className="text-xs font-normal text-[#667185]">{testimonials[1].handle}</div>
                </div>
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-center">
              <p className="text-sm font-normal text-[#101928] mb-2">{testimonials[3].text}</p>
              <div className="flex items-center gap-3 mt-auto">
                <img src={testimonials[3].img} alt={testimonials[3].name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-sm">{testimonials[3].name}</div>
                  <div className="text-xs font-normal text-[#667185]">{testimonials[3].handle}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Testimonials