"use strict";
const createClient = require('db-hafas');
const dbClient = createClient('MagicMirror-Module/Coburn84');

let DbFetcher = function (config) {
    this.config = config;
};

let typeData = {
    'U': {
        type: 'subway',
        color: '#0067AD'
    },
    'Bus': {
        type: 'bus',
        color: '#a5037b'
    },
    's': {
        type: 'subway',
        color: '#006F35'
    }
}

Object.defineProperty(Array.prototype, 'flat', {
    value: function(depth = 1) {
      return this.reduce(function (flat, toFlatten) {
        return flat.concat((Array.isArray(toFlatten) && (depth>1)) ? toFlatten.flat(depth-1) : toFlatten);
      }, []);
    }
});

DbFetcher.prototype.getStationId = function () {
    return this.config.stationId;
};

DbFetcher.prototype.getStationName = function () {
    return dbClient.locations(this.config.name).then((response) => {
        return response ? response[0].name : '';
    });
};

DbFetcher.prototype.fetchDepartures = function () {
    // when value for a request is calculated to be 5 minutes before delay time
    var when;

    if (this.config.delay > 0) {
        when = new Date();
        when.setTime((Date.now() + this.config.delay * 60000) - (5 * 60000));
    } else {
        when = Date.now();
    }

    var direction = null;
    if (this.config.direction) {
        direction = this.config.direction;
    }
	
	var promiseList = [];
    var destinationInfo = [];

    var destinations = this.config.directions ? this.config.directions : [ direction ];


    for (let destinationStationId of destinations) {
        var opt = {
            when: when,
            duration: this.config.departureMinutes,
            direction: destinationStationId
        };

        promiseList.push(
		dbClient.departures(this.config.stationId, opt).then((response) => { return this.processData(response); })
	)
    }

    return Promise.all(promiseList).then(
        function(results) {
		var totalData = {
			stationId: results[0].stationId,
			departuresArray: results.map(function(departureDataPart) { return departureDataPart.departuresArray; }).flat(1)
		}
		totalData.departuresArray.sort(compare);
		return totalData;
	}
    )
};

DbFetcher.prototype.processData = function (data) {
    var departuresData = {
        stationId: this.config.stationId,
        departuresArray: []
    };

	for (let row of data) {

        //if (!this.config.ignoredStations.includes(row.station.id)) {
        if (!this.config.ignoredStations.includes(row.stop.id) && this.config.excludedTransportationTypes.search(row.line.mode) == -1) {
            //console.log('Parsing: ' + row.line.name + ' nach ' + row.direction + ' um ' + row.when);

            let delay = row.delay;
            if (!delay) {
                row.delay = 0
            }

            let productType = row.line.product;    // type
            if (!productType && typeData[row.line.productName]) {
                productType = typeData[row.line.productName];
            } 
            if (!productType && row.line.productName) {
                productType = { type: row.line.productName, color: "#006F35" }
            }

            let current = {
                when: row.when,
                delay: row.delay,
                line: row.line.name,
                nr: row.line.class,
                //type: productType.type,
                type: row.line.product,
                color: productType.color,
                direction: row.direction,
                canceled: row.canceled ? row.canceled : false
            };

            if (current.canceled) {
                current.when = row.scheduledWhen;
            }

            departuresData.departuresArray.push(current);
        }
	}

    //data.forEach((row) => {
	//	console.log('processData Row:' + data.product.name);
    //    if (!this.config.ignoredStations.includes(row.station.id)) {

            //console.log('------------------------------------------------------------------------------');
    //        console.log('Parsing: ' + row.product.name + ' nach ' + row.direction + ' um ' + row.when);
    //        console.log(JSON.stringify(row.product));

    //        let delay = row.delay;
    //        if (!delay) {
    //            row.delay = 0
    //        }

    //        let productType = row.product.type;
    //        if (!productType && typeData[row.product.productName]) {
    //            productType = typeData[row.product.productName];
    //        } 
    //        if (!productType && row.product.productName) {
    //            productType = { type: row.product.productName, color: "#006F35" }
    //        }

    //        let current = {
    //            when: row.when,
    //            delay: row.delay,
    //            line: row.product.name,
    //            nr: row.product.nr,
    //            type: productType.type,
    //            color: productType.color,
    //            direction: row.direction
    //        };

    //        console.log(current);

    //        departuresData.departuresArray.push(current);
    //    }
    //});

    //departuresData.departuresArray.sort(compare);
    return departuresData;
};

function compare(a, b) {

    // delay must be converted to milliseconds
    let timeA = new Date(a.when).getTime() + a.delay * 1000;
    let timeB = new Date(b.when).getTime() + b.delay * 1000;

    if (timeA < timeB) {
        return -1;
    }
    if (timeA > timeB) {
        return 1
    }
    return 0
}

// helper function to print departure for debugging
function printDeparture(row) {

    let delayMinutes = Math.floor((((delay % 31536000) % 86400) % 3600) / 60);

    let time = row.when.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    console.log(time + " " + delayMinutes + " " + row.product.type.unicode + " " + row.direction + " | stopId: " + row.stop.id);
}

module.exports = DbFetcher;
