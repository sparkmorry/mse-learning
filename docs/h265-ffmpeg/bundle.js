(function() {
  'use strict';

  function loadWASM() {
    return new Promise((resolve, reject) => {
      self.fetch('./videox-decoder-video-wasm.wasm')
        .then(response => response.arrayBuffer())
        .then(buffer => {
          // GLOBAL -- create custom event for complete glue script execution
          // Emscripten编译的函数如_grayScale，_malloc等会挂到全局环境下
          var script = document.createElement('script');
          script.onload = buildWam;
          // END GLOBAL
          script.src = './videox-decoder-video-wasm.js';
          document.body.appendChild(script);

          // 构建wam模块
          function buildWam() {
            // const decoderModule = DECODERWASM({});
            let wam = {};
            // Module.onRuntimeInitialized = function () {
            //   wam['setFile'] = Module.cwrap('setFile', 'number', ['number', 'number', 'number']);
            //   // console.log('WASM initialized done!');
            //   // if (form.file.value) {
            //   //     process();
            //   // }
            // };
            // console.log('Emscripten boilerplate loaded.');
            resolve(wam);
          }
        });
    });
  }

  class EventEmitter {
    on(key, listener) {
      if (!this._events) {
        this._events = {};
      }

      if (!this._events[key]) {
        this._events[key] = [];
      }

      if (
        !this._events[key].indexOf(listener) !== -1 &&
        typeof listener === 'function'
      ) {
        this._events[key].push(listener);
      }

      return this;
    }

    emit(key) {
      if (!this._events || !this._events[key]) return;
      let args = Array.prototype.slice.call(arguments, 1) || [];
      let listeners = this._events[key];
      let i = 0;
      let l = listeners.length;
      for (i; i < l; i++) {
        listeners[i].apply(this, args);
      }
      return this;
    }

    off(key, listener) {
      if (!key && !listener) {
        this._events = {};
      }

      if (key && !listener) {
        delete this._events[key];
      }

      if (key && listener) {
        const listeners = this._events[key];
        const index = listeners.indexOf(listener);
        listeners.splice(index, 1);
      }
      return this;
    }
  }

  const TIME_OFFSET = 2082844800000;

  const Buffer = {
    /**
     * 拼接buffer
     */
    concat(bufferlist) {
      const byteLength = bufferlist.reduce((sum, buf) => sum + buf.byteLength, 0);
      const tmp = new Uint8Array(byteLength);

      let offset = 0;
      bufferlist.forEach(buffer => {
        tmp.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      });

      return tmp.buffer;
    },

    /**
     * 读取32位大端字节序
     */
    readUInt32BE(buffer, offset) {
      const arr = new Uint8Array(buffer);
      return (arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3];
    },

    /**
     * 读取24位大端字节序
     */
    readUInt24BE(buffer, offset) {
      const arr = new Uint8Array(buffer);
      return (arr[offset] << 16) | (arr[offset + 1] << 8) | arr[offset + 2];
    },

    /**
     * 读取16位大端字节序
     */
    readUInt16BE(buffer, offset) {
      const arr = new Uint8Array(buffer);
      return (arr[offset] << 8) | (arr[offset + 1]);
    },

    /**
     * 读取1字节
     */
    readUInt8(buffer, offset) {
      const arr = new Uint8Array(buffer);
      return arr[offset];
    },

    /**
     * 转化成字符串
     */
    readToString(buffer) {
      const uintArray = new Uint8Array(buffer);
      const encodedString = String.fromCharCode(...uintArray);
      const decodedString = decodeURIComponent(escape(encodedString));
      return decodedString;
    },

    /**
     * 转化成32位时间戳
     */
    readDate(buffer, offset) {
      return new Date(Buffer.readUInt32BE(buffer, offset) * 1000 - TIME_OFFSET);
    },

    /**
     * 转化成32位字符串拼接的浮点数
     */
    readFixed32(buffer, offset) {
      return Buffer.readUInt16BE(buffer, offset) + Buffer.readUInt16BE(buffer, offset + 2) / (256 * 256);
    },

    /**
     * 转化成16位字符串拼接的浮点数
     */
    readFixed16(buffer, offset) {
      return Buffer.readUInt8(buffer, offset) + Buffer.readUInt8(buffer, offset + 1) / 256;
    }
  };

  const Status = {
    Idle: 0,
    Connecting: 1,
    Buffering: 2,
    Error: 3,
    Complete: 4
  };

  class FetchLoader extends EventEmitter {
    constructor() {
      super();

      this._url = '';
      this._receivedLength = 0;
      this._status = Status.Idle;
      this.requestAbort = false;
      this._cacheBufferList = [];
    }

    open(url) {
      this._url = url;

      this._status = Status.Connecting;

      window
        .fetch(this._url)
        .then(res => {
          if (res.ok && res.status >= 200 && res.status <= 299) {
            return this._pump.call(this, res.body.getReader());
          } else {
            this._status = Status.Error;
          }
        })
        .catch(err => {
          this._status = Status.Error;
        });
    }

    pause() {
      this.requestAbort = true;
    }

    _pump(reader) {
      // ReadableStreamReader
      return reader
        .read()
        .then(result => {
          if (result.done) {
            this._status = Status.Complete;
            this.emit('loadComplete', Buffer.concat(this._cacheBufferList));
            // const buffer = {
            //   chunk: Buffer.concat(...this._cacheBufferList),
            //   byteStart: 0,
            //   byteLength: this._receivedLength
            // };

          // this.emit('dataArrival', buffer);
          } else {
            if (this.requestAbort === true) {
              this.requestAbort = false;
              return reader.cancel();
            }
            this._status = Status.Buffering;
            let chunk = result.value.buffer;
            let byteStart = this._receivedLength;
            this._receivedLength += chunk.byteLength;
            this._cacheBufferList.push(chunk);
            this.emit('dataArrival', {
              chunk: chunk,
              byteStart: byteStart,
              byteLength: chunk.byteLength
            });

            this._pump(reader);
          }
        })
        .catch(err => {
          console.error(err);
        });
    }
  }

  // even though Rollup is bundling all your files together, errors and
  // logs will still point to your original source modules
  console.log('if you have sourcemaps enabled in your devtools, click on main.js:5 -->');
  loadWASM().then(wam => {
    Module.onRuntimeInitialized = function() {
      // setFile = Module.cwrap('setFile', 'number', ['number', 'number', 'number']);
    };
  });

  const loader = new FetchLoader();
  loader.open('https://sparkmorry.github.io/mse-learning/h265/hd_265.mp4');

  let buffer;
  loader.on('loadComplete', (e) => {
    buffer = new Uint8Array(e);
  });

  let memCanvas = document.createElement('canvas'),
    memContext = memCanvas.getContext('2d');
  let canvas = document.querySelector('#canvas'),
    ctx = canvas.getContext('2d');
  canvas.width = Math.max(600, window.innerWidth - 40);
  function drawImage(width, height, buffer) {
    let imageData = ctx.createImageData(width, height);
    let k = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (i && i % 3 === 0) {
        imageData.data[k++] = 255;
      }
      imageData.data[k++] = buffer[i];
    }
    imageData.data[k] = 255;
    memCanvas.width = width;
    memCanvas.height = height;
    canvas.height = canvas.width * height / width;
    memContext.putImageData(imageData, 0, 0, 0, 0, width, height);
    ctx.drawImage(memCanvas, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
  }

  let lastTs = 0;
  let currentTs = 0;
  let framePtrList = [];
  window.cacheFrame = (ptr) => {
    currentTs = performance.now();
    console.log('decode duration', currentTs - lastTs);
    framePtrList.push(ptr);
    lastTs = currentTs;
  };
  const draw = (ptr) => {
    let width = Module.HEAPU32[ptr / 4];
    let height = Module.HEAPU32[ptr / 4 + 1];
    let imgBufferPtr = Module.HEAPU32[ptr / 4 + 2];
    let imageBuffer = Module.HEAPU8.subarray(imgBufferPtr, imgBufferPtr + width * height * 3);
    if (!width || !height) {
      return;
    }
    drawImage(width, height, imageBuffer);
    Module._free(ptr);
    Module._free(imgBufferPtr);
  };


  let playBtn = document.querySelector('#play');
  let tipDom = document.getElementById('tip');
  setTimeout(() => {
    tipDom.innerHTML = 'wasm加载完成，解码中…';
    let offset = Module._malloc(buffer.length);
    console.log(offset);
    Module.HEAP8.set(buffer, offset);
    // 好像单线程啊！！！会等执行完。。。
    Module._videox_decoder_init(offset, buffer.length);
    tipDom.innerHTML = '解码完成…播放中';
    setInterval(() => {
      const ptr = framePtrList.shift();
      draw(ptr);
    }, 40);
  // draw(offset, 0);
  }, 2 * 1000);

}());
//# sourceMappingURL=bundle.js.map
