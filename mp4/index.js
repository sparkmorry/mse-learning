// var videoUrl = 'http://tbfliving.alicdn.com/mediaplatform/ce3456e6-1916-48dc-b4cf-c1d9204c4a2e_2.m3u8';
var baseUrl = 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/video/720_2400000/dash';
var ms = new MediaSource();
var sourceBuffer;
var i = 0;
var numberOfChunks = 52;
var requesting = false;
var $video = document.getElementById('video');
var $log = document.getElementById('log');
$video.src = window.URL.createObjectURL(ms);
ms.addEventListener('sourceopen', onMediaSourceOpen);

function onMediaSourceOpen() {
  createlog('media source open');
}

function load() {
  createlog(`正在加载初始化信息...`);
  GET(`${baseUrl}/init.mp4`, function(videoChunk) {
    sourceBuffer = ms.addSourceBuffer('video/mp4; codecs="avc1.4d401f"');
    if (videoChunk) {
      sourceBuffer.appendBuffer(new Uint8Array(videoChunk));
      setTimeout(function() {
        createlog(`初始化信息成功！视频时长：${ms.duration}秒`);
      }, 100);
    }
    // $video.play();
    sourceBuffer.addEventListener('updateend', nextSegment);
  });
}

function loadmore() {
  if (requesting) {
    createlog(`请勿重复请求`);
    return;
  }
  requesting = true;
  createlog(`正在请求片段${i}...`);
  GET(`${baseUrl}/segment_${i}.m4s`, function(videoChunk) {
    if (videoChunk) {
      sourceBuffer.appendBuffer(new Uint8Array(videoChunk));
      i++;
      requesting = false;
    }
  });
}

function nextSegment() {
  if ($video.buffered.length > 0) createlog(`片段${i-1}请求成功, 缓冲到${$video.buffered.end(0)}秒`);
  // GET('https://bitdash-a.akamaihd.net/content/MI201109210084_1/video/720_2400000/dash/segment_0.m4s', function(videoChunk) {
  //   if (videoChunk) {
  //     sourceBuffer.appendBuffer(new Uint8Array(videoChunk));
  //   }
  // });
}

function createlog(text) {
  var p = document.createElement('p');
  p.innerHTML = text;
  $log.appendChild(p);
}