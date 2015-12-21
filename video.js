var Database    = require("./server/database.js").Database;
var config      = require('./config');
var fs          = require('fs');
var Videos      = require("./server/videos.js").Videos;
var nexpect     = require("nexpect");


var supportedTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/x-ms-wmv'
];

var uploadPath     = __dirname + '/public/videosUpload';
var streamPath     = __dirname + '/public/streams';

exports.list = function (stream, meta) {

    Database.poolQuery("SELECT * FROM videosUpload", [], function (err, results) {
        if (err) {
            stream.write({err: 'Error in processing request'});
            return;
        }

        if (!results) {
            stream.write({files: []});
            return;
        }

        var data = JSON.stringify(results);

        stream.write({files: data});
    });
}

exports.upload = function(stream, meta) {

    if (!~supportedTypes.indexOf(meta.type)) {
        stream.write({err: 'Unsupported type: ' + meta.type});
        stream.end();
        return;
    }

    var inputFilePath   = uploadPath + '/' + meta.name;

    fs.exists(inputFilePath, function(yes) {
        if (yes) {
            stream.write({err: 'Duplicate file upload: ' + meta.name});
            stream.end();
            return;
        }

        var file = fs.createWriteStream(inputFilePath);

        stream.pipe(file);

        stream.on('data', function (data){
            stream.write({rx : data.length / meta.size});
        });

        stream.on ('end', function(){
            stream.write({end: true, upload_path: inputFilePath});
            stream.end();
            return;
        });

    });
}

exports.process = function(stream, meta) {

    var inputFilePath   = meta.inputUploadPath;

    var commands        = Videos.getCommandsForAllActiveProfiles(meta.name, inputFilePath);

    var indexFiles      = Videos.getIndexFilesForAllActiveProfiles(inputFilePath);

    var i = commands.length;

    commands.forEach(function(command) {
        console.log(command.segmenter);

        nexpect.spawn(command.ffmpeg).run(function(err){
            if (err) {
                throw err;
            }
            console.log("run ffmpeg: " + command.ffmpeg);
            nexpect
                .spawn(command.segmenter)
                .run(function(err) {
                    if (err) throw err;
                    console.log("ran segmenter: " + command.segmenter);
                    i--;
                    if (i === 0) Videos.respondUpload(stream, inputFilePath, indexFiles);
                })
        })
    });
}

exports.request = function (stream, meta) {
    stream.write({src: '/videosUpload/' + meta.name });
}
