exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // For now, return mock data to test if the function works
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

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                count: 1,
                aircraft: mockAircraft,
                timestamp: new Date().toISOString(),
                authenticated: true,
                message: 'Mock data - function is working!'
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}; 