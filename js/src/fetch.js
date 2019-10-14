/*global DOMParser HPA Dexie fetch FileReader*/
(function (glob) {
    "use strict";

    const db = new Dexie("url_database");
    db.version(1).stores({
        urls: '&url,text'
    });

    const grab_blob_text = function (url) {
        //first check to see if this is already here
        // console.log('here we go...');
        return db.urls.get(url).then(function (obj) {
            const now = new Date() * 1;
            if (obj && obj.hasOwnProperty("text") && obj.date && now - obj.date > 1000 * 60 * 60 * 24 * 14) {
                // update every 14 days
                return obj.text;
            }

            // console.log(obj.date, now, (now - obj.date) / 1000);

            // no result so it will go grab it again
            return fetch(url).then((res) => res.blob()).then(function (blob) {
                return new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsText(blob);
                });
            }).then(function (text) {
                //store in dexie
                return db.urls.put({
                    url: url,
                    text: text,
                    date: now
                }).then(function () {
                    return text;
                });
            });

        });
    };

    const grab_xml = function (url) {
        return db.urls.get(url).then(function (obj) {
            if (obj && obj.hasOwnProperty("text")) {
                return obj.text;
            }

            // no result so it will go grab it again
            return fetch(url).then((res) => res.blob()).then(function (blob) {
                return new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsText(blob);
                });
            }).then(function (text) {
                var parser = new DOMParser();
                return parser.parseFromString(text, "text/xml");
            }).then(function (xml) {
                return JSON.parse(xml2json(xml, ""));
            }).then(function (obj) {
                //store in dexie

                /* format -> NOTE: If an array has one entry it is rendered as a single object
                     [
                        proteinatlas: {
                            entry: {
                                //Series of options including
                                antibody: {
                                    // Series of options
                                    tissue expression: [
                                            //series of options
                                            {
                                                @assayType: "pathology"
                                                data: [
                                                    //numerous cancers
                                                    patient: // [list of patients]
                                                    tissue: "breast cancer"
                                                    tissueCell: {
                                                        cellType: "tumor cells"
                                                        level: [
                                                            {@type: "staining", @count: 3, #text: "low" },
                                                            // ... (If only one then this is not an array)
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                }
                            }
                        }
                     ]

                */
                return db.urls.put({
                    url: url,
                    text: obj
                }).then(function () {
                    return obj;
                });
            });

        });
    };

    const fetch_all = function () {
        // console.log("here...");
        return grab_blob_text('https://www.proteinatlas.org/search/%20?format=tsv&compress=no');
    };

    glob.get = function (parameters) {
        if (!parameters) {
            return fetch_all();
        }
        if (parameters && parameters.ensembl) {
            return grab_xml("https://www.proteinatlas.org/" + parameters.ensembl + ".xml");
        }
        return Promise.resolve(parameters);
    };

}(HPA));



// fetch('http://www.proteinatlas.org/ENSG00000134057.xml').then(function (res) {
//     return res.text();
// }).then(function (text) {
//     parser = new DOMParser();
//     xmlDoc = parser.parseFromString(text,"text/xml");
//     console.log('one entry To', xmlToJson(xmlDoc, ""));
//     //console.log('one entry 2', JSON.parse(xml2json(xmlDoc, "")));
// });


//fetch('https://www.proteinatlas.org/search/4057?format=xml').then(function (res) {
// fetch('https://www.proteinatlas.org/search/%20?format=tsv&compress=no').then(function (res) {
//     console.log("sent query");
//     return res.blob();
// }).then(function (blob) {
//     console.log("got blob");
//     return new Promise(function (resolve, reject) {
//         var reader = new FileReader();
//         reader.onload = function (e) {
//             resolve(reader.result);
//         };
//         reader.readAsText(blob);
//     });
// }).then(function (text) {
//     console.log("got text", text.split('\n').filter((x) => !x.match(/^\s*$/)).map((x) => x.split('\t')));
//     return;
//     parser = new DOMParser();
//     xmlDoc = parser.parseFromString(text, "text/xml");
//     console.log('many entries To', xmlToJson(xmlDoc, ""));
//     //console.log('many entries 2', JSON.parse(xml2json(xmlDoc, "")));
// });

// fetch('https://www.proteinatlas.org/search/?format=xml&compress=no', {
//     method: "GET", // *GET, POST, PUT, DELETE, etc.
//     mode: "cors", // no-cors, cors, *same-origin
//     cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
//     credentials: "include", // include, *same-origin, omit
//     headers: {
//         "Content-Type": "application/octet-stream"
//     },
//     redirect: "manual", // manual, *follow, error
//     referrer: "no-referrer", // no-referrer, *client
// }).then(function (res) {
//     console.log("sent query");
//     return res.blob();
// }).then(function (blob) {
//     console.log("got blob");
//     return new Promise(function (resolve, reject) {
//         var reader = new FileReader();
//         reader.onload = function (e) {
//             resolve(reader.result);
//         };
//         reader.readAsText(blob);
//     });
// }).then(function (text) {
//     console.log("got text", text.split('\n').map((x) => x.split('\t')));
// });


