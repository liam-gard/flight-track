// Use native fetch in Node.js 18+ or require node-fetch
const fetch = globalThis.fetch || require('node-fetch');

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get location from query parameters
        const { lat, lon } = event.queryStringParameters || {};
        
        if (!lat || !lon) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing lat/lon parameters' })
            };
        }

        const bounds = getBounds(parseFloat(lat), parseFloat(lon));
        
        // OpenSky API credentials from environment variables
        const username = process.env.OPENSKY_USERNAME || 'liam-g';
        const password = process.env.OPENSKY_PASSWORD || 'Poopoo1412';
        
        if (!username || !password) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'OpenSky credentials not configured' })
            };
        }

        const apiUrl = `https://opensky-network.org/api/states/all?lamin=${bounds.minLat}&lomin=${bounds.minLon}&lamax=${bounds.maxLat}&lomax=${bounds.maxLon}`;
        
        console.log(`📡 Calling OpenSky API: ${apiUrl}`);
        
        let response;
        
        // Try authenticated request first
        try {
            const auth = Buffer.from(`${username}:${password}`).toString('base64');
            response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'User-Agent': 'Aircraft-Tracker/1.0'
                },
                timeout: 10000
            });
            
            if (response.status === 401) {
                console.log('⚠️ Authentication failed, trying unauthenticated request...');
                throw new Error('Auth failed');
            }
        } catch (authError) {
            // Fallback to unauthenticated request
            console.log('📡 Using unauthenticated API request...');
            response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Aircraft-Tracker/1.0'
                },
                timeout: 10000
            });
        }

        if (response.status === 429) {
            throw new Error('Rate limit exceeded - try again later');
        }

        if (!response.ok) {
            throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📊 Raw API response: ${data.states ? data.states.length : 0} aircraft states received`);
        
        // Process the raw data
        const aircraft = [];
        if (data.states && data.states.length > 0) {
            data.states.forEach(state => {
                const plane = {
                    icao24: state[0],
                    callsign: state[1]?.trim(),
                    origin_country: state[2],
                    time_position: state[3],
                    last_contact: state[4],
                    longitude: state[5],
                    latitude: state[6],
                    baro_altitude: state[7],
                    on_ground: state[8],
                    velocity: state[9],
                    true_track: state[10],
                    vertical_rate: state[11],
                    sensors: state[12],
                    geo_altitude: state[13],
                    squawk: state[14],
                    spi: state[15],
                    position_source: state[16]
                };

                if (plane.latitude && plane.longitude) {
                    plane.distance = calculateDistance(bounds.centerLat, bounds.centerLon, plane.latitude, plane.longitude);
                    plane.altitude_ft = plane.baro_altitude ? Math.round(plane.baro_altitude * 3.28084) : null;
                    plane.speed_kts = plane.velocity ? Math.round(plane.velocity * 1.94384) : null;
                    
                    plane.phase = getFlightPhase(plane);
                    
                    // Skip landed aircraft
                    if (plane.phase === 'LANDED') {
                        return;
                    }
                    
                    plane.route = inferRoute(plane);
                    aircraft.push(plane);
                }
            });
            
            aircraft.sort((a, b) => a.distance - b.distance);
        }

        console.log(`✈️ Found ${aircraft.length} aircraft in range`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                count: aircraft.length,
                aircraft: aircraft,
                timestamp: new Date().toISOString(),
                bounds: bounds,
                authenticated: true
            })
        };

    } catch (error) {
        console.error('❌ Error fetching aircraft:', error);
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

function getBounds(lat, lon) {
    const range = 0.045; // ~5km radius
    return {
        centerLat: lat,
        centerLon: lon,
        minLat: lat - range,
        maxLat: lat + range,
        minLon: lon - range,
        maxLon: lon + range
    };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
}

function getFlightPhase(plane) {
    if (plane.on_ground) {
        if (!plane.velocity || plane.velocity < 5) {
            return 'LANDED';
        }
        return 'ON GROUND';
    }
    if (plane.vertical_rate > 256) return 'CLIMBING';
    if (plane.vertical_rate < -256) return 'DESCENDING';
    if (plane.baro_altitude && plane.baro_altitude < 1000) return 'LOW LEVEL';
    return 'CRUISE';
}

function inferRoute(plane) {
    const callsign = (plane.callsign || '').toUpperCase();
    
    if (callsign.startsWith('UAL')) {
        return { from: 'LOS ANGELES', to: 'SYDNEY' };
    } else if (callsign.startsWith('SIA')) {
        return { from: 'SINGAPORE', to: 'SYDNEY' };
    } else if (callsign.startsWith('EK')) {
        return { from: 'DUBAI', to: 'SYDNEY' };
    } else if (callsign.startsWith('QTR')) {
        return { from: 'DOHA', to: 'SYDNEY' };
    } else if (callsign.startsWith('CX') || callsign.startsWith('CPA')) {
        return { from: 'HONG KONG', to: 'SYDNEY' };
    } else if (callsign.startsWith('THA')) {
        return { from: 'BANGKOK', to: 'SYDNEY' };
    } else if (callsign.startsWith('ANA') || callsign.startsWith('JAL')) {
        return { from: 'TOKYO', to: 'SYDNEY' };
    } else if (callsign.startsWith('CSN')) {
        return { from: 'GUANGZHOU', to: 'SYDNEY' };
    } else if (callsign.startsWith('CES')) {
        return { from: 'SHANGHAI', to: 'SYDNEY' };
    } else if (callsign.startsWith('AAR')) {
        return { from: 'AUCKLAND', to: 'SYDNEY' };
    } else if (callsign.startsWith('FJ')) {
        return { from: 'NADI', to: 'SYDNEY' };
    } else if (callsign.startsWith('VA')) {
        return { from: 'VANCOUVER', to: 'SYDNEY' };
    } else if (callsign.startsWith('LAX')) {
        return { from: 'LOS ANGELES', to: 'SYDNEY' };
    } else if (callsign.startsWith('QFA')) {
        if (callsign.includes('1') || callsign.includes('2')) {
            return { from: 'MELBOURNE', to: 'SYDNEY' };
        } else if (callsign.includes('5') || callsign.includes('6')) {
            return { from: 'BRISBANE', to: 'SYDNEY' };
        } else if (callsign.includes('7') || callsign.includes('8')) {
            return { from: 'PERTH', to: 'SYDNEY' };
        } else if (callsign.includes('9')) {
            return { from: 'ADELAIDE', to: 'SYDNEY' };
        } else {
            return { from: 'MELBOURNE', to: 'SYDNEY' };
        }
    } else if (callsign.startsWith('JST')) {
        return { from: 'MELBOURNE', to: 'SYDNEY' };
    } else if (callsign.startsWith('VOZ')) {
        return { from: 'MELBOURNE', to: 'SYDNEY' };
    } else if (callsign.startsWith('TGW')) {
        return { from: 'MELBOURNE', to: 'SYDNEY' };
    } else if (plane.origin_country === 'New Zealand') {
        return { from: 'AUCKLAND', to: 'SYDNEY' };
    } else if (plane.origin_country === 'United States') {
        return { from: 'LOS ANGELES', to: 'SYDNEY' };
    } else if (plane.origin_country === 'United Kingdom') {
        return { from: 'LONDON', to: 'SYDNEY' };
    } else if (plane.origin_country === 'Japan') {
        return { from: 'TOKYO', to: 'SYDNEY' };
    } else if (plane.origin_country === 'China') {
        return { from: 'BEIJING', to: 'SYDNEY' };
    } else if (plane.origin_country === 'Singapore') {
        return { from: 'SINGAPORE', to: 'SYDNEY' };
    } else if (plane.origin_country === 'Thailand') {
        return { from: 'BANGKOK', to: 'SYDNEY' };
    } else if (plane.origin_country === 'Indonesia') {
        return { from: 'JAKARTA', to: 'SYDNEY' };
    } else if (plane.origin_country === 'Malaysia') {
        return { from: 'KUALA LUMPUR', to: 'SYDNEY' };
    } else if (plane.origin_country === 'Canada') {
        return { from: 'VANCOUVER', to: 'SYDNEY' };
    } else if (plane.origin_country === 'India') {
        return { from: 'DELHI', to: 'SYDNEY' };
    } else if (plane.origin_country === 'United Arab Emirates') {
        return { from: 'DUBAI', to: 'SYDNEY' };
    } else if (plane.origin_country === 'Qatar') {
        return { from: 'DOHA', to: 'SYDNEY' };
    } else if (plane.origin_country && plane.origin_country !== 'Australia') {
        return { from: plane.origin_country.toUpperCase(), to: 'SYDNEY' };
    } else {
        return { from: 'MELBOURNE', to: 'SYDNEY' };
    }
} 