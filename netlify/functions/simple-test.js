exports.handler = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            success: true,
            count: 1,
            aircraft: [{
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
                route: { from: 'SIMPLE TEST', to: 'WORKING' },
                squawk: '2000'
            }],
            timestamp: new Date().toISOString(),
            authenticated: true,
            message: 'Simple function working - no dependencies!'
        })
    };
}; 