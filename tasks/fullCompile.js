'use strict';

// Library within node js
const fs = require('fs');
const stream = require('stream');
const readline = require('readline');
const path = require('path');

// Libraries download with npm install
const csv = require('csv');
const async = require('async');

/**
 * Add a padding to str for achieve the size
 */
function padding(str, size, pad){
	str = str.toString();
	while(str.length<size){
		str = pad+str;
	}
	return str;
}

class TreeFileProcessor{

	constructor(filename, comuniMap){
		this.filename = filename;
		this.comuniMap = comuniMap;
	}

	init(){
		this._result = [];
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
	 */
	parseLine(line){
		try{
			if(line.indexOf('#') != -1 || !line.trim()) return;
			const fields = line.split(' ');

			const sectionFields = fields[2].replace(/"/g,'').split('_');
			const comuneCode = Number(sectionFields[0]+padding(sectionFields[1], 3, '0'))
			const comune = this.comuniMap.get(comuneCode);
			const record = {
				id: fields[0],
				levelKeys: [],
				value: Number(fields[1]),
				section: {
					prov: sectionFields[0],
					com: sectionFields[1],
					sez: sectionFields[2]
				},
				comuneFeature: comune
			};

			// create a Array of level key
			// es. [ '1', '1:1', '1:1:1', '1:1:1:1' ]
			const id_values = fields[0].split(':');
			let cumolativeKey = id_values[0];
			for(let i=0;i<id_values.length;i++){
				record.levelKeys.push(cumolativeKey);
				if(i+1<id_values.length) cumolativeKey += ':'+id_values[i+1];
			}
			this.result.push(record);
		}catch(e){
			console.log('line : '+line);
			console.warn(e.stack);
		}
	}

	/**
	 * Create sets of comuni based on id level
	 */
	clusterize(level, threshold){
		const self = this;
		return new Promise(function(resolve, reject){
			const clusters = new Map();
			const maxComuneCluster = new Map();
			async.forEach(self.result, function(record, eachcb){
				// get the cluster key in the Map
				let clusterKey = null;
				if ( record.levelKeys.length-level<0 || level<1 ) clusterKey = record.levelKeys[0];
				else clusterKey = record.levelKeys[record.levelKeys.length - level];
				if (clusterKey == null) return eachcb();

				let codiceComune = null;
				if(record.comuneFeature) codiceComune = record.comuneFeature.properties.PRO_COM;

				// If just in the Map update the count
				// else insert a new one
				if(clusters.has(clusterKey)){
					const cluster = clusters.get(clusterKey);
					cluster.recordCount++;
					if(codiceComune && !cluster.comuni.has(codiceComune)) cluster.comuni.set(codiceComune, record.comuneFeature);
					if(!maxComuneCluster.has(codiceComune) || maxComuneCluster.get(codiceComune).recordCount<cluster.recordCount){
						maxComuneCluster.set(codiceComune, cluster);
					}
					//clusters.set(clusterKey, cluster);
				}else{
					const comuni = new Map();
					if(codiceComune) comuni.set(codiceComune, record.comuneFeature);
					clusters.set(clusterKey, {
						key: clusterKey,
						recordCount: 1,
						comuni: comuni
					});
				}
				eachcb();
			}, function(err){
				if(err) reject(err);

				// remove not interesting cluster and convert to Array
				clusters.forEach(function(cluster, key, map){

					// remove a comune from all cluster except the cluster with max recordCount
					cluster.comuni.forEach(function(comune, key, map){
						const codiceComune = comune.properties.PRO_COM;
						if(maxComuneCluster.get(codiceComune) != cluster) map.delete(key);
					});

					// remove a cluster if recordCount is less than threshold or id not have comuni
					if(cluster.recordCount<threshold || cluster.comuni.size == 0){
						map.delete(key);
					}else{
						cluster.comuni = Array.from(cluster.comuni.values());
					}
				});
				resolve(Array.from(clusters.values()));
			});
		});
	}

	writeFile(outputDirectory, suffix, data){
		const self = this;
		return new Promise(function(resolve, reject){
			let outputname = self.filename.split('_');
			outputname = outputname[outputname.length-1];
			const outputPath = path.join(outputDirectory, outputname.split('.')[0] +'_'+suffix+'.json');
			const dataJSON = JSON.stringify(data);
			fs.writeFile(outputPath, dataJSON,'utf8', (err) => {
				if (err) return reject(err);
				console.log('File Saved : '+outputPath);
				resolve();
			});
		});
	}
}

module.exports = function(grunt) {

	grunt.registerTask('fullCompile', 'description', function() {
		const DIRECTORY = grunt.config.get('fullCompile.options.treeDirectoryPath');
		const outputDirectory = grunt.config.get('fullCompile.options.outputDirectory');
		const done = this.async();

		// Read Geometry File
		const geometryFileContent = fs.readFileSync(grunt.config.get('fullCompile.options.geometryFile'));
		// Parse to JSON Geometry
		const geometries = JSON.parse(geometryFileContent);
		if(!geometries || !geometries.features) throw new Error('Invalid Geometry File');

		// Create Comuni Map, for performance improves
		const comuniGeometryMap = new Map();
		for(let i=0;i<geometries.features.length;i++){
			comuniGeometryMap.set(geometries.features[i].properties.PRO_COM, geometries.features[i]);
		}

		// Read All Files in DIRECTORY
		// Precess every File
		fs.readdir(DIRECTORY, (err, files) => {
			async.forEach(files, function(filename, eachcb){
				const processor = new TreeFileProcessor(path.join(DIRECTORY, filename), comuniGeometryMap);
				processor.process().then(function(){
					const promise1 = processor.clusterize(3, 15).then(function(data){ return processor.writeFile(outputDirectory, 'level_3', data); });
					const promise2 = processor.clusterize(2, 15).then(function(data){ return processor.writeFile(outputDirectory, 'level_2', data); });
					return Promise.all([promise1, promise2]);
				}).then(function(){
					console.log('Complete');
				}, function(err){
					console.error(err);
				});
			}, done);
		});
	});
};
