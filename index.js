'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const restService = express();

var request, response, type;
var speech = '';
var jobList = '';


restService.use(bodyParser.json());

restService.post('/hook', function (req, res) {

    console.log('hook request ');

    request = req;
    response = res;

    var processor = lookupIntent(req.body.result.metadata.intentId);

    processor(request);

});

restService.listen((process.env.PORT || 5000), function () {
    console.log("Server listening");
});


function sendSpeech () {

     try {

        if (request.body) {
            var requestBody = request.body;

            if (requestBody.result) {
                //speech = '';

                if (requestBody.result.fulfillment) {
                    console.log('fulfillment');
                    //speech += ' ';
                }

                if (requestBody.result.action) {
                    //speech = text;
                    //speech += 'action: ' + requestBody.result.action;
                }

                console.log('intent: ' + requestBody.result.metadata.intentId);
                console.log('parameters: ' + JSON.stringify(requestBody.result.parameters));
            }
        }

        console.log('result: ', speech);

        return response.json({
            speech: speech,
            displayText: speech,
            source: 'apiai-webhook-sample'
        });
    } catch (err) {
        console.error("Can't process request", err);

        return response.status(400).json({
            status: {
                code: 400,
                errorType: err.message
            }
        });
    }

}


function processExternalRequest(options, callback) {

    console.log("processRequest");

    var extRequest;
    var data = "";

    if (type === "https") {

        extRequest = https.request(options, function(res) {
	        var msg = '';
	        res.setEncoding('utf8');
	        res.on('data', function(chunk) {
	            msg += chunk;
	        });
	        res.on('end', function() {
	            callback(msg);
	            console.log(JSON.parse(msg));
	        });
    });

    } else {

	    extRequest = http.request(options, function(res) {
	        var msg = '';
	        res.setEncoding('utf8');
		    res.on('data', function(chunk) {
		        msg += chunk;
		    });
		    res.on('end', function() {
	            callback(msg);
	            console.log(JSON.parse(msg));
		    });
	    });

    }

    extRequest.write(data);
    extRequest.end();
}


function lookupIntent (intentId) {

    switch (intentId) {
      case "cd3c6dfb-1f5e-4357-a790-362f54c519be":
        return getTSAWaitTime;
      break;

      case "704a34b0-3c3a-409b-be10-478660b71a76":
        return getUSAJobs;
      break;

      case "0f03908f-d37c-4809-a1fe-f6c2e4bc68e4":
        return returnUSAJobsFollowUp;
      break;

    }
}

function getTSAWaitTime (args) {

    type = "http";

    var query = "ap=" + args.body.result.parameters['geo-airport'];

    var options = {
      host: "apps.tsa.dhs.gov",
      port: '80',
      path: "/MyTSAWebService/GetTSOWaitTimes.ashx?" + query + "&output=json",
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
        }
     };

    processExternalRequest(options, returnTSAWaitTime);
}


function returnTSAWaitTime (results) {

     var waitTime, text;
     console.log("results: " + JSON.stringify(results));
     var data = JSON.parse(results);
     var times = data.WaitTimes;
     console.log("times: " + JSON.stringify(times));
     var latest = times[0];
     waitTime = latest.WaitTime;

    if (waitTime < 2) {
        speech = "The wait time is " + waitTime + " minute."
    } else {
        speech = "The wait time is " + waitTime + " minutes."
    }

    sendSpeech();
}

function getUSAJobs (args) {

    type = "https";

    var query = "query=";

    if (args.body.result.parameters['jobType']) {
        query += args.body.result.parameters['jobType'] + '+jobs';
    }

    if (args.body.result.parameters['organizationId']) {
        var org = args.body.result.parameters['organizationId'];
        query += "+with+" + org.replace(/ /g, "+");
    }

    if (args.body.result.parameters['geo-city']) {
        var city = args.body.result.parameters['geo-city'];
        query += "+in+" + encodeURI(city);
    }

    if (args.body.result.parameters['geo-state-us']) {
        query += "+in+" + args.body.result.parameters['geo-state-us'];
    }

    if (args.body.result.parameters['tags']) {
        query += "&tags=" + args.body.result.parameters['tags'];
    }

    query += "&size=" + "50";


    console.log("query: " + query);

    var options = {
      host: "api.usa.gov",
      port: '443',
      path: "/jobs/search.json?" + query,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
        }
     };

    processExternalRequest(options, returnUSAJobs);

}

function returnUSAJobs (results) {

     var jobs, jobCount, text;
     console.log("results: " + JSON.stringify(results));
     var data = JSON.parse(results);
     var jobs = data;
     jobCount = jobs.length;
     console.log("job count: " + JSON.stringify(jobCount));

    if (jobCount > 1) {
        speech = "There are " + jobCount + " jobs. Would you like to see the list?";
    } else if (jobCount > 0){
        speech = "There is " + jobCount + " job. Would you like to see it?";
    } else {
        speech = "I'm sorry, no jobs matched the search.";
    }

    jobList = jobs;

    sendSpeech();
}

function returnUSAJobsFollowUp() {
  speech = '';

  var cardItems = [];

  for (var i = 0; i < 10; i++) {
    cardItems[i] = {
                    "optionInfo": {
                      "key": i+1,
                      "synonyms": []
                    },
                    "title": jobList[i].position_title,
                    "description": "This is at the " + jobList[i].organization_name
                  };
    //speech += jobList[i].position_title + " at the " + jobList[i].organization_name + "; ";
  }

  //jobList.forEach(function(obj){
  //  speech += obj.position_title + " at the " + obj.organization_name + "; ";
  //})

  sendSpeechCard(cardItems);
}

function sendSpeechCard (cardItems) {

     try {

        if (request.body) {
            var requestBody = request.body;

            if (requestBody.result) {
                //speech = '';

                if (requestBody.result.fulfillment) {
                    console.log('fulfillment');
                    //speech += ' ';
                }

                if (requestBody.result.action) {
                    //speech = text;
                    //speech += 'action: ' + requestBody.result.action;
                }

                console.log('intent: ' + requestBody.result.metadata.intentId);
                console.log('parameters: ' + JSON.stringify(requestBody.result.parameters));
            }
        }

        console.log('result: ', speech);

        return response.json({
            speech: speech,
            displayText: speech,
            source: 'apiai-webhook-sample',
            messages: [
                        {
                          "type": "carousel_card",
                          "platform": "google",
                          "items": cardItems
                        },
                        {
                          "type": 0,
                          "speech": speech,
                        }
                      ]
        });
    } catch (err) {
        console.error("Can't process request", err);

        return response.status(400).json({
            status: {
                code: 400,
                errorType: err.message
            }
        });
    }

}
