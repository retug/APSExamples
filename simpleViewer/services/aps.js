//Copied directly from Autodesk
// https://tutorials.autodesk.io/tutorials/simple-viewer/auth

const fs = require('fs');
const APS = require('forge-apis');
const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET } = require('../config.js');

//internal tokens
let internalAuthClient = new APS.AuthClientTwoLegged(APS_CLIENT_ID, APS_CLIENT_SECRET, ['bucket:read', 'bucket:create', 'data:read', 'data:write', 'data:create'], true);
//public tokens
let publicAuthClient = new APS.AuthClientTwoLegged(APS_CLIENT_ID, APS_CLIENT_SECRET, ['viewables:read'], true);

const service = module.exports = {};

service.getInternalToken = async () => {
    if (!internalAuthClient.isAuthorized()) {
        await internalAuthClient.authenticate();
    }
    return internalAuthClient.getCredentials();
};

service.getPublicToken = async () => {
    if (!publicAuthClient.isAuthorized()) {
        await publicAuthClient.authenticate();
    }
    return publicAuthClient.getCredentials();
};

//The ensureBucketExists function will simply try and request additional information about a specific bucket using the BucketsApi class from the APS SDK
//, and if the response from APS is 404 Not Found, it will attempt to create a new bucket with this name.

service.ensureBucketExists = async (bucketKey) => {
    try {
        await new APS.BucketsApi().getBucketDetails(bucketKey, null, await service.getInternalToken());
    } catch (err) {
        if (err.response.status === 404) {
            await new APS.BucketsApi().createBucket({ bucketKey, policyKey: 'persistent' }, {}, null, await service.getInternalToken());
        } else {
            throw err;
        }
    }
};

//As you can see, the getObjects method of the ObjectsApi class (responsible for listing files in a Data Management bucket) uses pagination. 
//In our code we simply iterate through all the pages and return all files from our application's bucket in a single list.

service.listObjects = async () => {
    await service.ensureBucketExists(APS_BUCKET);
    let resp = await new APS.ObjectsApi().getObjects(APS_BUCKET, { limit: 64 }, null, await service.getInternalToken());
    let objects = resp.body.items;
    while (resp.body.next) {
        const startAt = new URL(resp.body.next).searchParams.get('startAt');
        resp = await new APS.ObjectsApi().getObjects(APS_BUCKET, { limit: 64, startAt }, null, await service.getInternalToken());
        objects = objects.concat(resp.body.items);
    }
    return objects;
};

service.uploadObject = async (objectName, filePath) => {
    await service.ensureBucketExists(APS_BUCKET);
    const buffer = await fs.promises.readFile(filePath);
    const results = await new APS.ObjectsApi().uploadResources(
        APS_BUCKET,
        [{ objectKey: objectName, data: buffer }],
        { useAcceleration: false, minutesExpiration: 15 },
        null,
        await service.getInternalToken()
    );
    if (results[0].error) {
        throw results[0].completed;
    } else {
        return results[0].completed;
    }
};

//logic for converting designs for viewing, and for checking the status of the conversions.
//URN = Base64-encoded IDs
service.translateObject = async (urn, rootFilename) => {
    const job = {
        input: { urn },
        output: { formats: [{ type: 'svf', views: ['2d', '3d'] }] }
    };
    if (rootFilename) {
        job.input.compressedUrn = true;
        job.input.rootFilename = rootFilename;
    }
    const resp = await new APS.DerivativesApi().translate(job, {}, null, await service.getInternalToken());
    return resp.body;
};

service.getManifest = async (urn) => {
    try {
        const resp = await new APS.DerivativesApi().getManifest(urn, {}, null, await service.getInternalToken());
        return resp.body;
    } catch (err) {
        if (err.response.status === 404) {
            return null;
        } else {
            throw err;
        }
    }
};

service.urnify = (id) => Buffer.from(id).toString('base64').replace(/=/g, '');