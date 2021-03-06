var express = require('express');
var uuid = require('node-uuid');
var multer = require('multer');
var ffmpeg = require('ffmpeg');
var path = require("path");
var Video = require('../model/video');
var Tutorial = require('../model/tutorial');
var router = express.Router();

/*
    File Upload settings
 */

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './static/')
    },
    filename: function (req, file, cb) {
        cb(null, uuid.v4() + path.extname(file.originalname));
    }
});

var upload = multer({ storage: storage });

/*
 Router '/video'
 */

/**
 * @api {get} /video Retrieve all Video Info
 * @apiName GetAllInfo
 * @apiGroup Video
 *
 * @apiUse VideoSuccess
 */
router.get('/', function (req, res) {
    Video.find({}, function(error, videos){
        if(error){
            res.status(500).send({
                is_success: false,
                msg: String(error)
            });
        } else {
            res.send(videos)
        }
    })
});

/**
 * @api {post} /video Upload a Video
 * @apiName PostVideo
 * @apiGroup Video
 *
 * @apiUse VideoParam
 * @apiParam {Object} file File Object
 * @apiParam {String} tutorial_id Tutorial ID
 *
 * @apiSuccess {Boolean} is_success Request Success
 * @apiSuccess {String} video_id ID of Video created
 */
router.post('/', upload.any(), function (req, res) {
    try {
        console.log('start processing the video...');
        var process = new ffmpeg(req.files[0].path);
        
        console.log(req.files[0]);
        
        process.then(extract_frames_from_video, function(error){
            res.status(500).send({
                is_success: false,
                msg: String(error)
            });
        });

        function extract_frames_from_video(video) {
            console.log('extract frames from video...');
            video.fnExtractFrameToJPG('./static/' + req.files[0].filename.split('.')[0], {
                frame_rate: 0.5,
                number: 5,
                file_name: req.files[0].filename
            }, create_video);

            function create_video(error, files) {

                if (error){
                    res.status(500).send({
                        is_success: false,
                        msg: String(error)
                    });
                } else {
                    if(files){
                        for (var i = 0; i < files.length; i++) {
                            files[i] = files[i].substring(1)
                        }

                        console.log('created preview pictures: ' + files);
                    } else {
                        console.log('no preview pictures created');
                    }

                    var new_video = new Video({
                        name: req.body.name,
                        description: req.body.description,
                        url: '/' + req.files[0].path,
                        length_seconds: video.metadata.duration.seconds,
                        preview_frames_url: files
                    });

                    new_video.preview_frames_url = files;

                    new_video.save(function(error, data){
                        if(error){
                            res.status(500).send({
                                is_success: false,
                                msg: String(error)
                            });
                        } else {
                            if(req.body.tutorial_id){
                                Tutorial.findByIdAndUpdate(req.body.tutorial_id, {$push: {videos: data._id}}, function (error){
                                    if(error){
                                        res.status(500).send({
                                            is_success: false,
                                            msg: String(error)
                                        });
                                    }
                                    res.send({
                                        is_success: true,
                                        video_id: data._id
                                    })
                                });
                            } else {
                                res.send({
                                    is_success: true,
                                    video_id: data._id
                                })
                            }
                        }
                    });
                }
            }
        }
        
    } catch (e) {
        res.status(500).send({msg: e.code + ':' + e.msg});
    }
});

/**
 * @api {get} /video/:id Retrieve Video Info
 * @apiName GetVideo
 * @apiGroup Video
 *
 * @apiParam {String} id Video ID
 *
 * @apiUse VideoSuccess
 */
router.get('/:id', function (req, res) {
    var video_id = req.params.id;
    
    Video.findById(video_id, function(error, video){
        if(error){
            res.status(500).send({
                is_success: false,
                msg: String(error)
            });
        } else {
            if(video){
                res.send(video)
            } else {
                res.status(404).send({
                    'msg': 'video ' + video_id + ' not found'
                })
            }

        }
    })
});

/**
 * @api {put} /video/:id Update Video Info
 * @apiName PutVideo
 * @apiGroup Video
 *
 * @apiParam {String} id Video ID
 * @apiUse VideoParam
 *
 * @apiSuccess {Boolean} is_success Request Success
 */
router.put('/:id', function (req, res) {
    var video_id = req.params.id;
    var updated_video = req.body;

    Video.findByIdAndUpdate(video_id, updated_video, function(error){
        if(error){
            res.status(500).send({
                is_success: false,
                msg: String(error)
            });
        } else {
            res.send({
                is_success: true
            })
        }
    })
});

/**
 * @api {put} /video/:id/viewed Increment Video View Count
 * @apiName PutVideoView
 * @apiGroup Video
 *
 * @apiParam {String} id Video ID
 * @apiUse VideoParam
 *
 * @apiSuccess {Boolean} is_success Request Success
 * @apiSuccess {Number} view_count Number of views of the video
 */
router.put('/:id/viewed', function (req, res) {
    var video_id = req.params.id;
    
    Video.findByIdAndUpdate(video_id, {$inc: {view_count:1}}, {new: true}, function(error, video){
        if(error){
            res.status(500).send({
                is_success: false,
                msg: String(error),
                view_count: -1
            });
        } else {
            res.send({
                is_success: true,
                view_count: video.view_count
            });
        }
    });
});

/**
 * @api {delete} /video/:id Delete Video
 * @apiName DeleteVideo
 * @apiGroup Video
 *
 * @apiParam {String} id Video ID
 *
 * @apiSuccess {Boolean} is_success Request Success
 */
router.delete('/:id', function (req, res) {
    var video_id = req.params.id;

    Video.findByIdAndRemove(video_id, function(error){
        if(error){
            res.status(500).send({
                is_success: false,
                msg: String(error)
            });
        } else {
            res.send({
                is_success: true
            })
        }
    })
});

module.exports = router;