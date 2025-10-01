import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { NETWORK_CONFIG } from './network-config';

const suiClient = new SuiClient({
  url: NETWORK_CONFIG.fullnodeUrl,
});

export { suiClient };

export class SuilensService {
  private packageId: string;
  private eventRegistryId: string;
  private poapRegistryId: string;
  private bountyPackageId: string;
  private bountyRegistryId: string;
  private communityRegistryId: string;

  constructor() {
    this.packageId = process.env.NEXT_PUBLIC_PACKAGE_ID || '';
    this.eventRegistryId = process.env.NEXT_PUBLIC_EVENT_REGISTRY_ID || '';
    this.poapRegistryId = process.env.NEXT_PUBLIC_POAP_REGISTRY_ID || '';
    this.bountyPackageId = process.env.NEXT_PUBLIC_BOUNTY_PACKAGE_ID || '';
    this.bountyRegistryId = process.env.NEXT_PUBLIC_BOUNTY_REGISTRY_ID || '';
    this.communityRegistryId = process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY_ID || '';
  }

  async createProfile(username: string, bio: string, avatarUrl: string) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::suilens_core::create_profile`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.string(username),
        tx.pure.string(bio),
        tx.pure.string(avatarUrl),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async updateProfile(username: string, bio: string, avatarUrl: string) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::suilens_core::update_profile`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.string(username),
        tx.pure.string(bio),
        tx.pure.string(avatarUrl),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async createEvent(eventData: {
    name: string;
    description: string;
    bannerUrl: string;
    nftImageUrl: string;
    poapImageUrl: string;
    location?: string;
    category?: string;
    startTime: number;
    endTime: number;
    maxAttendees: number;
    ticketPrice?: number;
    requiresApproval?: boolean;
    poapTemplate: string;
  }) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::suilens_core::create_event`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.string(eventData.name),
        tx.pure.string(eventData.description),
        tx.pure.string(eventData.bannerUrl),
        tx.pure.string(eventData.nftImageUrl),
        tx.pure.string(eventData.poapImageUrl),
        tx.pure.u64(eventData.startTime),
        tx.pure.u64(eventData.endTime),
        tx.pure.string(eventData.location || ''),
        tx.pure.string(eventData.category || 'General'), // Default to 'General' if not provided
        eventData.maxAttendees ? tx.pure.option('u64', eventData.maxAttendees) : tx.pure.option('u64', null),
        tx.pure.u64(eventData.ticketPrice || 0),
        tx.pure.bool(eventData.requiresApproval || false),
        tx.pure.bool(false), // is_private - default to false
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async mintPOAP(eventId: string) {
    const tx = new Transaction();

    // Mint POAP directly from event data - uses event's poap_image_url
    tx.moveCall({
      target: `${this.packageId}::suilens_core::mint_event_poap`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async getEventDetails(eventId: string) {
    try {
      return await suiClient.getObject({
        id: eventId,
        options: {
          showContent: true,
          showType: true,
        },
      });
    } catch (error) {
      console.error('Error fetching event details:', error);
      throw new Error('Failed to fetch event details');
    }
  }

  async getUserPOAPs(userAddress: string) {
    try {
      // Query user's POAP objects
      return await suiClient.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::suilens_core::EventPOAP`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });
    } catch (error) {
      console.error('Error fetching user POAPs:', error);
      throw new Error('Failed to fetch user POAPs');
    }
  }

  async getUserEventNFTs(userAddress: string) {
    try {
      // Query user's Event NFT objects
      return await suiClient.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::suilens_core::EventNFT`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });
    } catch (error) {
      console.error('Error fetching user Event NFTs:', error);
      throw new Error('Failed to fetch user Event NFTs');
    }
  }

  async getUserEventStats(userAddress: string) {
    try {
      // Get all events and count user's registrations and attendance
      const allEvents = await this.getAllEvents();
      let attendedCount = 0;
      let registeredCount = 0;

      // For a more accurate count, we would need to check the event objects
      // This is a simplified version - in practice you'd query the blockchain
      // for events where the user is in the rsvps or attendance arrays
      
      // Get user's POAPs and NFTs to estimate attended events
      const [poaps, eventNFTs] = await Promise.all([
        this.getUserPOAPs(userAddress),
        this.getUserEventNFTs(userAddress)
      ]);

      return {
        poapCount: poaps.data?.length || 0,
        eventNFTCount: eventNFTs.data?.length || 0,
        estimatedAttendedEvents: poaps.data?.length || 0,
        registeredEvents: eventNFTs.data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching user event stats:', error);
      return {
        poapCount: 0,
        eventNFTCount: 0,
        estimatedAttendedEvents: 0,
        registeredEvents: 0
      };
    }
  }

  async getAllEvents() {
    try {
      // Query all events from the registry
      const events = await suiClient.getDynamicFields({
        parentId: this.eventRegistryId,
      });
      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw new Error('Failed to fetch events');
    }
  }

  async registerForEvent(eventId: string, ticketPrice: number = 0, isSponsored: boolean = false) {
    const tx = new Transaction();

    // For sponsored transactions, we need to handle coin creation differently
    // to avoid GasCoin references that Enoki rejects
    let coin;
    if (ticketPrice > 0) {
      if (isSponsored) {
        // For sponsored paid events, we cannot use GasCoin as an argument
        // This is a limitation of the current implementation
        // The Move contract expects a Coin<SUI> but we can't create one without GasCoin reference
        // For now, we'll pass zero and handle payment through alternative means
        // Note: This branch should not be used for paid events in the new conditional sponsorship approach
        coin = tx.pure.u64(0);
      } else {
        // For non-sponsored paid events, split from gas coin as usual
        [coin] = tx.splitCoins(tx.gas, [ticketPrice]);
      }
    } else {
      // For free events, we need to pass a Coin<SUI> object to the contract
      // The contract expects a coin even for free events
      if (isSponsored) {
        // For sponsored transactions, use coin::zero() to create a zero-value coin
        // This avoids GasCoin references that Enoki rejects
        coin = tx.moveCall({
          target: '0x2::coin::zero',
          typeArguments: ['0x2::sui::SUI'],
          arguments: [],
        });
      } else {
        // For non-sponsored free events, split zero amount from gas coin
        [coin] = tx.splitCoins(tx.gas, [0]);
      }
    }

    tx.moveCall({
      target: `${this.packageId}::suilens_core::register_for_event`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        coin, // Coin object with correct value
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async approveRegistration(eventId: string, attendeeAddress: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::suilens_core::approve_registration`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.pure.address(attendeeAddress),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async rejectRegistration(eventId: string, attendeeAddress: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::suilens_core::reject_registration`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.pure.address(attendeeAddress),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async cancelRegistration(eventId: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::suilens_core::cancel_registration`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async markAttendance(eventId: string, attendeeAddress: string) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::suilens_core::mark_attendance`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.pure.address(attendeeAddress),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async verifyAndCheckin(eventId: string, ticketCode: string, attendeeAddress: string) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::suilens_core::verify_and_checkin`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.pure.string(ticketCode),
        tx.pure.address(attendeeAddress),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async selfCheckin(eventId: string, verificationCode: string) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::suilens_core::self_checkin`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.pure.string(verificationCode),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async mintEventNFT(eventId: string) {
    const tx = new Transaction();
    
    // Basic mint using event's stored metadata (contract should include nftImageUrl)
    tx.moveCall({
      target: `${this.packageId}::suilens_core::mint_event_nft`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async withdrawEventFunds(eventId: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::suilens_core::withdraw_event_funds`,
      arguments: [
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async checkEventRegistration(eventId: string, userAddress: string) {
    try {
      // Get the event object to check if user is in attendees list
      const eventObject = await suiClient.getObject({
        id: eventId,
        options: {
          showContent: true,
        },
      });

      if (!eventObject.data?.content || eventObject.data.content.dataType !== 'moveObject') {
        return {
          isRegistered: false,
          registrationTime: null,
        };
      }

      const eventData = eventObject.data.content.fields as any;

      // Check if user is in attendees or approved_attendees
      const attendees = eventData.attendees?.fields?.contents || [];
      const approvedAttendees = eventData.approved_attendees?.fields?.contents || [];

      const isInAttendees = attendees.includes(userAddress);
      const isInApproved = approvedAttendees.includes(userAddress);

      return {
        isRegistered: isInAttendees || isInApproved,
        registrationTime: null, // Could be enhanced to get actual registration time
      };
    } catch (error) {
      console.error('Error checking registration:', error);
      throw new Error('Failed to check registration status');
    }
  }

  async createPOAPCollection(eventId: string, poapData: {
    name: string;
    description: string;
    imageUrl: string;
    maxSupply?: number;
  }) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.packageId}::suilens_poap::create_poap_collection`,
      arguments: [
        tx.object(this.poapRegistryId),
        tx.object(this.eventRegistryId),
        tx.pure.id(eventId),
        tx.pure.string(poapData.name),
        tx.pure.string(poapData.description),
        tx.pure.string(poapData.imageUrl),
        poapData.maxSupply ? tx.pure.option('u64', poapData.maxSupply) : tx.pure.option('u64', null),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async createEventWithRewardPool(eventData: {
    name: string;
    description: string;
    bannerUrl: string;
    nftImageUrl: string;
    poapImageUrl: string;
    location?: string;
    category?: string;
    startTime: number;
    endTime: number;
    maxAttendees: number;
    ticketPrice?: number;
    requiresApproval?: boolean;
    poapTemplate: string;
  }, rewardPoolData?: {
    amount: number;
    maxParticipants: number;
  }) {
    const tx = new Transaction();
    
    if (rewardPoolData) {
      // Create event with reward pool using BOUNTY contract
      tx.moveCall({
        target: `${this.bountyPackageId}::event_bounty::create_event_with_rewards`,
        arguments: [
          tx.pure.string(eventData.name),
          tx.pure.string(eventData.description),
          tx.pure.u64(eventData.startTime),
          tx.pure.u64(eventData.endTime),
          tx.pure.u64(eventData.maxAttendees),
          tx.pure.string(eventData.poapTemplate),
          tx.pure.u64(rewardPoolData.amount),
          tx.pure.u64(rewardPoolData.maxParticipants),
          tx.object(this.bountyRegistryId),
        ],
      });
    } else {
      // Use your existing POAP contract for regular events
      return this.createEvent(eventData);
    }

    return tx;
  }

  async lockRewardPool(eventObjectId: string, amount: number) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.bountyPackageId}::reward_pool::lock_funds`,
      arguments: [
        tx.object(eventObjectId),
        tx.pure.u64(amount),
        tx.object('0x6'), // Clock object
      ],
    });

    return tx;
  }

  async getRewardPoolStatus(eventObjectId: string) {
    try {
      return await suiClient.getObject({
        id: eventObjectId,
        options: {
          showContent: true,
          showType: true,
        },
      });
    } catch (error) {
      console.error('Error fetching reward pool status:', error);
      throw new Error('Failed to fetch reward pool status');
    }
  }

  async distributeRewards(eventObjectId: string, participants: string[]) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.bountyPackageId}::reward_pool::distribute_rewards`,
      arguments: [
        tx.object(eventObjectId),
        tx.pure.vector('address', participants),
        tx.object('0x6'),
      ],
    });

    return tx;
  }

  async unlockRewardPool(eventObjectId: string) {
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.bountyPackageId}::reward_pool::unlock_funds`,
      arguments: [
        tx.object(eventObjectId),
        tx.object('0x6'),
      ],
    });

    return tx;
  }
}

export const suilensService = new SuilensService();

// Export mintPOAP function directly for component use
export const mintPOAP = async (eventId: string) => {
  return suilensService.mintPOAP(eventId);
};

// Helper function for minting POAP directly from event data
export async function mintPOAPHelper(
  eventId: string,
  packageId?: string
) {
  const tx = new Transaction();

  const actualPackageId = packageId || process.env.NEXT_PUBLIC_PACKAGE_ID || '';
  const eventRegistryId = process.env.NEXT_PUBLIC_EVENT_REGISTRY_ID || '';

  // Mint POAP directly from event's poap_image_url - no collection required
  tx.moveCall({
    target: `${actualPackageId}::suilens_core::mint_event_poap`,
    arguments: [
      tx.object(eventRegistryId),
      tx.pure.id(eventId),
      tx.object('0x6'), // Clock object
    ],
  });

  return tx;
}

// Utility functions for working with Sui
export const suiUtils = {
  // Convert timestamp to Sui format
  timestampToSui: (timestamp: number): number => {
    return Math.floor(timestamp / 1000); // Convert to seconds
  },

  // Convert Sui timestamp to JS timestamp
  suiToTimestamp: (suiTimestamp: number): number => {
    return suiTimestamp * 1000; // Convert to milliseconds
  },

  // Validate Sui address
  isValidSuiAddress: (address: string): boolean => {
    return /^0x[a-fA-F0-9]{64}$/.test(address);
  },

  // Format Sui address for display
  formatAddress: (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },
};

// Export types for better TypeScript support
export interface EventData {
  id: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  maxAttendees: number;
  currentAttendees: number;
  poapTemplate: string;
  creator: string;
  isActive: boolean;
}

export interface POAPData {
  id: string;
  eventId: string;
  name: string;
  description: string;
  imageUrl: string;
  metadata: string;
  owner: string;
  mintedAt: number;
}

export interface RegistrationData {
  eventId: string;
  userAddress: string;
  registeredAt: number;
  isApproved: boolean;
}
