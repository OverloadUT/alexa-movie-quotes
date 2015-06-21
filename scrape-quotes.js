var request = require('request');
var cheerio = require('cheerio');
var sleep = require('sleep');
var Q = require('q');

function getQuotes() {

}

function main() {
    request('http://www.imdb.com/chart/top', function(error, response, html){
        if (error) {
            return new Error("Error trying to retrieve the top 250 movies from IMDB");
        }

        var $ = cheerio.load(html);
        var movies = $('.lister-list td.titleColumn a');

        var output = [];

        $(movies).each(function(i, movie){
	        var movieName = $(movie).text().trim();
	        var movieID = $(movie).attr('href').match(/\/title\/([a-z0-9]+)\//)[1];

	        request('http://www.imdb.com/title/'+movieID+'/quotes', function(error, response, quotehtml){
	            if (error) {
	                
	            } else {
		            var quotes = [];

		            $ = cheerio.load(quotehtml);
		            var quotesDom = $('#quotes_content div.quote p:only-child');
		            $(quotesDom).each(function(i, quoteElement){
			            var quoteText = $(quoteElement).text().trim();
			            quoteText = quoteText.replace(/(\r\n|\n|\r)/gm,"");
			            quoteText = quoteText.match(/:(?:\s*\[.*\])?\s*(.*)/)[1];

			            quotes.push(quoteText);
		            });

			        output.push({
			        	movieName: movieName,
			        	movieID: movieID,
			        	quotes: quotes
			        });

		        	sleep.sleep(1);
		        	if(i == movies.length-1) {
						console.log(JSON.stringify(output));
		        	}
	        	}
	        });
        });
    });
}

main();