(function () {
'use strict';

var $vlog = document.getElementById('vlog');
var $video = document.getElementById('video');

var loadstart = 0;
var loadedmetadata = 0;
var eventTester = function(e) {
  $video.addEventListener(e, function(data) {
    var t = (new Date()).getTime();
    createvlog(t + ' ' + e);
    if (e == 'loadedmetadata') {
      loadedmetadata = t;
      createvlog((loadedmetadata - loadstart) + 'ms');
    } else if (e == 'loadstart') {
      loadstart = t;
    } else {
      if ($video.buffered.length > 0) createvlog('buffered' + $video.buffered.start(0) + ',' + $video.buffered.end(0));
    }
  }, false);
};

function createvlog(text) {
  var p = document.createElement('p');
  p.innerHTML = text;
  $vlog.appendChild(p);
}

eventTester("loadstart"); //客户端开始请求数据
eventTester("progress"); //客户端正在请求数据
eventTester("suspend"); //延迟下载
eventTester("abort"); //客户端主动终止下载（不是因为错误引起）
eventTester("loadstart"); //客户端开始请求数据
eventTester("progress"); //客户端正在请求数据
eventTester("suspend"); //延迟下载
eventTester("abort"); //客户端主动终止下载（不是因为错误引起），
eventTester("error"); //请求数据时遇到错误
eventTester("stalled"); //网速失速
eventTester("play"); //play()和autoplay开始播放时触发
eventTester("pause"); //pause()触发
eventTester("loadedmetadata"); //成功获取资源长度
eventTester("loadeddata"); //
eventTester("waiting"); //等待数据，并非错误
eventTester("playing"); //开始回放
eventTester("canplay"); //可以播放，但中途可能因为加载而暂停
eventTester("canplaythrough"); //可以播放，歌曲全部加载完毕
eventTester("seeking"); //寻找中
eventTester("seeked"); //寻找完毕
// eventTester("timeupdate"); //播放时间改变
eventTester("ended"); //播放结束
eventTester("ratechange"); //播放速率改变
eventTester("durationchange"); //资源长度改变
eventTester("volumechange"); //音量改变

var ms = new MediaSource();
var $video$1 = document.getElementById('video');
var $log = document.getElementById('log');
$video$1.src = window.URL.createObjectURL(ms);
ms.addEventListener('sourceopen', onMediaSourceOpen);

function onMediaSourceOpen() {
  createlog('media source open');
}

function createlog(text) {
  var p = document.createElement('p');
  p.innerHTML = text;
  $log.appendChild(p);
}

}());
//# sourceMappingURL=segmp4.js.map
