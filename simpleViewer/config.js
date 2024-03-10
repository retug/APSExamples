require('dotenv').config();

let { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET, PORT } = process.env;
//Checks if APS_CLIENT_ID AND SECRET ARE PRESENT, if not warning.
if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    console.warn('Missing some of the environment variables.');
    process.exit(1);
}

APS_BUCKET = APS_BUCKET || `${APS_CLIENT_ID.toLowerCase()}-basic-app`;
//Port defulat to 8080 if not specified
PORT = PORT || 8080;

module.exports = {
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    APS_BUCKET,
    PORT
};