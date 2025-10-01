import React from 'react';

const POAPsSection = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12">

          {/* Row 1 */}
          <div className="flex flex-col md:flex-row bg-white rounded-xl overflow-hidden min-h-[500px]">
            {/* Left: Medal Image Placeholder */}
            <div className="md:w-2/5 flex items-center justify-center bg-[#D21C4B] min-h-[400px] py-20">
              <img
                src="/prize.png"
                alt="Medal Placeholder"
                className="w-40 h-48 sm:w-48 sm:h-60 md:w-60 md:h-72 object-contain"
              />
            </div>
            {/* Right: Text */}
            <div className="md:w-3/5 flex flex-col justify-center px-6 sm:px-12 py-12 sm:py-20 ml-0 sm:ml-8 text-left">
              <h3 className="text-4xl sm:text-4xl lg:text-5xl md:font-semibold sm:font-normal mb-3 text-[#101928]">
                Good events are<br />remembered, great ones<br />are rewarded
              </h3>
              <p className="text-[#667185] mb-6 font-normal pb-10">
                Make your events unforgettable with POAPs
              </p>
              <button
                className="border border-[#D0D5DD] text-[#101928] px-5 py-3 rounded-2xl text-sm font-semibold w-fit"
                onClick={() => window.location.href = '/create'}
              >
                Create an event
              </button>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col md:flex-row bg-white rounded-xl overflow-hidden min-h-[500px]">
            {/* Left: Text */}
            <div className="md:w-3/5 flex flex-col justify-center px-6 sm:px-12 py-12 sm:py-20 mr-0 sm:mr-8 order-2 md:order-1 text-left">
              <h3 className="text-4xl lg:text-5xl sm:text-4xl md:font-semibold sm:font-normal mb-3 text-[#101928]">
                Contributors earn.<br />Creators find help.<br />Everyone wins.
              </h3>
              <p className="text-[#667185] mb-6 pb-16">
                Turn skills into rewards with community bounties. <br /> Creators post tasks, builders complete them, and <br /> everyone wins — simple and rewarding.
              </p>
              <button
                className="border border-[#D0D5DD] text-[#101928] px-5 py-3 rounded-2xl text-sm font-semibold w-fit"
                onClick={() => window.location.href = '/bounties'}
              >
                Discover Bounties
              </button>
            </div>
            {/* Right: Trophy Image Placeholder */}
            <div className="md:w-2/5 flex items-center justify-center bg-[#FFF3C7] min-h-[400px] py-20 order-1 md:order-2">
              <img
                src="/winner cup.png"
                alt="Trophy Placeholder"
                className="w-40 h-48 sm:w-48 sm:h-60 md:w-60 md:h-72 object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default POAPsSection;