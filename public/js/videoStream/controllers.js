var videoStreamCtrl = angular.module('videoStreamCtrl', []);

videoStreamCtrl.controller('mainCtrl', function($scope) {

    $scope.chosenVideo = null;

    var client = new BinaryClient('ws://localhost:6001' + '/video-streaming');

    function fizzle(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function emit(event, data, file) {
        file        = file || {};
        data        = data || {};
        data.event  = event;

        return client.send(file, data);
    }

    var tx      = 0;

    $scope.files = [];

    $scope.processVideo = function (chosenVideo) {
        console.log( chosenVideo.file_path);

        $('#video').attr('src', chosenVideo.file_path);
    };

    $scope.video = {
        list: function() {
            var stream = emit('list');

            stream.on('data', function(data){

                var files = JSON.parse(data.files);

                var phase = $scope.$root.$$phase;

                if (phase == '$apply' || phase == '$digest') {
                    $scope.$eval(function(){
                        $scope.files = files;

                    })
                } else {
                    $scope.$apply(function(){
                        $scope.files = files;
                    })
                }
            });

            stream.on('error', function(error){
                var box = bootbox.alert(error.error);
                box.find(".btn-primary").removeClass("btn-primary").addClass("btn btn-sm");
            })


        },

        request: function(file_path) {
            var myplayer = videojs('video');

            myplayer.ready(function() {
                myplayer.src(file_path);
                myplayer.load();
                myplayer.play();
            });
        },

        upload: function(file) {
            var stream = emit('upload', {
                name  : file.name,
                size  : file.size,
                type  : file.type
            },  file);

            stream.on('data', function (data) {
                var msg = "";

                if (data.end) {
                    msg = "Upload complete: " + file.name;
                    $scope.video.process(file.name, data.upload_path);

                } else if (data.rx) {
                    msg = Math.round(tx += data.rx * 100) + '% complete';

                } else {
                    // assume error
                    msg = data.err;
                }

                $('#progress').text(msg)

            });

            stream.on('error', function (error){
                var box = bootbox.alert(error);
                box.find(".btn-primary").removeClass("btn-primary").addClass("btn btn-sm");
            });
        },

        process: function(fileName, uploadPath) {

            var box = bootbox.alert("Wait for processing the uploaded video....", function(){
                var stream = emit('process', {
                    name           : fileName,
                    inputUploadPath: uploadPath
                });

                stream.on('data', function (data) {

                    if (data.end) {
                        showPopup("Process the uploaded file successfully!");
                        $scope.video.list();
                    } else {
                        // assume error
                        var box = bootbox.alert(data.err);
                        box.find(".btn-primary").removeClass("btn-primary").addClass("btn btn-sm");
                    }
                });

                stream.on('error', function (error){
                    var box = bootbox.alert(error);
                    box.find(".btn-primary").removeClass("btn-primary").addClass("btn btn-sm");
                });
            });

            box.find(".btn-primary").removeClass("btn-primary").addClass("btn btn-sm");

        }

    };

    function setupDragDrop(e) {

        fizzle(e);

        var file;

        file = e.originalEvent.dataTransfer.files[0];

        tx = 0;

        $scope.video.upload(file);

    }


    $(document).ready(function () {
        $('#video').attr({
            controls : true,
            autoplay : true,
            preload  : 'auto'
        });
    });

    client.on('open', function(){
        $scope.video.list();

        $('#upload-box').on('dragenter', fizzle);
        $('#upload-box').on('dragover', fizzle);
        $('#upload-box').on('drop', setupDragDrop);


    });
});