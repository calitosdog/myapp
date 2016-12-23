// Library within node js
var fs = require('fs');
// Libraries download with npm install
var csv = require('csv');
var async = require('async');
var grunt = require('grunt');
// Library within node js
var stream = require('stream');
var readline = require('readline');
const DIRECTORY = './resources/filetree';

//function that receives the filename
//Key prov_com_sez && value lat log
function fileCompiler(filename, csvMap, callback) {
	grunt.log.writeln('on '+filename+' task started');
	var instream = fs.createReadStream(DIRECTORY+'/'+filename, {encoding:'utf8', bufferSize: 1, fd: null, flags: 'r'});
	var result = [];
	var outputname = filename.split('_');
	outputname = outputname[outputname.length-1];
	var outputPath = 'public/data/'+outputname.split('.')[0] + '.json';
	var rl = readline.createInterface(instream, new stream());
	rl.on('line', function (line) {
		try{
			var fields = line.split(' ');
			var sectionFields = fields[2].replace(/"/g,'').split('_');
			var csvElement = csvMap.get(fields[2].replace(/"/g,''));
			var lng ='';
			var lat = '';
			if(csvElement){
				lng = csvElement.lng;
				lat = csvElement.lat;
			}
			var res
			result.push({
				id: fields[0],
				value: Number(fields[1]),
				section: {
					prov: sectionFields[0],
					com: sectionFields[1],
					sez: sectionFields[2]
				},
				lng: lng,
				lat: lat
			});
		}catch(e){
			console.warn(e.stack);
		}
	})
	rl.on('close', function (){
		result.shift();

		var data = JSON.stringify(result);
		fs.writeFile(outputPath, data ,'utf8', (err) => {
			if (err) throw err;
			console.log('File Saved : '+outputPath);
			callback();
		});
	});
}

//register task
grunt.registerTask('compiler', 'converts file tree into json.', function() {
	grunt.log.writeln("task started");
	var done = this.async();
	fs.readdir(DIRECTORY, (err, files) => {
		console.log('files: '+require('util').inspect(files, { depth: null }));
		fs.readFile('resources/mobilita.csv','utf8', (err, data) => {
			if (err) return callback(err);
			csv.parse(data, function(err, csvData) {
				if (err) return callback(err);
				//Create Map
				const csvMap = new Map();
				async.forEach(csvData, function(csvElement, eachcb){
					var provincia = parseInt(csvElement[0]);
					var comune = parseInt(csvElement[1]);
					var sezione = parseInt(csvElement[2]);
					//Maps the Key with value
					csvMap.set(provincia+'_'+comune+'_'+sezione, {lng:csvElement[7], lat:csvElement[8]});
					eachcb();
				}, function(){
					async.forEach(files, function(filename, eachcb){
						fileCompiler(filename, csvMap, eachcb);
					}, done);
				});
			});
		});
	});
});

grunt.initConfig({
	fullCompile: {
		options: {
			treeDirectoryPath: './resources/filetree',
			geometryFile: './public/data/map/toscana_com2011_g.json',
			outputDirectory: './public/dataCompiled'
		}
	}
});

grunt.loadTasks('tasks');
