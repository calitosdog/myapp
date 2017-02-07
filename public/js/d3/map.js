var compareName = undefined;
(function() {

	$(function() {
		var centered, color_scale, italy, path_generator, projection, svg, zoom_to,selected;
		color = d3.scale.category20();
		heat_color = d3.scale.linear().domain([0, 1]).range(['#b2df8a', '#ff7f00']).interpolate(d3.interpolateHcl);
		svg = d3.select('#flow-viz').append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', '-45 -40 100 100').style("background-color", "transparent");
		projection = d3.geo.albers().center([13.5, 36]).rotate([-14, 0]).parallels([38, 61]).scale(2100);
		path_generator = d3.geo.path().projection(projection);
		italy = svg.append('g').attr('class', 'italy');
		color_scale = d3.scale
		.category20b();
		selected = d3.set([
			45001, 48001, 45002, 43001, 100001, 53011
		]);
		var file = 'data/weekdays0.json';
		var mydata = JSON.toString(file);
		console.log(mydata);

		centered = null;
		zoom_to = function(d) {
			var centroid, level, x, y, zoom;
			level = d === centered ? 'zoom_italy' : d.properties.NOME_REG != null ? 'zoom_regione' : d.properties.NOME_PRO != null ? 'zoom_provincia' : 'zoom_comune';
			if (level !== 'zoom_italy') {
				centroid = path_generator.centroid(d);
				x = centroid[0];
				y = centroid[1];
				zoom = (function() {
					switch (level) {
						case 'zoom_regione':
						$("#informationsContexte").fadeOut();
						return 1.5;
						case 'zoom_provincia':
						/*chart_init_p(d.properties.NOME_PRO);*/
						$(".provinciaInfo").fadeIn();
						$("#informationsContexte").fadeOut();
						return 2.5;
						case 'zoom_comune':
						/*chart_init(d.properties.NOME_COM);*/
						$("#overlay").fadeIn("fast");
						$(".comuneInfo").fadeIn();
						$(".provinciaInfo").fadeOut();
						$("#informationsContexte").fadeOut();
						return 9;
					}
				})();
				centered = d;
			} else {
				$("#overlay").fadeOut("fast");$(".comuneInfo").fadeOut();$("#warning").fadeOut();
				$("#informationsContexte").fadeIn();
				x = 0;
				y = 0;
				zoom = 1;
				centered = null;
			}


			italy.attr('class', level);
			italy.selectAll('.regione, .provincia, .comune').classed('active', function(d) {
				return d === centered;
			});
			return italy.transition().duration(750).attr('transform', 'scale(' + zoom + ')translate(' + -x + ',' + -y + ')');
		};


		return d3.json('data/map/toscana2011_g.topo.json', function(error, data) {
			var comuni, province, regioni;
			/*regioni = topojson.feature(data, data.objects.toscana_reg2011_g);
			province = topojson.feature(data, data.objects.toscana_prov2011_g);*/
			comuni = topojson.feature(data, data.objects.toscana_com2011_g);
			console.log(data.objects.toscana_com2011_g);
			neighbors = topojson.neighbors(data.objects.toscana_com2011_g.geometries);
			selezionato = topojson.merge(data, data.objects.toscana_com2011_g.geometries.filter(function(d) { console.log(d.properties.COD_PRO); return selected.has(d.properties.PRO_COM);  }));
			italy.selectAll('.comune').data(comuni.features).enter().append('path').attr('class', 'comune').attr('d', path_generator).attr('fill','#aaa')
			.on('click', zoom_to).append('title').text(function(d) {
				return d.properties.NOME_COM;
			});
			/*d3.json('data/weekdays0.json', function(error, track) {
			if (error) throw error;
			track.forEach(function(c) {
			svg.append('path').datum(selezionato).attr('d', path_generator).attr('class','ciao').attr('fill', function(c) { return heat_color(c.id.split(':')[0]) });
			console.log(track);
		});
	});*/
	/*italy.selectAll('.comune').append("path_generator")
	.data(topojson.merge(data, .filter(function(d) { return selected.has(45); })))
	.attr("fill", "orange")
	.attr("d", path_generator);
	console.log(selected);*/



			/**
			 * MODIFICHE SERGIO
			 */
			//Delay
			queue().defer(d3.json, "data/weekdays1.json").await(ready);
			//function that loads json and extracts all the comuni into array
			function ready(error, track) {
				// associate Color -> list of comuni
				const selectedColored = new Map();
				if (error) throw error;
				track.forEach(function(d) {
					// get the color
					const color = heat_color((d.id.split(':')[0]));
					let selected; // define the object that contain the list
					// if just esists get the object
					if(selectedColored.has(color)){
						selected = selectedColored.get(color);
					}else{
					// if not exist create new one
						selected = { color:color, comuniSelected: new Set() };
					}
          let comune = d.section.com;
          while(comune.length < 3){
            comune = '0'+comune;
          }
          const COD_PRO = d.section.prov + comune;

          // add comune to the list
          selected.comuniSelected.add(parseInt(COD_PRO));
					// associate color with the object
					selectedColored.set(color, selected);

				});

				// iterate to map items
				selectedColored.forEach(function (selected, color, map){
					// create merged for this color set
					const merged = topojson.merge(data, data.objects.toscana_com2011_g.geometries.filter(function(d) {
					console.log(selected.comuniSelected.has(d.properties.PRO_COM));	return selected.comuniSelected.has(d.properties.PRO_COM);
					}));
					// draw the path with the merged data
					svg.append('path').datum(merged)
					.attr('d', path_generator)
					.attr('class','ciao')
					.attr('fill', color)
					.style('opacity',.7);

          console.log(selected.comuniSelected)
				});
			}
		});
	});

}).call(this);
