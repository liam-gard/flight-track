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

    const envInfo = {
        hasUsername: !!process.env.OPENSKY_USERNAME,
        hasPassword: !!process.env.OPENSKY_PASSWORD,
        usernameLength: process.env.OPENSKY_USERNAME ? process.env.OPENSKY_USERNAME.length : 0,
        passwordLength: process.env.OPENSKY_PASSWORD ? process.env.OPENSKY_PASSWORD.length : 0,
        usernameStart: process.env.OPENSKY_USERNAME ? process.env.OPENSKY_USERNAME.substring(0, 3) + '...' : 'not set',
        allEnvKeys: Object.keys(process.env).filter(key => key.includes('OPENSKY')),
        timestamp: new Date().toISOString()
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(envInfo, null, 2)
    };
}; 