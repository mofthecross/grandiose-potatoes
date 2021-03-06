'use strict';
import React from 'react';
import { getPreSignedUrl, getSupportedTypes, getQuestions, putObjectToS3, postVideoUrl } from '../recordUtil.js';
import {Questions} from './Questions.jsx';
export default class Record extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      mediaRecorder: null,
      stream: null,
      streamVidUrl: null,
      toggleRecText: 'Start Recording',
      isRec: false,
      blobs: [],
      superBlob: null,
      recVidUrl: null,
      link: '',
      allQuestions: null,
      currentQuestion: null,
      finishedRecording: false,
      uploading: false
    };
  }
  componentDidMount() {

    this.setInitialQuestions();
    this.requestUserMedia();

  }

  render() {
    return (
      <div className="col s8 offset-s2">

        <br/>
        <video className={this.state.finishedRecording ? 'hide' : ''} id="gum" src={this.state.streamVidUrl} autoPlay muted width="100%"></video>
        <video className={this.state.finishedRecording ? '' : 'hide'} id="recorded" autoPlay loop src={this.state.recVidUrl} width="100%"></video>

        <div>
          <br/>
          <a className="waves-effect waves-light btn" id="record" onClick={this.toggleRec.bind(this)}>{this.state.toggleRecText}</a>
          <a className={this.state.finishedRecording ? 'waves-effect waves-light btn' : 'hide waves-effect waves-light btn'} id="upload" onClick={this.uploadRec.bind(this)}>Share</a>
        </div>

        <div className={this.state.isRec ? '' : 'hide'}>
          <Questions question={this.state.currentQuestion}/>
          <a className="waves-effect waves-light btn" id="next" onClick={this.nextQuestion.bind(this)}>How about another question?</a>
        </div>

        <div className={this.state.uploading ? 'progress' : 'hide progress'}>
          <div className="indeterminate"></div>
        </div>

        <div className={this.state.link ? '' : 'hide'}>
          <input id='shareLink'value={this.state.link} />
          <a className="waves-effect waves-light btn"  onClick={this.copyToClipboard}>Copy</a>
        </div>
      </div>
    );
  }

  setInitialQuestions() {
    //Get questions from server
    getQuestions()
    .then((questionsArr) => {
      questionsArr = _.shuffle(questionsArr);
      console.log('This is the questionsArr: ', questionsArr);
      this.setState({
        currentQuestion: questionsArr.shift().txt,
        allQuestions: questionsArr
      });
    })
    .catch((err) => {
      throw err;
    });
  }

  copyToClipboard () {
    //Copy share link to clipboard
    $('#shareLink').select();
    document.execCommand("copy");
  };


  requestUserMedia() {
    //Use native web api for Media Recorder (https://developers.google.com/web/updates/2016/01/mediarecorder)
    //to get the user audio and video
    navigator.mediaDevices.getUserMedia({audio: true, video: true})
    .then((stream) => {
      this.handleConnect(stream);
    })
    .catch(this.handleError);
  }

  handleConnect(stream) {
    //Set the stream state
    //Take user media and create a url that will be added to the video tag src in the DOM
    console.log('Stream connected');
    this.setState({
      stream: stream,
      streamVidUrl: window.URL.createObjectURL(stream)
    });
  }

  handleError(error) {
    //Catch and log error on request of user media
    console.log('error in request of user media:', error);
  }

  toggleRec() {
    //If the user is recording invoke stopRec
    //else invoke startRec if the user is not recording
    if (this.state.isRec) {
      this.stopRec();
    } else {
      this.startRec();
    }
  }

  startRec() {
    //Check browswer and set the supported types to options variable
    let options = getSupportedTypes();
    //Toggle button text and set isRec boolean to true and finishedRecordingb boolean to false
    //Set blobs to an empty array 
    //Instantiate MediaRecorder 
    let mediaRecorder = new MediaRecorder(this.state.stream, options);
    this.setState({
      toggleRecText: 'Stop Recording',
      isRec: true,
      mediaRecorder: mediaRecorder,
      blobs: [],
      finishedRecording: false
    });

    //When data becomes available, call function to handle the data
    mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);
    mediaRecorder.start(10); // collect 10ms of data
  }

  handleDataAvailable(event) {
    //If there is data add the data to the blobs array
    if (event.data && event.data.size > 0) {
      this.setState({
        blobs: this.state.blobs.concat(event.data)
      });
    }
  }

  stopRec() {
    //Stop the mediaRecorder and toggle
    this.state.mediaRecorder.stop();
    let options = {
      type: 'video/webm'
    };
    //Create a new blob from the array of blobs
    let superBlob = new Blob(this.state.blobs, options);
    this.setState({
      toggleRecText: 'Start Recording',
      isRec: false,
      superBlob: superBlob,
      finishedRecording: true,
      recVidUrl: window.URL.createObjectURL(superBlob)
    });
    document.getElementById('recorded').controls = true;
  }

  uploadRec() {
    //Set the uploading to true to show the loader bar
    this.setState({
      uploading: true
    })
    //Get the pre-signed url from the server, data in promise is in the following format
    //{ preSignedUrl: examplePreSignedUrl, publicUrl: examplePublicUrl }
    getPreSignedUrl()
    .then((data) => {
      //Upload data to S3 with pre-signed url
      //extend the data object to include the superBlob
      data.superBlob = this.state.superBlob;
      return putObjectToS3(data);
    })
    .then((videoData) => {
      //Take the video's publicUrl and post to the server
      return postVideoUrl(videoData.publicUrl);
    })
    .then((code) => {
      //Set the share link and remove the spinner from the page
      this.setState({
        link: `${window.location.origin}/videos/${code}`,
        uploading: false
      });
    })
    .catch((err) => {
      throw err;
    });
  }

  //function for when a user clicks the next button, they receive another question
  nextQuestion() {
    //this if statement implies that there is at least 1 question
    if (this.state.allQuestions.length > 0) {
      this.setState({
        currentQuestion: this.state.allQuestions.shift().txt,
        allQuestions: this.state.allQuestions
      });
    } else {
      //if there are no more questions in the array, tell this to the user.
      this.setState({
        currentQuestion: 'Tentatively there are no more questions!'
      });
    }
  }
}
