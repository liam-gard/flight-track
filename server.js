const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow your website to call this server
app.use(cors());
app.use(express.static('.'));

// Get user location from request or default to Coogee
function getBounds(req) {
    const lat = parseFloat(req.query.lat) || -33.9185; // Default to Coogee
    const lon = parseFloat(req.query.lon) || 151.2532;
    const range = parseFloat(req.query.range) || 0.1; // 0.1 degrees ≈ 11km
    
    return {
        lamin: lat - range,
        lamax: lat + range,
        lomin: lon - range,
        lomax: lon + range,
        centerLat: lat,
        centerLon: lon
    };
}

// API endpoint that your website will call
app.get('/api/aircraft', async (req, res) => {
    try {
        console.log('🛩️ Fetching aircraft data...');
        
        const bounds = getBounds(req);
        
        // Build the OpenSky API URL
        const boundParams = `lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;
        const url = `https://opensky-network.org/api/states/all?${boundParams}`;
        
        console.log(`📡 Calling OpenSky API: ${url}`);
        
        // Call OpenSky API (temporarily without auth to test)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Aircraft-Tracker/1.0'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication failed - check OpenSky credentials');
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded - try again later');
            } else {
                throw new Error(`OpenSky API error: ${response.status} - ${response.statusText}`);
            }
        }

        const data = await response.json();
        console.log(`📊 Raw API response: ${data.states ? data.states.length : 0} aircraft states received`);
        
        // Process the raw data into something easier to use
        const aircraft = [];
        if (data.states && data.states.length > 0) {
            data.states.forEach(state => {
                // OpenSky returns arrays, convert to objects
                const plane = {
                    icao24: state[0],           // Unique aircraft ID
                    callsign: state[1]?.trim(), // Flight number (e.g., "QFA123")
                    origin_country: state[2],   // Country
                    time_position: state[3],    // Last position update
                    last_contact: state[4],     // Last contact time
                    longitude: state[5],        // GPS longitude
                    latitude: state[6],         // GPS latitude
                    baro_altitude: state[7],    // Altitude (meters)
                    on_ground: state[8],        // True if on ground
                    velocity: state[9],         // Speed (m/s)
                    true_track: state[10],      // Heading (degrees)
                    vertical_rate: state[11],   // Climb/descent rate
                    sensors: state[12],         // Sensor IDs
                    geo_altitude: state[13],    // GPS altitude
                    squawk: state[14],          // Transponder code
                    spi: state[15],             // Special indicator
                    position_source: state[16]  // Position source type
                };

                // Calculate distance from center point
                if (plane.latitude && plane.longitude) {
                    plane.distance = calculateDistance(bounds.centerLat, bounds.centerLon, plane.latitude, plane.longitude);
                    plane.altitude_ft = plane.baro_altitude ? Math.round(plane.baro_altitude * 3.28084) : null;
                    plane.speed_kts = plane.velocity ? Math.round(plane.velocity * 1.94384) : null;
                    
                    // Add flight phase
                    plane.phase = getFlightPhase(plane);
                    
                    // Skip landed aircraft
                    if (plane.phase === 'LANDED') {
                        return; // Skip this aircraft
                    }
                    
                    // Add route inference
                    plane.route = inferRoute(plane);
                    
                    aircraft.push(plane);
                }
            });
            
            // Sort by distance (closest first)
            aircraft.sort((a, b) => a.distance - b.distance);
        }

        console.log(`✈️ Found ${aircraft.length} aircraft in range`);
        
        res.json({ 
            success: true, 
            count: aircraft.length,
            aircraft: aircraft,
            timestamp: new Date().toISOString(),
            bounds: bounds,
            authenticated: true
        });

    } catch (error) {
        console.error('❌ Error fetching aircraft:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
}

// Determine flight phase
function getFlightPhase(plane) {
    if (plane.on_ground) {
        // If on ground and very low speed, it's landed
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

// Infer route information
function inferRoute(plane) {
    const callsign = (plane.callsign || '').toUpperCase();
    
    // International flights - major origins to Sydney
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
    }
    
    // Domestic Australian flights
    else if (callsign.startsWith('QFA')) {
        // Qantas domestic routes
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
    }
    
    // Based on origin country for other international flights
    else if (plane.origin_country === 'New Zealand') {
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        authenticated: !!(process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD)
    });
});

// Serve your main HTML file
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
    console.log(`🚀 Aircraft Tracker running at http://localhost:${PORT}`);
    console.log('🛩️ OpenSky API integration ready!');
    console.log(`🔐 Authentication: ${process.env.OPENSKY_USERNAME ? 'ENABLED' : 'DISABLED'}`);
}); 