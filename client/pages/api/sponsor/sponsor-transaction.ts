// pages/api/sponsor/sponsor-transaction.js

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        message: 'Enoki sponsor service running',
      });
    }

    if (req.method === 'POST') {
      const { sponsorData } = req.body;

      if (!sponsorData) {
        return res.status(400).json({ error: 'Missing sponsorData in request body' });
      }

      // TODO: Add your logic for sponsor transaction here
      // Example:
      // const result = await processSponsorTransaction(sponsorData);

      return res.status(200).json({
        status: 'success',
        message: 'Sponsor transaction processed successfully',
        data: sponsorData,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Sponsor Transaction Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
