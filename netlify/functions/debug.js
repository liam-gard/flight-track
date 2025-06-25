exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    // Return data in the format the frontend expects
    const mockAircraft = [{
        icao24: 'debug01',
        callsign: 'DEBUG001',
        origin_country: 'Australia',
        latitude: -33.919,
        longitude: 151.249,
        altitude_ft: 35000,
        speed_kts: 450,
        true_track: 90,
        distance: 2.5,
        phase: 'CRUISE',
        route: { from: 'DEBUG MODE', to: 'TESTING' },
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
            debug: {
                message: 'Debug function working!',
                event: {
                    httpMethod: event.httpMethod,
                    path: event.path,
                    queryStringParameters: event.queryStringParameters
                },
                env: {
                    NODE_VERSION: process.env.NODE_VERSION,
                    OPENSKY_USERNAME: process.env.OPENSKY_USERNAME ? 'SET' : 'NOT SET',
                    OPENSKY_PASSWORD: process.env.OPENSKY_PASSWORD ? 'SET' : 'NOT SET'
                }
            }
        })
    };
}; 