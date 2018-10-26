const he = require('he');
module.exports = {
    name: 'Form Aggregator',
    description: 'ODK Collect Form Processor',
    port: 3000,
    dataDir: __dirname + '/data',
    formsDownload: __dirname + '/data/forms/downloads',
    formDownloadUrl: 'http://192.168.43.119:3000/forms/downloads?formId=',
    fastXmlOptions : {
        attributeNamePrefix : "@_",
        attrNodeName: "attr", //default is 'false'
        textNodeName : "#text",
        ignoreAttributes : true,
        ignoreNameSpace : false,
        allowBooleanAttributes : false,
        parseNodeValue : true,
        parseAttributeValue : false,
        trimValues: true,
        cdataTagName: "__cdata", //default is 'false'
        cdataPositionChar: "\\c",
        localeRange: "", //To support non english character in tag/attribute values.
        parseTrueNumberOnly: false,
        attrValueProcessor: a => he.decode(a, {isAttributeValue: true}),//default is a=>a
        tagValueProcessor : a => he.decode(a) //default is a=>a
    }
};
