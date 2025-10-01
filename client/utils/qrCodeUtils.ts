import QRCode from 'qrcode';

export interface EventQRData {
  eventId: string;
  verificationCode: string;
  timestamp: number;
}

/**
 * Generate a QR code for event check-in
 * Format: https://suilens.xyz/checkin/{eventId}/{verificationCode}/{timestamp}
 * This web URL can be scanned by any QR scanner and will work on mobile
 */
export async function generateEventQRCode(eventId: string): Promise<string> {
  // Generate a unique verification code
  const verificationCode = generateVerificationCode();
  const timestamp = Date.now();

  // Create the QR data as a web URL that can be handled by the app
  const qrData = `https://suilens.xyz/checkin/${eventId}/${verificationCode}/${timestamp}`;
  
  try {
    // Generate QR code as data URL (base64 encoded image)
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a QR code for user's event ticket
 * Format: suilens://ticket/{eventId}/{userAddress}/{timestamp}
 */
export async function generateUserEventQRCode(eventId: string, userAddress: string): Promise<string> {
  const timestamp = Date.now();
  
  // Create the QR data URL format for user's ticket
  const qrData = `suilens://ticket/${eventId}/${userAddress}/${timestamp}`;
  
  try {
    // Generate QR code as data URL (base64 encoded image)
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating user event QR code:', error);
    throw new Error('Failed to generate user event QR code');
  }
}

/**
 * Parse QR code data from scanned string
 */
export function parseEventQRCode(qrData: string): EventQRData | null {
  try {
    console.log('Attempting to parse QR code:', qrData);

    // Check if it's a web URL QR code
    if (qrData.startsWith('https://suilens.xyz/checkin/')) {
      console.log('Detected SuiLens web check-in URL');
    } else if (qrData.startsWith('suilens://checkin/')) {
      console.log('Detected legacy SuiLens custom scheme URL');
    } else {
      console.error('WRONG QR CODE: Not a SuiLens event check-in code');
      console.error('QR code data:', qrData);
      return null;
    }

    // Expected formats:
    // https://suilens.xyz/checkin/{eventId}/{verificationCode}/{timestamp}
    // suilens://checkin/{eventId}/{verificationCode}/{timestamp}

    let pattern;
    if (qrData.startsWith('https://')) {
      pattern = /^https:\/\/suilens\.xyz\/checkin\/([^\/]+)\/([^\/]+)\/(\d+)$/;
    } else {
      pattern = /^suilens:\/\/checkin\/([^\/]+)\/([^\/]+)\/(\d+)$/;
    }

    const match = qrData.match(pattern);

    if (!match) {
      console.error('WRONG QR CODE FORMAT: Invalid SuiLens check-in code structure');
      console.error('Expected: https://suilens.xyz/checkin/{eventId}/{verificationCode}/{timestamp}');
      console.error('Or legacy: suilens://checkin/{eventId}/{verificationCode}/{timestamp}');
      console.error('Received:', qrData);
      return null;
    }

    const result = {
      eventId: match[1],
      verificationCode: match[2],
      timestamp: parseInt(match[3], 10),
    };

    console.log('Successfully parsed QR code:', result);
    return result;
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return null;
  }
}

/**
 * Validate QR code age (optional - to prevent old QR codes)
 * Default: QR codes are valid for 24 hours
 */
export function isQRCodeValid(qrData: EventQRData, maxAgeHours: number = 24): boolean {
  const now = Date.now();
  const age = now - qrData.timestamp;
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
  
  return age <= maxAge;
}

/**
 * Generate a random verification code
 */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Download QR code as image
 */
export async function downloadQRCode(eventId: string, eventName: string): Promise<void> {
  try {
    const qrCodeDataUrl = await generateEventQRCode(eventId);
    
    // Create a temporary anchor element for download
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `suilens-event-${eventName.replace(/\s+/g, '-')}-qr.png`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading QR code:', error);
    throw new Error('Failed to download QR code');
  }
}
