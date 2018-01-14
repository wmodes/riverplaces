# riverplaces
This tool uses Google Places to take a list of cities and a list of keywords and return a list of related places in those cities.

## Details
This tool uses the Google Places API to lookup places matching keyterms in places that you specify and return a list of details for those places. The program does this in the following steps:

1. Compile a detailed list of places based on your list (Text Search API)
2. Look up places matching your list of keyterms, assigning a prioirty, and validating the places to ensure they match your keyterms (Nearby Search API)
3. Look up detailed information on each place, fields selected by the user (Detailed Search API)
4. Saves a priority for each place based on the order and optionally specified priority given in your keyterm list.
4. Output tab-delimited fields suitable for pasting into Excel or Google Docs

The script does not use the Google Places API JavaScript library since the results were not as complete as the web API (read, not actually working at all). It uses CORS so it can do cross-domain work. Finally, it does the requests relatively economically, using the Text Search API only for locations, since these count as 10 hits against your quota.

## Installation

1. Clone or fork this repo
2. Create a new Google Places API key of your own and change that in the JS file. Mine is restricted and won't work for you.
3. Open the file with your browser
4. If you want to run this JS file locally, the Google API won't want to allow a CORS request from a local file. You'll have to install the cross-origin resource sharing extension to Chrome.
5. Or you can upload this to a server and run it there.

## Background

I created this to search a list of river towns and cities for art and history museums along the various rivers I was touring with my project [A Secret History of American River People](http://peoplesriverhistory.us). For instance, there are approximately 230 towns along the 980 miles of the Ohio River, resulting in over 700 art and history institutions. While I am not planning to contact all of them, the script helps me list and prioritize them. 
