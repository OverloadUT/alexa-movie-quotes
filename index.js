require('dotenv').load();
// var request = require('request');
var cheerio = require('cheerio');
var didYouMean = require('didyoumean');

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app." + process.env.ALEXA_APP_ID) {
            context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);

            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
                ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the app without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
                ", sessionId=" + session.sessionId);

    // With no launch parameters, we'll simply do a single quote
    startTriviaGame(5, callback);
}

/** 
 * Called when the user specifies an intent for this application.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
                ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    if ("GuessIntent" === intentName) {
        intentGuess(intent, session, callback);
    } else if ("GiveUpIntent" === intentName) {
        intentGiveUp(intent, session, callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the app returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
                ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

/**
 * Helpers that build all of the responses.
 */
function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    console.log("buildSpeechletResponse", title, output, repromptText, shouldEndSession);
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "Movie Quotes - " + title,
            content: "Movie Quotes - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}

function intentGiveUp(intent, session, callback) {
    var cardTitle = "Give Up";

    var sessionAttributes = session.attributes;

    console.log(sessionAttributes);

    if(typeof sessionAttributes === 'undefined') {
        return callback(sessionAttributes,
            buildSpeechletResponse(cardTitle, "Dude, we weren't even playing yet!", null, true));
    } else {
        responses = [
            "The correct answer was {movieName}. "
        ];
        prefixResponse = responses[randomInt(0,responses.length-1)].replace('{movieName}', sessionAttributes.movieName);

        nextTriviaRound(prefixResponse, session, callback);
    }
}

function intentGuess(intent, session, callback) {
    var cardTitle = "Guess";

    var sessionAttributes = session.attributes;

    if(typeof sessionAttributes === 'undefined') {
        return callback(sessionAttributes,
            buildSpeechletResponse(cardTitle, "It seemed like you were guessing a movie, but I hadn't given you a quote yet!", null, true));
    } else {
        // First check if this guess was correct
        var correct;
        var responsePrefix;
        if(didYouMean(intent.slots.Movie.value, [sessionAttributes.movieName])) {
            console.log("Correct guess. They guessed '" + intent.slots.Movie.value +
                "' and the correct answer was " + sessionAttributes.movieName);
            correct = true;
            sessionAttributes.correct += 1;
            responsePrefix = "Correct! ";
        } else {
            console.log("Incorrect guess. They guessed '" + intent.slots.Movie.value +
                "' and the correct answer was " + sessionAttributes.movieName);
            correct = false;
            responsePrefix = "You guessed " + intent.slots.Movie.value + ". The correct answer was " + sessionAttributes.movieName + ". ";
        }

        return nextTriviaRound(responsePrefix, session, callback);
    }
}

function nextTriviaRound(responseprefix, session, callback) {
    var sessionAttributes = session.attributes;

    // Do we need to do another quote?
    if(sessionAttributes.round < sessionAttributes.gameRounds) {
        sessionAttributes.round += 1;

        getMovieQuote(null, function(error, quote){
            if(error) {
                return callback(sessionAttributes,
                           buildSpeechletResponse("Error", "There was an error trying to get a movie quote.", null, true));
            }

            sessionAttributes.movieName = quote.movieName;
            sessionAttributes.quoteText = quote.quoteText;

            var introText = "Round "+sessionAttributes.round+": ";

            return callback(sessionAttributes,
                            buildSpeechletResponse("Round " + sessionAttributes.round,
                                responseprefix + " " + introText + " " + quote.quoteText,
                                "Simply say a movie name to guess, or you can say 'I give up.'",
                                false
                            ));
        });
    } else {
        var gameOverResponse;
        if(sessionAttributes.gameRounds == 1) {
            gameOverResponse = "";
        } else {
            var guesses = "guesses";
            if(sessionAttributes.correct == 1){
                guesses = "guess";
            }
            gameOverResponse = "You scored " + sessionAttributes.correct + " correct "+guesses+" out of " + sessionAttributes.gameRounds + " rounds.";
        }

        return callback(sessionAttributes,
                        buildSpeechletResponse("Game Over",
                            responseprefix + " " + gameOverResponse,
                            "Simply say a movie name to guess, or you can say 'I give up.'",
                            true
                        ));
    }
}

/** 
 * Functions that control the app's behavior.
 */
function startTriviaGame(gameRounds, callback) {
    console.log("getWelcomeResponse");
    var sessionAttributes = {gameRounds: gameRounds, round: 1, correct: 0};

    getMovieQuote(null, function(error, quote){
        if(error) {
            return callback(sessionAttributes,
                       buildSpeechletResponse("Error", "There was an error trying to get a movie quote.", null, true));
        }

        sessionAttributes.movieName = quote.movieName;
        sessionAttributes.quoteText = quote.quoteText;

        var introText = "";
        if(gameRounds == 1) {
            introText = "Guess this quote: ";
        } else {
            introText = "Round 1: ";
        }

        return callback(sessionAttributes,
                        buildSpeechletResponse("Starting New Game",
                            introText + quote.quoteText,
                            "Simply say a movie name to guess, or you can say 'I give up.'",
                            false
                        ));
    });
}

function getMovieQuote(movieID, callback) {
    var movies = require("./quotes.json");

    var movie = movies[randomInt(0,movies.length-1)];
    var movieName = movie.movieName;
    var quoteText = movie.quotes[randomInt(0,movie.quotes.length-1)];

    callback(null, {
        movieName: movieName,
        quoteText: quoteText
    });

    // request('http://www.imdb.com/chart/top', function(error, response, html){
    //     if (error) {
    //         return callback(new Error("Error trying to retrieve the top 250 movies from IMDB"), null);
    //     }

    //     var $ = cheerio.load(html);
    //     var movies = $('.lister-list td.titleColumn a');
    //     var randommovie = movies[randomInt(0,movies.length-1)];

    //     var movieName = $(randommovie).text().trim();
    //     var movieID = $(randommovie).attr('href').match(/\/title\/([a-z0-9]+)\//)[1];

    //     console.log(movieName);

    //     request('http://www.imdb.com/title/'+movieID+'/quotes', function(error, response, quotehtml){
    //         if (error) {
    //             return callback(new Error("There was an error reading the quotes page for " + movieName), null);
    //         }

    //         $ = cheerio.load(quotehtml);
    //         var quotes = $('#quotes_content div.quote p:only-child');
    //         var quoteElement = quotes[randomInt(0, quotes.length-1)];
    //         var quoteText = $(quoteElement).text().trim();
    //         quoteText = quoteText.replace(/(\r\n|\n|\r)/gm,"");
    //         quoteText = quoteText.match(/:(?:\s*\[.*\])?\s*(.*)/)[1];

    //         var quote = {
    //             movieName: movieName,
    //             quoteText: quoteText
    //         };
    //         callback(null, quote);
    //     });
    // });
}