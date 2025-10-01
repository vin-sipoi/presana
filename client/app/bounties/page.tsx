"use client"

import Header from "../../components/Header";

const CommunityBounties: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="flex flex-col items-center justify-center h-[70vh]">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Coming Soon</h1>
        <p className="text-lg text-gray-500">Bounties will be available here soon. Stay tuned!</p>
      </main>
    </div>
  );
};

export default CommunityBounties;