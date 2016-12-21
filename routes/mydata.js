var express = require('express');
var fs = require('fs');
var csv = require('csv');
var async = require('async');
var router = express.Router();

router.get('/test', function(req, res, next) {
    //lettura file csv
    fs.readFile('resources/mobilita.csv','utf8', (err, data) => {
        if (err) throw err;
        csv.parse(data, function(err, data) {
            res.json({ 'result': data  });
        })
    });
});

router.get('/testTree', function(req, res, next) {
    var result = [];
    var filename = req.query.filename;
    if(!filename){
        return next(new Error('filename not found'));
    }
    var outputPath = 'resources/converted/'+filename.split('.')[0] + '.json';
    async.parallel({
        tree: function(callback){
            var stream = fs.createReadStream('resources/'+filename, {encoding:'utf8', bufferSize: 1, fd: null, flags: 'r'});
            var line='';
            stream.addListener('readable', function () {
                var chunk;
                while(null !== (chunk = stream.read(1))) {
                    if(/\n|\r(?!\n)|\u2028|\u2029|\r\n/.test(chunk)){
                        try{
                            var fields = line.split(' ');
                            var sectionFields = fields[2].replace(/"/g,'').split('_');
                            var idFields =
                            result.push({
                                id: fields[0],
                                value: fields[1],
                                section: {
                                    prov: sectionFields[0],
                                    com: sectionFields[1],
                                    sez: sectionFields[2]
                                }
                            });
                        }catch(e){
                            console.warn(e);
                        }
                        line = '';
                    }else {
                        line += chunk;
                    }
                }
            })
            stream.addListener('end', function (){
                result.shift();

                callback(null, result);
            })
        },
        csv: function(callback) {
            fs.readFile('resources/mobilita.csv','utf8', (err, data) => {
                if (err) return callback(err);
                csv.parse(data, function(err, data) {
                    if (err) return callback(err);
                    callback(null, data);
                })
            });
        }
    }, function(err, results) {
        //results is now equals to: {one:1, two: 2}
        var converted = [];
        results.tree.forEach(function(treeElement){
            var csvElement = results.csv.find(function(csvElement){
                var provincia = parseInt(csvElement[0]);
                var comune = parseInt(csvElement[1]);
                var sezione = parseInt(csvElement[2]);
                return treeElement.section.prov == provincia
                    && treeElement.section.com == comune
                    && treeElement.section.sez == sezione;
            });
            if(csvElement){
                converted.push({
                    id:treeElement.id ,
                    value:Number(treeElement.value),
                    section: treeElement.section,
                    lng: csvElement[7],
                    lat: csvElement[8],
                });
            }else{
                console.warn('treeNotFound');
            }
        });
        var data = JSON.stringify(converted)
        fs.writeFile(outputPath, data ,'utf8', (err) => {
            if (err) throw err;
            console.log('File Saved');
        })
        res.render('test', {'result': converted });
    });
});

module.exports = router;
