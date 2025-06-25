const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// Your OpenSky credentials (keep this file private!)
const OPENSKY_USERNAME = 'liam-g';  // Your actual OpenSky username (not client ID)
const OPENSKY_PASSWORD = 'Poopoo1412';  // Add your OpenSky account password here

app.use(cors());
app.use(express.json());

// Test authentication on startup
async function testAuth() {
    if (!OPENSKY_USERNAME || !OPENSKY_PASSWORD || OPENSKY_PASSWORD === '') {
        console.log('⚠️  No credentials provided - will use anonymous access');
        console.log(`Debug: USERNAME="${OPENSKY_USERNAME}", PASSWORD="${OPENSKY_PASSWORD}"`);
        return false;
    }

    try {
        console.log('🔄 Testing OpenSky authentication...');
        
        // Test with a small bounding box
        const testUrl = 'https://opensky-network.org/api/states/all?lamin=40&lomin=-74&lamax=41&lomax=-73';
        
        const response = await fetch(testUrl, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64'),
                'User-Agent': 'Aircraft-Tracker-Proxy/1.0'
            }
        });

        if (response.ok) {
            console.log('✅ OpenSky authentication successful!');
            return true;
        } else {
            console.log(`❌ Authentication failed: ${response.status} - ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Auth test error:', error.message);
        return false;
    }
}

// Proxy endpoint for OpenSky API
app.get('/api/aircraft', async (req, res) => {
    try {
        const { lamin, lomin, lamax, lomax } = req.query;
        
        const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
        
        let response;
        let authMethod = 'Anonymous';
        
        // Try authenticated request if credentials are provided
        if (OPENSKY_USERNAME && OPENSKY_PASSWORD && OPENSKY_PASSWORD !== '') {
            console.log('🔐 Making authenticated request...');
            response = await fetch(url, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64'),
                    'User-Agent': 'Aircraft-Tracker-Proxy/1.0'
                }
            });
            authMethod = 'Basic Auth';
        } else {
            // Anonymous request
            console.log('🔓 Making anonymous request...');
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Aircraft-Tracker-Proxy/1.0'
                }
            });
        }
        
        // If authenticated request fails with 401, try anonymous
        if (response.status === 401 && OPENSKY_USERNAME && OPENSKY_PASSWORD && OPENSKY_PASSWORD !== '') {
            console.log('🔓 Auth failed, trying anonymous request...');
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Aircraft-Tracker-Proxy/1.0'
                }
            });
            authMethod = 'Anonymous (fallback)';
        }
        
        if (!response.ok) {
            throw new Error(`OpenSky API error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Add metadata about the request
        const responseData = {
            ...data,
            _metadata: {
                authenticated: authMethod.includes('Basic Auth'),
                authMethod: authMethod,
                timestamp: new Date().toISOString(),
                rateLimit: response.headers.get('x-rate-limit-remaining') || 'unknown',
                status: response.status
            }
        };
        
        console.log(`✅ Request successful (${authMethod})`);
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Proxy error:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'running',
        timestamp: new Date().toISOString(),
        username: OPENSKY_USERNAME || 'anonymous',
        hasCredentials: !!(OPENSKY_USERNAME && OPENSKY_PASSWORD)
    });
});

app.listen(PORT, async () => {
    console.log(`🚀 Aircraft tracking proxy running on http://localhost:${PORT}`);
    console.log('📡 Using OpenSky Network REST API');
    
    if (OPENSKY_USERNAME && OPENSKY_PASSWORD && OPENSKY_PASSWORD !== '') {
        await testAuth();
    } else {
        console.log('⚠️  No credentials - add your OpenSky username and password for authenticated access');
        console.log('📖 Your OpenSky username should be: liam-g');
        console.log('🔑 Add your OpenSky account password to line 10');
        console.log(`Debug: USERNAME="${OPENSKY_USERNAME}", PASSWORD="${OPENSKY_PASSWORD}"`);
    }
}); 