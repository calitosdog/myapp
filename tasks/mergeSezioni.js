'use strict';

// Library within node js
const fs = require('fs');
const stream = require('stream');
const readline = require('readline');
const path = require('path');
const topojson = require('topojson');

function padding(str, size, pad){
	str = str.toString();
	while(str.length<size){
		str = pad+str;
	}
	return str;
}


class TreeFileProcessor{

	constructor(filename, level){
		this.filename = filename;
		this.level = level;
	}

	init(){
		this._result = new Map();
		this.idSets = new Set();
	}

	process(){
		const self = this;
		self.init();
		return new Promise(function(resolve, reject){
			const instream = fs.createReadStream(self.filename, {encoding:'utf8', bufferSize: 1, fd: null, flags: 'r'});
			const rl = readline.createInterface(instream, new stream);
			rl.on('line', self.parseLine.bind(self));
			rl.on('close', resolve);
		});
	}

	get result(){ return this._result; }

	/**
	 * parse a line and push the result in _result
	 * treeFile
	 */
	parseLine(line){
		try{
			if(line.indexOf('#') != -1 || !line.trim()) return;
			const fields = line.split(' ');

			const sectionFields = fields[2].replace(/"/g,'').split('_');
			const sezioniKey = sectionFields[0] + padding(sectionFields[1], 3, '0') + '_' + sectionFields[2];
			//console.log('sezioniKey: '+sezioniKey);

        //console.error(sezioniKey+' > sezione per il record : '+line);
			const record = {
				id: fields[0],
				levelKeys: [],
				value: Number(fields[1]),
				section: {
					prov: sectionFields[0],
					com: sectionFields[1],
					sez: parseInt(sectionFields[2])
				}
			};

			// create a Array of level key
			// es. [ '1', '1:1', '1:1:1', '1:1:1:1' ]
			const id_values = fields[0].split(':');
			let cumolativeKey = id_values[0];
			for(let i=0;i<id_values.length;i++){
				record.levelKeys.push(cumolativeKey);
				if(i+1<id_values.length) cumolativeKey += ':'+id_values[i+1];
			}
			this.result.set(record.section.sez, record);
			this.idSets.add(this.level < record.levelKeys.length?record.levelKeys[this.level]:record.levelKeys[record.levelKeys.length-1]);
		}catch(e){
			console.log('line : '+line);
			console.warn(e.stack);
		}
	}

	writeFile(outputDirectory, suffix, data){
		const self = this;
		return new Promise(function(resolve, reject){
			let outputname = self.filename.split('_');
			outputname = outputname[outputname.length-1];
			const outputPath = path.join(outputDirectory, outputname.split('.')[0] +'_'+suffix+'.json');
			const dataJSON = JSON.stringify(data);
			fs.writeFile(outputPath, dataJSON, 'utf8', (err) => {
				if (err) return reject(err);
				console.log('File Saved : '+outputPath);
				resolve();
			});
		});
	}
}

module.exports = function(grunt) {

	grunt.registerTask('mergeSezioni', 'description', function() {
		// Directory of tree files
		const DIRECTORY = grunt.config.get('mergeSezioni.options.treeDirectoryPath');
		const outputDirectory = grunt.config.get('mergeSezioni.options.outputDirectory');

		// for Grunt to know when the task is done
		const done = this.async();

		// Read Geometry File
		const geometryFileContent = fs.readFileSync(grunt.config.get('mergeSezioni.options.geometryFile'));
		// Parse to JSON Geometry
		const geometries = JSON.parse(geometryFileContent);

				const processor = new TreeFileProcessor(path.join(DIRECTORY, 'od_trajs_1200_50_weekdays0.tree'),4);
				processor.process().then(function(){
					/*onst data = topojson.merge(geometries, geometries.objects.R09_01_WGS84.geometries.filter(function(d){
							return (processor.result.has(d.properties.SEZ) && (processor.result.get(d.properties.SEZ).id.indexOf('1:1:1:2')!= -1));
					}));*/
					const data = [] /*{"type":"Topology","objects":{"R09_01_WGS84_WW0_":{"type":"GeometryCollection","geometries":}}};*/
							  processor.idSets.forEach(function(val){
								data.push(topojson.mergeArcs(geometries, geometries.objects.R09_01_WGS84.geometries.filter(function(d){
									return (processor.result.has(d.properties.SEZ) && (processor.result.get(d.properties.SEZ).id.indexOf(val)!= -1))
								})));
							  });
						console.log(require('util').inspect(processor.result, { depth: null }));
					return processor.writeFile(outputDirectory,'prova_Sezioni',data);
				}).then(function(){
					console.log('Complete');
				}, function(err){
					console.error(err);
				});
		});
};
