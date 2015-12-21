var config						= require('./../config');
var Database 					= require("./database.js").Database;
var async   = require("async");
var path    = require('path');
var fs      = require('fs');
var sys     = require('sys');


var Videos = new (function ()
{
    String.prototype.format = function() {
        var formatted = this;
        for (arg in arguments) {
            formatted = formatted.replace("{" + arg + "}", arguments[arg]);
        }
        return formatted;
    };

    var SEGMENTER_LOCATION  = path.join(__dirname, '..', 'segmenter/segmenter');

    var SEGMENT_DURATION    = 5;

    var PROFILES_LOCATION   = path.join(__dirname, '..', 'profiles.json');

    var profiles            = JSON.parse(fs.readFileSync(PROFILES_LOCATION));

    var HTTP_PREFIX         = config.server.WebURL + '/streams/';

    var FILE_NAME           = "";

    var STREAM_OUTPUT_DIR   = path.join(__dirname, '..', '/public/streams/')


    function getCommandsForAllActiveProfiles(inputFileName, inputFilePath) {

        FILE_NAME = inputFileName;

        fs.mkdirSync(STREAM_OUTPUT_DIR + FILE_NAME);

        process.chdir(STREAM_OUTPUT_DIR + FILE_NAME + '/');

        var commands = [];

        profiles.enabled.forEach(function(bitRate) {
            commands.push({
                'ffmpeg': createFFmpegCommand(profiles.command, inputFilePath, bitRate),
                'segmenter': createSegmenterCommand(inputFilePath, bitRate),
                'bitRate': bitRate
            });
        });
        console.log(sys.inspect(commands));
        console.log("\n")
        return commands;
    }

    function createTempOutputFileName(inputFilePath, bitRate) {
        return [inputFilePath, '_', bitRate].join('');
    }

    function createTempOutputFileName(inputFilePath, bitRate) {
        return [inputFilePath, '_', bitRate].join('');
    }

    function createMPEGTSPrefix(inputFilePath, bitRate){
        return [inputFilePath.split('/').pop(), '_', bitRate, '_ts'].join('');
    }

    function createFFmpegCommand(command, inputFilePath, bitRate) {

        var tempOutputFile  = createTempOutputFileName(inputFilePath, bitRate);
        var fullCommand     = command.format(inputFilePath, bitRate, bitRate, bitRate, tempOutputFile);
        return fullCommand;
    }

    function createM3U8IndexFileName(inputFilePath, bitRate){
        return [inputFilePath.split('/').pop(), '_', bitRate, '_stream.m3u8'].join('');
    }

    function createSegmenterCommand(inputFilePath, bitRate) {
        var command = [
            SEGMENTER_LOCATION
            , createTempOutputFileName(inputFilePath, bitRate)
            , SEGMENT_DURATION
            , createMPEGTSPrefix(inputFilePath, bitRate)
            , createM3U8IndexFileName(inputFilePath, bitRate)
            , HTTP_PREFIX + FILE_NAME + '/'
        ].join(' ');
        return command;
    }

    function getIndexFilesForAllActiveProfiles (inputFilePath) {
        var indexFiles = [];
        profiles.enabled.forEach(function(bitRate) {
            indexFiles.push({
                'url': [
                        HTTP_PREFIX + FILE_NAME + '/'
                    , createM3U8IndexFileName(inputFilePath, bitRate)
                ].join('')
                , 'bitRate': bitRate
            });
        });
        console.log(sys.inspect(indexFiles));
        console.log("\n")
        return indexFiles;
    }

    function writeVariableBitRateIndexFile(inputFilePath, indexFiles) {
        var fileName = [STREAM_OUTPUT_DIR + FILE_NAME + '/', inputFilePath.split('/').pop(), '_var_stream.m3u8'].join('')
            , contents = ['#EXTM3U\n'];

        indexFiles.forEach(function(file) {
            contents.push('#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH='+file.bitRate+'\n'+file.url+'\n');
        })

        fs.writeFileSync(fileName, contents.join(''));

        return fileName.split('/').pop();
    }

    function respondUpload(stream, inputFilePath, indexFiles) {
        var variableBitRateIndexFile = writeVariableBitRateIndexFile(inputFilePath, indexFiles);

        var insert = {
            file_name : FILE_NAME,
            file_path : HTTP_PREFIX + FILE_NAME + '/' + variableBitRateIndexFile
        }

        Database.insertToTable("videosUpload", insert, Object.keys(insert), function(err)
        {
            if (err) {
                stream.write({err: 'Error in processing the uploaded video'});
                stream.end();
                return;
            }

            stream.write({end: true});
            stream.end();
            return;
        });
    }


    this.getCommandsForAllActiveProfiles        = getCommandsForAllActiveProfiles;
    this.getIndexFilesForAllActiveProfiles      = getIndexFilesForAllActiveProfiles;
    this.respondUpload                          = respondUpload;
})();




exports.Videos = Videos;


