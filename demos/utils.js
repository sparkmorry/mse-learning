function GET(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function(e) {
    if (xhr.status != 200) {
      console.warn('Unexpected status code ' + xhr.status + ' for ' + url);
      return false;
    }
    callback(xhr.response);
  };
  xhr.send();
}