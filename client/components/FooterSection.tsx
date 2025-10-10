import React, { useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { faqs } from '../lib/faq';

const FooterSection = () => {
  const [email, setEmail] = useState('');
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  

  return (
    <>
      {/* FAQ Section */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-6 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-[#101928] mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl font-normal text-[#747474]">
                Got questions? We’ve got the answers 
              </p>
            </div>
            
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full px-6 py-4 text-left bg-blue-50 hover:bg-blue-100 transition-colors flex justify-between items-center"
                  >
                    <span className="font-medium text-gray-900 text-sm sm:text-base">
                      {faq.question}
                    </span>
                    <ChevronDown 
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        openFAQ === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFAQ === index && (
                    <div className="px-6 py-4 bg-white border-t border-gray-100">
                      <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    
      {/* Footer */}
      <footer className="bg-gray-100 py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
            {/* Left side - Logo and Links */}
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-8">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                    <img
                      src="https://i.ibb.co/PZHSkCVG/Suilens-Logo-Mark-Suilens-Black.png"
                      alt="Presana Logo"
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    Presana
                  </span>
                </div>
              </div>

             
            </div>

            {/* Right side - Copyright */}
            <p className="text-sm font-medium text-gray-600">
              © 2025. Presana. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default FooterSection;