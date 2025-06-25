// Vercel serverless function
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Mock data for now
        const mockAircraft = [{
            icao24: 'test123',
            callsign: 'TEST001',
            origin_country: 'Australia',
            latitude: -33.919,
            longitude: 151.249,
            altitude_ft: 35000,
            speed_kts: 450,
            true_track: 90,
            distance: 2.5,
            phase: 'CRUISE',
            route: { from: 'MELBOURNE', to: 'SYDNEY' },
            squawk: '2000'
        }];

        res.status(200).json({
            success: true,
            count: 1,
            aircraft: mockAircraft,
            timestamp: new Date().toISOString(),
            authenticated: true,
            message: 'Vercel function working!'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
} 