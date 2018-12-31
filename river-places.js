// Author: Wes Modes
// Date: 13 Jan 2018
// Title: River Places Tools
// Description: This tool uses Google Places to take a list of cities and a 
//  list of keywords and return a list of related places in those cities.


APIKEY = "AIzaSyCBh9fv_G5BRRIZm0b3pUd-i7IgU4QGRg4";
APIURL = "https://maps.googleapis.com/maps/api/place";

// object in which to store all the ids returned and their priorities
var idObj = {};

// input variables
var locationList = [];
var keywordList = [];
var fieldList = [];

// collection variables
var locationDataList = [];
var placesDataObj = {};
var detailDataList = [];
var howManyReviews = 1;
var reviewWords = 25;

// DOM fields
locationFieldId = "#input-locations";
keywordFieldId = "#input-keywords";
fieldFieldId = "input#input-fields";
notification = "#notification";
outputFormId = ".outputform #output-field";

// global flags
var error_flag = false;

// map constants
// arbitrary coordinates (geographic center of contiguous us)
defaultLat = 39.828593;
defaultLng = -98.579469;
defaultRad = 2500; // or 2.5km
var placesAPI = {};

//
// CORS stuff
//

// Create the XHR object.
function createCORSRequest(method, url) {
    var xhr = new XMLHttpRequest();
    if ("withCredentials" in xhr) {
        // XHR for Chrome/Firefox/Opera/Safari.
        xhr.open(method, url, true);
    } else if (typeof XDomainRequest != "undefined") {
        // XDomainRequest for IE.
        xhr = new XDomainRequest();
        xhr.open(method, url);
    } else {
        // CORS not supported.
        xhr = null;
    }
    return xhr;
}

//
// Compile Locations
//

// create URL for location search
// https://maps.googleapis.com/maps/api/place/textsearch/json?query=knoxville+tn&key=AIzaSyC8dMs4JIuNzm9ChklR89p_FX0Sn4O3Yz4
function getLocationUrl(location) {
    query = (location).replace(/\s/g, "+");
    query = encodeURI(query);
    return(APIURL + "/textsearch/json?query=" + query + "&key=" + APIKEY);
}

// record location data in an array
function recordLocationData(locationObj) {
    //console.log("Orig record:", locationObj);
    var newObj = {
        "name": locationObj.formatted_address,
        "lat": locationObj.geometry.location.lat,
        "lng": locationObj.geometry.location.lng
    };
    locationDataList.push(newObj);
    //console.log("New record:", newObj);
}

// use Google Places Text Search service to get location data
// note: text search counts as 10 hits against your quota
function getLocationData(location, defFlag) {
    //console.log("searching:", location);
    var url = getLocationUrl(location);
    //console.log("URL", url);
    var xhr = createCORSRequest('GET', url);
    if (!xhr) {
        console.log('CORS not supported');
        error_flag = true;
        defFlag.resolve();
        return false;
    }
    xhr.onerror = function() {
        console.log(xhr.onerror);
        error_flag = true;
        defFlag.resolve();
    };
    xhr.onload = function() {
        if (error_flag) { return false; }
        var text = xhr.responseText;
        obj = JSON.parse(text);
        //console.log("Orig object:", obj);
        if ('error_message' in obj) {
            console.log(obj['error_message'])
            error_flag = true;
            defFlag.resolve();
            return false;
        }
        results = obj.results;
        //console.log("Results:", results);
        $.each(results, function(key, value) {
            recordLocationData(value);
        })
        defFlag.resolve();
        return true;
    };
    xhr.send();
    return true;
}

// use Google Places API to look up data for each location
function collectLocationData() {
    // notification
    $(notification).append("<div id=location-data>Collecting location data...");
    // add deferred flags
    var defFlags = [];
    for (var i = 0; i < locationList.length; i++) {
        if (!(/\S/.test(locationList[i]))) {continue;}
        // set deferred flag
        defFlags[i] =  $.Deferred();
        //console.log("Deferred:", i, defFlags[i]);
        console.log("Collecting location data:", locationList[i]);
        if (! getLocationData(locationList[i], defFlags[i])) {
            alert('Whoops, there was an error making the request.');
            return false;
        }
    }
    return $.when.apply($, defFlags).done(function(){
        console.log("Finished collecting location data");
        $(notification + ' #location-data')
            .append(" done (" + locationDataList.length + " locations)");
    }).promise();
}

//
// Find places
//

// create URL for place search
// https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=-33.8670522,151.1957362&radius=500&keyword=cruise&key=YOUR_API_KEY
function getPlaceUrl(lat, lng, keyword) {
    var locq = "location=" + lat + "," + lng;
    var radq = "radius=" + defaultRad;
    var keywdq = "keyword=" + keyword.replace(/\s/g, "+");
    var query = locq + "&" + radq + "&" + keywdq + "&" + "&key=" + APIKEY;
    query = encodeURI(query);
    return(APIURL + "/nearbysearch/json?" + query);
}

// record location data in an array
function recordPlaceData(placeObj, priority) {
    // console.log("Orig record:", placeObj);
    var id = placeObj.place_id;
    if (id in placesDataObj) {
        placesDataObj[id].priority = Math.min(priority, placesDataObj[id].priority)
    } else {
         var newObj = {
            "priority": priority,
            "name": placeObj.name,
            "vicinity": placeObj.vicinity,
            "types": placeObj.types
        };
        placesDataObj[id] = newObj;
        // console.log("New record:", newObj);
    }
}

function cleanString(str) {
    // remove punctuation
    str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
    // covert to utf string
    str = unescape(encodeURIComponent(str));
    // remove extra spaces
    str = str.replace(/\s+/g, ' ');
    // cast to lower case
    str = str.toLowerCase();
    // remove dupe words
    str = str.split(' ').filter(function(item,i,allItems){
        return i==allItems.indexOf(item);
    }).join(' ');
    return str;
}

// confirm that each record has all the keywords in it
function verifyPlace(placeObj, keyword) {
    // moosh types array with name and clean it
    var moosh = cleanString(placeObj.name + ' ' + placeObj.types.join(' '));
    // console.log("Moosh", moosh);
    // break keyword into array (removing any punctuation)
    var keyArray = cleanString(keyword).split(' ');
    // console.log("keyArray", keyArray);
    // set count to 0
    var matchCount = 0;
    // iterate through keywords
    for (var i = keyArray.length - 1; i >= 0; i--) {
        // check if keyword in moosh
        if (moosh.indexOf(keyArray[i]) > -1) {
            // console.log("Match:", moosh, keyArray[i]);
            matchCount++;
        }
    }
    // console.log("matches:", matchCount);
    // return true if count = number of keywords
    return (matchCount == keyArray.length);
}

// use Google Places Text Search service to get location data
// note: text search counts as 10 hits against your quota
function getPlaceData(locationObj, keyword, priority, defFlag) {
    var locationName = locationObj.name;
    var lat = locationObj.lat;
    var lng = locationObj.lng;
    console.log("Searching:", keyword, "in", locationName.split(',')[0], "(p:"+priority+")");
    var url = getPlaceUrl(lat, lng, keyword);
    // console.log("URL", url);
    var xhr = createCORSRequest('GET', url);
    if (!xhr) {
        console.log('CORS not supported');
        error_flag = true;        
        defFlag.resolve();
        return false;
    }
    xhr.onerror = function() {
        console.log(xhr.onerror);
        error_flag = true;
        defFlag.resolve();
    };
    xhr.onload = function() {
        if (error_flag) { return false; }
        var text = xhr.responseText;
        obj = JSON.parse(text);
        //console.log("Orig object:", obj);
        if ('error_message' in obj) {
            console.log(obj['error_message']);
            error_flag = true;
            defFlag.resolve();
            return false;
        }
        results = obj.results;
        // console.log("Results:", results);
        $.each(results, function(key, place) {
            if (verifyPlace(place, keyword)) {
                recordPlaceData(place, priority);
            }
        });
        defFlag.resolve();
        return true;
    };
    xhr.send();
    return true;
}

// use Google Places API to look up data for each location
function collectPlaceData() {
    // notification
    $(notification).append("<div id='place-data'>Collecting place data...");
    // add deferred flags
    var defFlags = [];
    var defIndex = 0;
    for (var j = 0; j < keywordList.length; j++) {
        if (!(/\S/.test(keywordList[j]))) {continue;}
        // set priority
        var priority;
        var keyword = keywordList[j];
        if (keyword.search(/, *[0-9]+ *$/) > -1) {
            // if provided, pull priority off end
            var splitkey = keyword.split(',');
            priority = parseInt(splitkey.pop());
            keyword = splitkey.join(',');
        } else {
            // if we don't have an explicit priority, take from position in list
            priority = j + 1;
        }
        for (var i = 0; i < locationDataList.length; i++) {
            // set deferred flag
            defFlags[defIndex] =  $.Deferred(); 
            // console.log("Collecting places:", keyword, "in", locationDataList[i].name);
            if (! getPlaceData(locationDataList[i], keyword, 
                    priority, defFlags[defIndex])) {
                alert('Whoops, there was an error making the request.');
                return false;
            }
            defIndex++;
        }
    }
    return $.when.apply($, defFlags).done(function(){
        console.log("Finished collecting place data");
        $(notification + ' #place-data')
            .append(" done (" + Object.keys(placesDataObj).length + " places)");
    }).promise();
}



//
// Place detail
//

// create URL for detail search
// https://maps.googleapis.com/maps/api/place/details/json?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4&key=YOUR_API_KEY
function getDetailUrl(placeId) {
    var placeq = "placeid=" + placeId;
    var query = placeq + "&" + "&key=" + APIKEY;
    query = encodeURI(query);
    return(APIURL + "/details/json?" + query);
}

// record location data in an array
function recordDetailData(placeDetailObj, priority) {
    // console.log("Orig record:", placeDetailObj);
    var newObj = {
        "name": placeDetailObj.name,
        "address": placeDetailObj.formatted_address,
        "phone": placeDetailObj.formatted_phone_number,
        "placeid": placeDetailObj.place_id,
        "rating": placeDetailObj.rating,
        "types": placeDetailObj.types.join(', '),
        "website": placeDetailObj.website,
        "priority": priority
    }
    // get location
    newObj.location = placeDetailObj.geometry.location.lat + ',' + 
                      placeDetailObj.geometry.location.lng;
    // retrieve city and state
    addressParts = placeDetailObj.address_components;
    for (var i = addressParts.length - 1; i >= 0; i--) {
        // city
        if (addressParts[i].types.indexOf("locality") > -1) {
            newObj.city = addressParts[i].long_name;
        }
        // state
        if (addressParts[i].types.indexOf("administrative_area_level_1") > -1) {
            newObj.state = addressParts[i].short_name;
        }
    }
    // retreive first x words of y (most helpful) review texts
    if ("reviews" in placeDetailObj) {
        reviews = placeDetailObj.reviews;
        // console.log("Reviews:", reviews);
        var reviewText = "";
        for (i=Math.min(howManyReviews-1, reviews.length - 1); i >= 0; i--) {
            var newReview = reviews[i].text.replace(/\s+/g,' ');
            newReview = newReview.split(' ').slice(0,reviewWords).join(' ');
            reviewText = newReview + ' ' + reviewText;
        }
        newObj.notes = reviewText;

    } else {
        newObj.notes = "";
    }
    // add new record to list
    detailDataList.push(newObj);
    // console.log("New record:", newObj);
    return(newObj);
}

// use Google Places Text Search service to get location data
// note: text search counts as 10 hits against your quota
function getDetailData(placeId, placeObj, defFlag) {
    var name = placeObj.name;
    var priority = placeObj.priority;
    console.log("Getting details for", name);
    var url = getDetailUrl(placeId);
    // console.log("URL", url);
    var xhr = createCORSRequest('GET', url);
    if (!xhr) {
        console.log('CORS not supported');
        error_flag = true;        
        defFlag.resolve();
        return false;
    }
    xhr.onerror = function() {
        console.log(xhr.onerror)
        error_flag = true;
        defFlag.resolve();
    };
    xhr.onload = function() {
        if (error_flag) { return false; }
        var text = xhr.responseText;
        obj = JSON.parse(text);
        //console.log("Orig object:", obj);
        if ('error_message' in obj) {
            console.log(obj['error_message']);
            error_flag = true;
            defFlag.resolve();
            return false;
        }
        result = obj.result;
        // console.log("Result:", result);
        outputOneResult(recordDetailData(result, placeObj.priority));
        defFlag.resolve();
        return true;
    };
    xhr.send();
    return true;
}

// use Google Places API to look up data for each location
function collectDetailData() {
    // notification
    $(notification).append("<div id='detail-data'>Collecting place details...");
    // add deferred flags
    var defFlags = [];
    var defIndex = 0;
    $.each(placesDataObj, function(placeId, placeObj) {
        // set deferred flags
        defFlags[defIndex] =  $.Deferred();
        // console.log("Collecting places:", keyword, "in", locationDataList[i].name);
        if (! getDetailData(placeId, placeObj, defFlags[defIndex])) {
            alert('Whoops, there was an error making the request.');
            return false;
        }
        defIndex++;
    });
    return $.when.apply($, defFlags).done(function(){
        console.log("Finished collecting detail data");
        $(notification + ' #detail-data')
            .append(" done (" + detailDataList.length + " places)");
    }).promise();
}

//
// Output Results
//

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function toCSV(cell) {
    if (String(cell).replace(/ /g, '').match(/[\s,"]/)) {
        return '"' + cell.replace(/"/g, '""') + '"';
    }
    return cell;
}

// output header
function outputHeader() {
    // create header row
    var headerLine = "";
        for (i=0; i < fieldList.length; i++) {
            if (i == 0) {
                headerLine = toTitleCase(fieldList[i]);
            } else {
                headerLine = headerLine + '\t' + toTitleCase(fieldList[i]);
        }
    }
    $(outputFormId).append(headerLine+"\n");  
}

// output one result
function outputOneResult(detailObj) {
    var recordLine = "";
    for (i=0; i < fieldList.length; i++) {
        value = toCSV(detailObj[fieldList[i]]);
        if (i == 0) {
            recordLine = value;
        } else {
            recordLine = recordLine + '\t' + value;
        }
    }
    // push record line to display list
    $(outputFormId).append(recordLine+"\n");
    $(outputFormId).height( $(outputFormId)[0].scrollHeight );
}

// output results to webpage
function outputResults() {
    outputHeader();
    // iterate through detail records
    for (j=0; j < detailDataList.length; j++) {
        outputOneResult(detailDataList[j]);
    }
}

//
// Input functions
//

// get inputs from fields (upon submit)
function getInputs() {
    locationList = $(locationFieldId).val().replace(/[ \t\r]+/g,' ').split('\n');
    keywordList = $(keywordFieldId).val().replace(/[ \t\r]+/g,' ').split('\n');
    $(fieldFieldId + ':checked').each(function(i){
        fieldList.push($(this).val());
    });
}

// store inputs in local storage
function storeInputs() {
    localStorage.setItem("locationList", JSON.stringify(locationList));
    localStorage.setItem("keywordList", JSON.stringify(keywordList));
    localStorage.setItem("fieldList", JSON.stringify(fieldList));
}

// upon load, get locally stored values
$( document ).ready(function() {
    if (typeof(Storage) !== "undefined") {
        $(locationFieldId).html(JSON.parse(localStorage.getItem("locationList")).join('\n'));
        $(keywordFieldId).html(JSON.parse(localStorage.getItem("keywordList")).join('\n'));
        var fieldList = JSON.parse(localStorage.getItem("fieldList"));
        if (typeof(fieldList) == "object") {
            $(fieldFieldId).attr('checked', false);
            $(fieldFieldId).each(function(){
                if ($.inArray($(this).val(), fieldList) > -1) {
                    $(this).attr('checked', true);
                }
            });
        }
    }
});

//
// Main Bidness
//

function submit() {
    // clear globals
    error_flag = false;
    locationList = [];
    keywordList = [];
    fieldList = [];
    locationDataList = [];
    placesDataObj = {};
    detailDataList = [];
    $(notification).html("");
    $(outputFormId).html("");
    var dfrd = $.Deferred();
    getInputs();
    storeInputs();
    outputHeader();
    collectLocationData().done(function(){
        collectPlaceData().done(function(){
            collectDetailData().done(function(){
                //outputResults();
            }); 
        });
    });
}

