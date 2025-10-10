'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCurrentAccount } from '@mysten/dapp-kit';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { useUser } from '../../context/UserContext';

import Header from '../../components/Header';
import POAPsSection from '@/components/PoapSection';
import FooterSection from '@/components/FooterSection';
import Testimonials from '@/components/Testimonials';
import NewsletterSection from '@/components/NewsletterSection';
import { carouselImages } from '@/lib/carousel';

type Event = {
	id: number;
	title: string;
	description: string;
	date: string;
	location: string;
	attendees: number;
	category: string;
};

export default function HomePage() {
	const { login, user, logout } = useUser();
	const account = useCurrentAccount();

	const [events, setEvents] = useState<Event[]>([]);
	useEffect(() => {
		const fetchEvents = async () => {
			try {
				const res = await fetch('/api/events');
				const data = await res.json();
				setEvents(data.events || []);
			} catch (error) {
				console.error('Error fetching events:', error);
				setEvents([]); // fallback to empty array on error
			}
		};
		fetchEvents();
	}, []);
	
	const [showDropdown, setShowDropdown] = useState(false);
	const [showSignIn, setShowSignIn] = useState(false);

	// When wallet connects, log in with wallet address
	useEffect(() => {
		if (account && !user) {
			login({
				name: 'Sui User',
				email: '',
				emails: [{ address: '', primary: true, verified: false }],
				avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SuiLens',
				walletAddress: account.address,
			});
		}
	}, [account, login, user]);

	useEffect(() => {
		if (!user) setShowDropdown(false);
	}, [user]);

	return (
		<div className="min-h-screen font-inter mx-auto max-w-[1400px] px-2 sm:px-0">
			<div className="bg-gradient-to-b from-blue-400 via-blue-100 to-blue-50 border-2 border-gray-200 rounded-2xl">
				{/* Header */}
				<Header />
			   <hr className="border-t border-gray-200 m-0" />

			   {/* Hero Section */}
			   <section className="py-12 sm:py-32 lg:py-2 relative bg-white">
                <div className="container mx-auto px-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
                        {/* Left: Text Content */}
                        <div className="w-full lg:w-1/2 max-w-xl mx-auto lg:mx-0 text-center lg:text-left space-y-8">
							<div className="space-y-6">
								<p className='hidden sm:block text-base font-bold text-[#667185] uppercase pb-16'>Discover, Create, and Share Events on Sui</p>
								<h1 className="text-5xl sm:text-5xl md:text-6xl lg:text-7xl font-inter md:font-semibold sm:font-normal  text-[#020B15] leading-tight">
									Your <br /> community<br />starts here
								</h1>
								<p className="md:text-xl font-normal sm:font-normal sm:text-xs text-[#3A4A5C] max-w-2xl leading-relaxed mx-auto lg:mx-0">
									From meetups to big programs, Presana makes it easy to find, host, and connect with the Sui community
								</p>
							</div>
							<div className="flex flex-row gap-2 sm:gap-4 pt-2 justify-center lg:justify-start">
								<Link href="/create">
									<button className="flex-1 sm:flex-none bg-[#4DA2FF] text-white px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base font-normal rounded-2xl">
										Get Started For Free
									</button>
								</Link>
								<Link href="/discover">
									<button className="flex-1 sm:flex-none bg-white border border-[#667185] text-[#667185] px-2 sm:px-5 py-2 sm:py-3 text-xs sm:text-base font-normal rounded-2xl">
										Find your next event
									</button>
								</Link>
							</div>
						</div>
						{/* Mobile: Horizontal Carousel */}
						<div className="w-full lg:hidden mt-8">
							<div className="relative h-48 sm:h-56 overflow-hidden">
								<motion.div
									className="flex"
									animate={{
										x: [0, -(192 + 8) * carouselImages.length],
									}}
									transition={{
										duration: 25,
										repeat: Infinity,
										ease: "linear",
										repeatType: "loop"
									}}
								>
									{/* Display all images horizontally, duplicated for seamless loop */}
									{[...carouselImages, ...carouselImages].map((img, i) => (
										<div key={i} className="w-48 h-48 sm:w-56 sm:h-56 bg-gray-200 overflow-hidden flex-shrink-0 mr-2 rounded-lg">
											<img
												src={img}
												alt={`Community event ${i + 1}`}
												className="object-cover w-full h-full"
											/>
										</div>
									))}
								</motion.div>
							</div>
						</div>

						{/* Desktop: Vertical Image Grid */}
						<div className="w-full lg:w-1/2 justify-center hidden lg:flex">
                            <div className="grid grid-cols-3 w-[320px] sm:w-[400px] lg:w-[440px] h-[500px] sm:h-[600px] lg:h-[700px] overflow-hidden">
                                {/* Column 1 - Moving Up (3 images: 1-3) */}
                                <div className="relative h-full">
                                    <motion.div
                                        className="flex flex-col"
                                        animate={{
                                            y: [0, -100 * 3],
                                        }}
                                        transition={{
                                            duration: 20,
                                            repeat: Infinity,
                                            ease: "linear",
                                            repeatType: "loop"
                                        }}
                                    >
                                        {/* Display images 1-3, duplicated for loop */}
                                        {[...carouselImages.slice(0, 3), ...carouselImages.slice(0, 3)].map((img, i) => (
                                            <div key={i} className="w-full h-[166px] bg-gray-200 overflow-hidden flex-shrink-0">
                                                <img
                                                    src={img}
                                                    alt={`Community event ${i + 1}`}
                                                    className="object-cover w-full h-full"
                                                />
                                            </div>
                                        ))}
                                    </motion.div>
                                </div>

                                {/* Column 2 - Moving Down (4 images: 4-7) */}
                                <div className="relative h-full">
                                    <motion.div
                                        className="flex flex-col"
                                        animate={{
                                            y: [-100 * 4, 0],
                                        }}
                                        transition={{
                                            duration: 25,
                                            repeat: Infinity,
                                            ease: "linear",
                                            repeatType: "loop"
                                        }}
                                    >
                                        {/* Display images 4-7, duplicated for loop */}
                                        {[...carouselImages.slice(3, 7), ...carouselImages.slice(3, 7)].map((img, i) => (
                                            <div key={i} className="w-full h-[175px] bg-gray-200 overflow-hidden flex-shrink-0">
                                                <img
                                                    src={img}
                                                    alt={`Community event ${i + 4}`}
                                                    className="object-cover w-full h-full"
                                                />
                                            </div>
                                        ))}
                                    </motion.div>
                                </div>

                                {/* Column 3 - Moving Up (3 images: 8-10) */}
                                <div className="relative h-full">
                                    <motion.div
                                        className="flex flex-col"
                                        animate={{
                                            y: [0, -100 * 3],
                                        }}
                                        transition={{
                                            duration: 30,
                                            repeat: Infinity,
                                            ease: "linear",
                                            repeatType: "loop"
                                        }}
                                    >
                                        {/* Display images 8-10, duplicated for loop */}
                                        {[...carouselImages.slice(7, 10), ...carouselImages.slice(7, 10)].map((img, i) => (
                                            <div key={i} className="w-full h-[233px] bg-gray-200 overflow-hidden flex-shrink-0">
                                                <img
                                                    src={img}
                                                    alt={`Community event ${i + 8}`}
                                                    className="object-cover w-full h-full"
                                                />
                                            </div>
                                        ))}
                                    </motion.div>
                                </div>
                            </div>
                        </div>
					</div>
				</div>
			</section>

			   <hr className="border-t border-gray-200 m-0" />
			   {/* Community Events Grid */}
			   <section className="py-16 bg-white">
				<div className="container mx-auto px-6 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
					{/* Illustration Placeholder */}
					<div className="mb-8">
                        <div className="w-40 h-40 sm:w-56 sm:h-56 mx-auto flex items-center justify-center">
                            {/* Replace src with your illustration image */}
                            <motion.img
                                src="/communitiesgather.png"
                                alt="Communities Illustration"
                                className="object-contain w-full h-full"
                                animate={{ rotate: 360 }}
                                transition={{
                                    duration: 12,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />
                        </div>
                    </div>
					<h2 className="text-3xl sm:text-5xl md:font-bold sm:font-normal text-[#1A2530] text-center mb-4 font-inter">
						Presana is where <br /> Communities Bring <br />Events  Onchain
						
					</h2>
					<p className="text-base sm:text-lg text-[#3A4A5C] text-center max-w-xl font-inter">
						Presana brings people together through events and bounties. A place to connect, collaborate, and grow with the community.
					</p>
				</div>
			</section>
			</div>

			{/* POAPs Section */}
			<POAPsSection />
			<Testimonials />

			{/* Newsletter Section */}
			<NewsletterSection />

			<FooterSection />

			
			{/* Modal Dialog */}
			{showSignIn && (
				<div className="fixed inset-0 z-[150] flex items-center justify-center bg-black bg-opacity-50">
					<div className="bg-white rounded-xl shadow-2xl p-6 w-11/12 max-w-sm relative">
						<button
							className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
							onClick={() => setShowSignIn(false)}
							aria-label="Close"
						>
							×
						</button>
						{/* Your sign-in form or wallet connect logic here */}
						<h2 className="text-xl font-bold mb-4">Sign In</h2>
						<Button
							className="w-full bg-[#4DA2FF] text-white"
							onClick={() => {
								// Call your login logic here
								setShowSignIn(false);
							}}
						>
							Connect Wallet
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
