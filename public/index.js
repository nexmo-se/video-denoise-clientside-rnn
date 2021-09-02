let roomName='12';
let myName="";
let remoteName="";
let isSender=false;
let Module = null;
let mediaStream = null;
let frameBuffer = [];
let outputStream = null;
let suppressNoise = false;
function handleError(error) {
        if (error) {
          alert(error.message);
        }
}

function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function bodyLoaded(){
    initializeNoiseSuppressionModule();
    
}
function start(){
    setupAudioPipeline();
    $.get("/token?u="+roomName, function(data){
      try{
        initializeSession(data.apikey, data.sessionid,data.token);
      }
      catch(e){
        console.log(data);
        alert("Error" + e)
      }
    });
}


function noiseToggle(){
    if(suppressNoise === false){
        suppressNoise = true;
        document.getElementById("noiseToggleBtn").innerHTML = "Denoiser ON";
    }else{
        suppressNoise = false;
        document.getElementById("noiseToggleBtn").innerHTML = "Denoiser OFF";
    }
}

function setupAudioPipeline(){
  var audioContext;
  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
  } catch (e) {
    alert('Web Audio API is not supported in this browser.');
  }

  // Check if there is microphone input.
  navigator.getUserMedia = navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.mozGetUserMedia ||
                           navigator.msGetUserMedia;
  if (!navigator.getUserMedia) {
    alert("getUserMedia() is not supported in your browser.");
    return;
  }
  var inputBuffer = [];
  var outputBuffer = [];
  var bufferSize = 512;
  var sampleRate = audioContext.sampleRate;
  var processingNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
  processingNode.onaudioprocess = function (e) {
    var input = e.inputBuffer.getChannelData(0);
    var output = e.outputBuffer.getChannelData(0);

    // Drain input buffer.
    for (let i = 0; i < bufferSize; i++) {
      inputBuffer.push(input[i]);
    }
    
    while (inputBuffer.length >= 480) {
      for (let i = 0; i < 480; i++) {
        frameBuffer[i] = inputBuffer.shift();
      }
      // Process Frame
      if (suppressNoise) {
        removeNoise(frameBuffer);
      }
      for (let i = 0; i < 480; i++) {
        outputBuffer.push(frameBuffer[i]);
      }
    }
    // Not enough data, exit early, etherwise the AnalyserNode returns NaNs.
    if (outputBuffer.length < bufferSize) {
      return;
    }
    // Flush output buffer.
    for (let i = 0; i < bufferSize; i++) {
      output[i] = outputBuffer.shift();
    }
  }
  navigator.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
  }, function (stream) {
    mediaStream = stream;
    var microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(processingNode);
    outputStream = audioContext.createMediaStreamDestination();
    processingNode.connect(outputStream);
    
  }, function (e) {
    if (e.name === "PermissionDeniedError") {
      microphoneAccessIsNotAllowed = true;
      alert("You'll need to provied access to your microphone for this web page to work.");
    }
  });
}

function initializeNoiseSuppressionModule() {
  if (Module) {
    return;
  }
  Module = {
    noExitRuntime: true,
    noInitialRun: true,
    preInit: [],
    preRun: [],
    postRun: [function () {
      console.log(`Loaded Javascript Module OK`);
    }],
    memoryInitializerPrefixURL: "bin/",
    arguments: ['input.ivf', 'output.raw']
  };
  NoiseModule(Module);
  Module.st = Module._rnnoise_create();
  Module.ptr = Module._malloc(480 * 4);
}
function removeNoise(buffer) {
    let ptr = Module.ptr;
    let st = Module.st;
    for (let i = 0; i < 480; i++) {
      Module.HEAPF32[(ptr >> 2) + i] = buffer[i] * 32768;
    }
    Module._rnnoise_process_frame(st, ptr, ptr);
    for (let i = 0; i < 480; i++) {
      buffer[i] = Module.HEAPF32[(ptr >> 2) + i] / 32768;
    }
}
  
function initializeSession(apiKey,sessionId,token) {
      OTSession = OT.initSession(apiKey, sessionId);
      OTSession.on('streamCreated', function(event) {
	  let streamName = event.stream.name;
          subscriber = OTSession.subscribe(event.stream, 'layoutContainer', {
              insertMode: 'append',
              width: '100%',
              height: '100%'
          }, handleError);
	  layout();
      });
      
      OTSession.on('streamDestroyed', function(event) {
      });
      startPublishing(token);
}

function startPublishing(token){
    let pname="User";
    OTSession.connect(token, function(error) {
      if (error) {
              handleError(error);
          } else {
               publisher = OT.initPublisher('layoutContainer', {
                insertMode: 'append',
		name: pname,
		resolution: "640x480",
                width: '100%',
                height: '100%',
                videoSource: true,
                audioSource: outputStream.stream.getAudioTracks()[0]
              }, (err) => {
                if (err) {
                  alert(err.message);
                }
                else{
                  OTSession.publish(publisher,function(error) {
                    if (error) {
                      console.log(error);
                    } else {
                      console.log('Publishing a stream.');
                      document.getElementById("connectBtn").style.visibility="hidden";
		              layout();
                    }
                  });            
                }
              });
          }
      });

}

function listInputs() {
        return new Promise((resolve, reject) => {
          OT.getDevices((error, devices) => {
            if (error) {
              reject(error);
            } else {
              resolve(devices);
            }
          });
        });
}

async function listAudioInputs() {
        try {
          const devices = await listInputs();
          const filteredDevices = devices.filter(device => device.kind === 'audioInput');
          return Promise.resolve(filteredDevices);
        } catch (error) {
          return Promise.reject(error);
        }
}
