'use strict';
import React from 'react';
import { getPreSignedUrl, getSupportedTypes } from '../recordUtil.js';
export default class Record extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      mediaRecorder: null,
      stream: null,
      streamVidUrl: null,
      toggleRecText: 'Start Recording',
      isRec: false,
      blobs: [],
      superBlob: null,
      recVidUrl: null,
      link: ''
    }
    //Bind functions to component
    this.requestUserMedia = this.requestUserMedia.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleError = this.handleError.bind(this);
    this.toggleRec = this.toggleRec.bind(this);
    this.handleDataAvailable = this.handleDataAvailable.bind(this);
    this.playRec = this.playRec.bind(this);
    this.uploadRec = this.uploadRec.bind(this);
  }

  componentDidMount() {

    // var getQuestion = function(txt) {
    //   this.setState({
    //     question: txt
    //   })
    // }.bind(this);

    // $.ajax({
    //   method: 'GET',
    //   url: '/api/questions',
    //   success: function(data) {
    //     getQuestion(data[0].txt);
    //   }
    // })
    this.requestUserMedia()
  }
  render() {
    return (
      <div>
        <h1> Record a Video </h1>
        <video id="gum" src={this.state.streamVidUrl} autoPlay muted></video>
        <div>
          <button id="record" onClick={this.toggleRec}>{this.state.toggleRecText}</button>
          <button id="play" onClick={this.playRec}>Play</button>
          <button id="upload" onClick={this.uploadRec}>Share</button>
        </div>
        <video id="recorded" autoPlay loop src={this.state.recVidUrl}></video>
        <input value={this.state.link} />
      </div>
    )
  }

  requestUserMedia() {
    //Use native web api for Media Recorder (https://developers.google.com/web/updates/2016/01/mediarecorder)
    //to get the user audio and video
    navigator.mediaDevices.getUserMedia({audio: true, video: true}).
    then(this.handleConnect).catch(this.handleError);
  }

  handleConnect(stream) {
    //Set the stream state
    //Take user media and create a url that will be appended to the video tag in the DOM
    console.log('Stream connected'); 
    this.setState({
      stream: stream,
      streamVidUrl: window.URL.createObjectURL(stream)
    })
  }

  handleError(error) {
    //Catch and log error on request of user media
    console.log('error in request of user media:', error);
  }

  toggleRec() {
    if (this.state.isRec) {
      this.stopRec()
    } else {
      this.startRec()
    }
  }

  startRec() {  
    //Check browswer and set the supported types to options
    let options = getSupportedTypes()
    //Toggle button text and set recording boolean to true
    //Instantiate MediaRecorder
    let mediaRecorder = new MediaRecorder(this.state.stream, options)
    this.setState({
      toggleRecText: 'Stop Recording',
      isRec: true,
      mediaRecorder: mediaRecorder,
      blobs: []
    })

    //When data becomes available, call function to handle the data
    mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);
    mediaRecorder.start(10); // collect 10ms of data
  }

  handleDataAvailable(event) {
    //If there is data add the data to the blobs array
    if (event.data && event.data.size > 0) {
      this.setState({
        blobs: this.state.blobs.concat(event.data)
      })
    }
  }

  stopRec() {
    //Stop the mediaRecorder and toggle
    this.state.mediaRecorder.stop();
    console.log('Recorded Blobs:', this.state.blobs)
    //Create a new blob from the array of blobs
    let options = {
      type: 'video/webm'
    }
    let superBlob = new Blob(this.state.blobs, options)
    this.setState({
      toggleRecText: 'Start Recording',
      isRec: false,
      superBlob: superBlob
    })
  }

  playRec() {
    //Give the video element control buttons
    document.getElementById('recorded').controls = true
    //Allow user to play back recording
    console.log('the super blob', this.state.superBlob);
    this.setState({
      recVidUrl: window.URL.createObjectURL(this.state.superBlob)
    })
  }


  uploadRec() {
    //Get the pre-signed url from the server, data in promise is in the following format
    // { preSignedUrl: examplePreSignedUrl, publicUrl: examplePublicUrl, superBlob: exampleSuperBlob}
    let putObjectToS3 = this.putObjectToS3.bind(this);
    let postVideoUrl = this.postVideoUrl.bind(this);

    getPreSignedUrl()
    .then((data) => {
      //Upload data to S3 with pre-signed url
      return putObjectToS3(data, postVideoUrl)
    })
  }

  putObjectToS3(data, callback)  {
    $.ajax({
      type: 'PUT', 
      data: this.state.superBlob, 
      url: data.preSignedUrl, 
      processData: false,
      contentType: 'video/webm', 
      success: function(resp){
        //If successful, post video url to db
        callback(data.publicUrl)
      },
      error: function() {
        return 'error uploading to s3'
      }
    })
  }

  postVideoUrl(url) {
    let setVideoLink = (link) => {
      this.setState({
        link: `${window.location.origin}/videos/${link}`
      })
    }
    //Post to server with publicURL of s3 video
    let data = {
      publicUrl: url
    }
    $.ajax({
      type: 'POST', 
      data: data,
      url: '/api/videos', 
      success: function(data){
        //If successful, post video url to db
        setVideoLink(data.code)
      },
      error: function() {
        return 'error uploading to s3'
      }
    })
  }
}