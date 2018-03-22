var worker, sampleImageData, sampleVideoData;;
var inputElement = document.querySelector("#input");
var outputElement = document.querySelector("#output");
var filesElement = document.querySelector("#files");
var running = false;
var isWorkerLoaded = false;
var isSupported = (function() {
  return document.querySelector && window.URL && window.Worker;
})();

// 获取视频
function retrieveSampleVideo(file) {
  var video = file || "bigbuckbunny.webm";
  var oReq = new XMLHttpRequest();
  oReq.open("GET", video, true);
  oReq.responseType = "arraybuffer";

  oReq.onload = function(oEvent) {
    var arrayBuffer = oReq.response;
    if (arrayBuffer) {
      sampleVideoData = new Uint8Array(arrayBuffer);
    }
  };

  oReq.send(null);
}
// 获取图片
function retrieveSampleImage() {
  var oReq = new XMLHttpRequest();
  oReq.open("GET", "bigbuckbunny.jpg", true);
  oReq.responseType = "arraybuffer";

  oReq.onload = function(oEvent) {
    var arrayBuffer = oReq.response;
    if (arrayBuffer) {
      sampleImageData = new Uint8Array(arrayBuffer);
    }
  };

  oReq.send(null);
}

function isReady() {
  return !running && isWorkerLoaded && sampleImageData && sampleVideoData;
}

function startRunning() {
  document.querySelector("#image-loader").style.visibility = "visible";
  outputElement.className = "";
  filesElement.innerHTML = "";
  running = true;
}

function stopRunning() {
  document.querySelector("#image-loader").style.visibility = "hidden";
  running = false;
}

function parseArguments(text) {
  text = text.replace(/\s+/g, ' ');
  var args = [];
  // Allow double quotes to not split args.
  text.split('"').forEach(function(t, i) {
    t = t.trim();
    if ((i % 2) === 1) {
      args.push(t);
    } else {
      args = args.concat(t.split(" "));
    }
  });
  return args;
}

function runCommand(text) {
  if (isReady()) {
    startRunning();
    var args = parseArguments(text);
    console.log(args);
    worker.postMessage({
      type: "run",
      arguments: args,
      MEMFS: [{
        "name": "input.jpeg",
        "data": sampleImageData
      }, {
        "name": "input.mp4",
        "data": sampleVideoData
      }]
    });
  }
}

function getDownloadLink(fileData, fileName) {
  if (fileName.match(/\.jpeg|\.gif|\.jpg|\.png/)) {
    var blob = new Blob([fileData]);
    var src = window.URL.createObjectURL(blob);
    var img = document.createElement('img');

    img.src = src;
    return img;
  } else {
    var a = document.createElement('a');
    a.download = fileName;
    var blob = new Blob([fileData]);
    var src = window.URL.createObjectURL(blob);
    if (fileName === 'video.hevc') {
      window.hevcUrl = src;
    } else if (fileName === 'audio.mp3') {
      window.mp3Url = src;
      document.getElementById('audio').src = src;
    }
    a.href = src;
    a.textContent = 'Click here to download ' + fileName + "!";
    return a;
  }
}

function initWorker() {
  var stdout = "";
  var stderr = "";
  worker = new Worker("./ffmpeg-worker-mp4.js");
  worker.onmessage = function(e) {
    var msg = e.data;
    switch (msg.type) {
      case "ready":
        isWorkerLoaded = true;
        worker.postMessage({
          type: "run",
          arguments: ["-version"]
        });
        break;
      case "stdout":
        outputElement.textContent += msg.data + "\n";

        // stdout += msg.data + "\n";
        break;
      case "stderr":
        stderr += msg.data + "\n";
        outputElement.textContent += msg.data + "\n";
        break;
      case "done":
        stopRunning();
        var buffers = msg.data.MEMFS;
        if (buffers.length) {
          outputElement.className = "closed";
        }
        buffers.forEach(function(file) {
          filesElement.appendChild(getDownloadLink(file.data, file.name));
        });
        break;
      case "exit":
        console.log("Process exited with code " + msg.data);
        console.log(stdout);
        worker.terminate();
        break;
    }
  };
}

function initWorker2() {
  worker = new Worker("ffmpeg-worker-mp4.js");
  worker.onmessage = function(event) {
    var message = event.data;
    if (message.type == "ready") {
      isWorkerLoaded = true;
      worker.postMessage({
        type: "command",
        arguments: ["-help"]
      });
    } else if (message.type == "stdout") {
      outputElement.textContent += message.data + "\n";
    } else if (message.type == "start") {
      outputElement.textContent = "Worker has received command\n";
    } else if (message.type == "done") {
      stopRunning();
      var buffers = message.data;
      if (buffers.length) {
        outputElement.className = "closed";
      }
      buffers.forEach(function(file) {
        filesElement.appendChild(getDownloadLink(file.data, file.name));
      });
    }
  };
}

function getHEVC() {
  runCommand('-i input.mp4 -c:v copy -bsf hevc_mp4toannexb -f rawvideo video.hevc')
}

function getMP3() {
  runCommand('-i input.mp4 -b:a 192K -vn audio.mp3')
}

document.addEventListener("DOMContentLoaded", function() {
  initWorker();
  retrieveSampleVideo('hd_265.mp4');
  retrieveSampleImage();

  document.querySelector("#run").addEventListener("click", function() {
    runCommand(inputElement.value);
  });
});


var VIDEO_URL = "out.hevc";
var player = null;
window.onload = function() {
  var video = document.getElementById("video");
  var status = document.getElementById("status");
  var playback = function(event) {
    event.preventDefault();
    if (player) {
      player.stop();
    }
    console.log("Playing with libde265", libde265.de265_get_version());
    player = new libde265.RawPlayer(video);
    player.set_status_callback(function(msg, fps) {
      player.disable_filters(true);
      switch (msg) {
        case "loading":
          status.innerHTML = "Loading movie...";
          break;
        case "initializing":
          status.innerHTML = "Initializing...";
          break;
        case "playing":
          status.innerHTML = "Playing...";
          break;
        case "stopped":
          status.innerHTML = "";
          break;
        case "fps":
          status.innerHTML = Number(fps).toFixed(2) + " fps";
          break;
        default:
          status.innerHTML = msg;
      }
    });
    // player.playback(VIDEO_URL);
    player.playback(hevcUrl);
    document.getElementById('audio').play();
  };
  var button = document.getElementById("play");
  if (button.addEventListener) {
    button.addEventListener("click", playback, false);
  } else if (button.attachEvent) {
    button.attachEvent('onclick', playback);
  }
};