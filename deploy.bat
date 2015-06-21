@echo off
rmdir dist\install /S /Q
mkdir dist\install
call npm install --prefix dist\install .
del dist\alexa-movie-quotes.zip
7z a dist\alexa-movie-quotes.zip .\dist\install\node_modules\alexa-movie-quotes\*
echo Function zipped. Updating...
aws lambda update-function-code --zip-file fileb://dist\alexa-movie-quotes.zip --function-name alexaMovieQuotes
