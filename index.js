const Hapi=require('hapi');
const fs = require('fs');
const settings = require('./settings');
const mkdirp = require('mkdirp');
const fastXmlParser = require('fast-xml-parser');
const XLSX = require('xlsx');
const builder = require('xmlbuilder');
const path = require('path');
const crypto = require("crypto");
const formMatrix = require('./data/forms/downloads/formmatrix');
const uuidv1 = require('uuid/v1');
const md5 = require('md5');

const tls = {
    key: fs.readFileSync('./certificates/server-key.pem'),
    cert: fs.readFileSync('./certificates/server-cert.pem')
};

const server = new Hapi.Server();
server.connection( {
    host: '0.0.0.0',
    port: ~~process.env.PORT || 3000
} );


// Add the route
server.route({
    method:'GET',
    path:'/forms/formList',
    handler:function(request, reply) {

        let builderList  = builder.create('xforms')
            .att('xmlns', 'http://openrosa.org/xforms/xformsList');
        formMatrix.forEach(function(file, index, arr) {
                builderList.ele('xform')
                    .ele('formID', file.id).up()
                    .ele('name', file.name).up()
                    .ele('version', file.version).up()
                    .ele('hash', 'md5:' + file.hash).up()
                    .ele('downloadUrl', settings.formDownloadUrl + file.id).up()
                });
            let xml = builderList.end({ pretty: true});
                reply(xml).header('Content-Type', 'text/xml').header('X-OpenRosa-Version','1.0');
            }
});
server.route({
    method:'GET',
    path:'/forms/downloads',
    handler:function(request, reply) {
        let form_name = request.query.formId;
        fs.readFile(settings.formsDownload + '/' + form_name +'.xml',function (error, data) {
            if(error) return reply('File Doesnt Exist');
             reply(data).header('Content-disposition', 'attachment; filename=' + form_name +'.xml') ;
        });
    }
});
server.route({
    method: 'POST',
    path: '/forms/submission',
    config: {
        handler: function (request, reply) {
            if(!request.headers.authorization){
                console.log('No Auth ' + JSON.stringify(request.headers));
                 reply('formReceivedReply')
                     .header('X-OpenRosa-Version','1.0')
                     .header('Content-Type', 'text/xml')
                     .header('WWW-Authenticate',' Digest realm="frs.go.tz",qop="auth",nonce="' + uniqid()+ '",opaque="'+ md5('fsr.go.tz') + '"')
                     .code(401);
            }

            else if(request.headers.authorization){
                console.log('With Auth ' + JSON.stringify(request.headers));
                 reply('formReceivedReply').header('Content-Type', 'text/xml').header('X-OpenRosa-Version','1.0').code(202);
            }


            //console.log(request.payload.xml_submission_file);
            // const xmlData = request.payload.xml_submission_file._data;
            // let xmlDataString = xmlData.toString();
            // let jsonObj = fastXmlParser.parse(xmlDataString,settings.fastXmlOptions);
            //     //Get the ID of the form by key
            //     let formID = Object.keys(jsonObj)[0];
            //     let currentTime = new Date().toISOString().slice(0,10);
            //     let uuid = jsonObj[formID].meta.instanceID.split(':');
            //     let imageName = jsonObj[formID].image;
            //
            //     // Define  Directory Structure
            //     let dir = settings.dataDir + '/submissions/' + formID + '/' +  currentTime +'/' + uuid[1]+'/';
            //     let jsonDataFile = dir + 'data' + '.json';
            //     let xmlDataFile = dir + 'data' + '.xml';
            //
            //     // Create Directory if does'nt Exist
            //     mkdirp.sync(dir, function (err) {
            //         if (err) console.error(err);
            //         else console.log('Directory ' + dir + ' Created Successfully')
            //     });
            //
            // // Save XML Data
            // fs.writeFile(xmlDataFile, xmlDataString, function(err, xmlDataString){
            //     if (err) console.log(err);
            //     console.log("XML Successfully Written to File.");
            // });
            //
            // // Save Image to Directory
            //     if (request.payload[imageName]){
            //         let image = fs.createWriteStream(dir + imageName);
            //         image.on('error', (err) => console.error(err));
            //         request.payload[imageName].pipe(image);
            //         console.log("Image Successfully Saved to " + dir + imageName);
            //     }
            //     // Save JSON Data
            // fs.writeFile(jsonDataFile, JSON.stringify(jsonObj), function(err, jsonObj){
            //     if (err) console.log(err);
            //     console.log("JSON Successfully Written to File.");
            // });
            //
            //     let formReceivedReply = '<OpenRosaResponse xmlns="http://openrosa.org/http/response">' +
            //         '<message>Form Received! You\'ve submitted successfully forms today</message> </OpenRosaResponse>';


           // reply(formReceivedReply).header('Content-Type', 'text/xml').header('X-OpenRosa-Version','1.0').code(201);
           //  reply('formReceivedReply').header('Content-Type', 'text/xml').header('X-OpenRosa-Version','1.0').code(401);


        },
        payload: {
            output: 'stream',
            parse: true,
            maxBytes: 20000000 // 20 MB
        }
    }
});


server.start( err => {

    if( err ) {

        // Fancy error handling here
        console.error( 'Error was handled!' );
        console.error( err );
    }
    console.log( `Server started at ${ server.info.uri }` );
} );