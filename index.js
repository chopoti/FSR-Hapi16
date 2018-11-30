const Hapi = require('hapi');
const fs = require('fs');
const settings = require('./settings');
const encrypdecrypt = require('./encryp-decypt');
const mkdirp = require('mkdirp');
const fastXmlParser = require('fast-xml-parser');
const builder = require('xmlbuilder');
const crypto = require("crypto");
const formMatrix = require('./data/forms/downloads/formmatrix');
const uuidv1 = require('uuid/v1');
const md5 = require('md5');

const tls = {
    key: fs.readFileSync('./certificates/server-key.pem'),
    cert: fs.readFileSync('./certificates/server-cert.pem')
};
//for herouku and local
    // host: '0.0.0.0',
    // port: ~~process.env.PORT || 3000

const server = new Hapi.Server();
server.connection({
    //for OpenShif and Local
    host: process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    port: process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080
});


// Add the route
server.route({
    method: 'GET',
    path: '/forms/formList',
    handler: function (request, reply) {

        let builderList = builder.create('xforms')
            .att('xmlns', 'http://openrosa.org/xforms/xformsList');
        formMatrix.forEach(function (file, index, arr) {
            builderList.ele('xform')
                .ele('formID', file.id).up()
                .ele('name', file.name).up()
                .ele('version', file.version).up()
                .ele('hash', 'md5:' + file.hash).up()
                .ele('downloadUrl', settings.formDownloadUrl + file.id).up()
        });
        let xml = builderList.end({pretty: true});
        reply(xml).header('Content-Type', 'text/xml').header('X-OpenRosa-Version', '1.0');
    }
});
server.route({
    method: 'GET',
    path: '/forms/downloads',
    handler: function (request, reply) {
        let form_name = request.query.formId;
        fs.readFile(settings.formsDownload + '/' + form_name + '.xml', function (error, data) {
            if (error) return reply('File Doesnt Exist');
            reply(data).header('Content-disposition', 'attachment; filename=' + form_name + '.xml');
        });
    }
});
server.route({
    method: 'POST',
    path: '/forms/submission',
    config: {
        handler: function (request, reply) {
            if (!request.headers.authorization) {
                reply('formReceivedReply')
                    .header('X-OpenRosa-Version', '1.0')
                    .header('Content-Type', 'text/xml')
                    .header('WWW-Authenticate', 'Digest realm=frs-app,qop=auth,nonce=' + uuidv1() + ',opaque=' + md5('fsr-app') + '"')
                    .code(401);
            }
            else if (request.headers.authorization) {
                //Get authorization contents
                let digestAuth = request.headers.authorization;
                //Remove auth type (Digest) before username
                let digestAuthArray = digestAuth.substring(digestAuth.indexOf('u'));
                // Remove all spaces between strings
                let digestWithoutSpace = digestAuthArray.replace(/\s/g, '');
                //Convert string to Array
                let digestArray = digestWithoutSpace.split(',');
                // Get Username from Digest Array
                let username = digestArray[0].match(/"(.*?)"/)[1];

                // we will store user password in hash format to our database (hashed like below and saved to database
                let hashedPassword = encrypdecrypt.encrypt('12345');
                // we will decrypt user hashed password from database by passing to decryp method and plain text we have we will use to calculate HA1
                let plainTextPassword = encrypdecrypt.decrypt(hashedPassword);

                let realm = digestArray[1].match(/"(.*?)"/)[1];
                let uri = 'POST:' + digestArray[3].match(/"(.*?)"/)[1];
                let nonce = digestArray[2].match(/"(.*?)"/)[1];
                let collectResponse = digestArray[4].match(/"(.*?)"/)[1];
                let nc = digestArray[6].split('=')[1];
                let cnonce = digestArray[7].match(/"(.*?)"/)[1];
                let qop = digestArray[5].split('=')[1];

                let HA1 = crypto.createHash('md5').update(username + ':' + realm + ':' + plainTextPassword).digest("hex");
                let HA2 = crypto.createHash('md5').update(uri).digest("hex");
                let serverCalcResponse = crypto.createHash('md5')
                    .update(HA1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + HA2)
                    .digest("hex");

                if (serverCalcResponse !== collectResponse) {
                    return reply('formReceivedReply')
                        .header('X-OpenRosa-Version', '1.0')
                        .header('Content-Type', 'text/xml')
                        .header('WWW-Authenticate', 'Digest realm=frs-app,qop=auth,nonce=' + uuidv1() + ',opaque=' + md5('fsr-app') + '"')
                        .code(401);
                }

               // console.log(request.payload);
                const xmlData = request.payload.xml_submission_file._data;
                let xmlDataString = xmlData.toString();
                let jsonObj = fastXmlParser.parse(xmlDataString, settings.fastXmlOptions);
                //Get the ID of the form by key
                let formID = Object.keys(jsonObj)[0];
                let currentTime = new Date().toISOString().slice(0, 10);
                let uuid = jsonObj[formID].meta.instanceID.split(':');
                let imageName = jsonObj[formID].image;

                // Define  Directory Structure
                let dir = settings.dataDir + '/submissions/' + formID + '/' + currentTime + '/' + uuid[1] + '/';
                let jsonDataFile = dir + 'data' + '.json';
                let xmlDataFile = dir + 'data' + '.xml';

                // Create Directory if does'nt Exist
                mkdirp.sync(dir, function (err) {
                    if (err) console.error(err);
                    else console.log('Directory ' + dir + ' Created Successfully')
                });

                // Save XML Data
                fs.writeFile(xmlDataFile, xmlDataString, function (err, xmlDataString) {
                    if (err) console.log(err);
                    console.log("XML Successfully Written to File.");
                });

                // Save Image to Directory
                if (request.payload[imageName]) {
                    let image = fs.createWriteStream(dir + imageName);
                    image.on('error', (err) => console.error(err));
                    request.payload[imageName].pipe(image);
                    console.log("Image Successfully Saved to " + dir + imageName);
                }
                // Save JSON Data
                fs.writeFile(jsonDataFile, JSON.stringify(jsonObj), function (err, jsonObj) {
                    if (err) console.log(err);
                    console.log("JSON Successfully Written to File.");
                });

                let formReceivedReply = '<OpenRosaResponse xmlns="http://openrosa.org/http/response">' +
                    '<message>Form Received! You\'ve submitted successfully forms today</message> </OpenRosaResponse>';
                reply(formReceivedReply).header('Content-Type', 'text/xml').header('X-OpenRosa-Version', '1.0').code(201);
            }
        },
        payload: {
            output: 'stream',
            parse: true,
            maxBytes: 20000000 // 20 MB
        }
    }
});


server.start(err => {

    if (err) {

        // Fancy error handling here
        console.error('Error was handled!');
        console.error(err);
    }
    console.log(`Server started at ${ server.info.uri }`);
});