import {Component, NgZone} from '@angular/core';
import {Movie} from '../movie';
import {LoadingController} from '@ionic/angular';
import * as RecordRTC from 'recordrtc';
import {environment} from '../../environments/environment';

declare var webkitSpeechRecognition: any;
declare var speechRecognition: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {
  movies: Movie[] = [];
  matches: string[] = [];
  private recorder: RecordRTC;
  isRecording = false;

  isWebSpeechRecording = false;

  constructor(private readonly ngZone: NgZone,
              private readonly loadingCtrl: LoadingController) {
  }

  async movieSearch(searchTerms: string[]) {
    if (searchTerms && searchTerms.length > 0) {

      const loading = await this.loadingCtrl.create({
        message: 'Please wait...'
      });
      loading.present();

      this.matches = searchTerms;
      let queryParams = '';
      searchTerms.forEach(term => {
        queryParams += `term=${term}&`;
      });
      const response = await fetch(`${environment.serverUrl}/search?${queryParams}`);
      const matchingMovies = await response.json();
      loading.dismiss();
      this.ngZone.run(() => this.movies = matchingMovies);
    } else {
      this.movies = [];
    }
  }

  async searchCordova() {
    const hasPermission = await speechRecognition.hasPermission();
    if (!hasPermission) {
      await speechRecognition.requestPermission();
    }

    speechRecognition.startListening().subscribe(async terms => this.movieSearch(terms));
  }

  searchWebSpeech() {
    if (!('webkitSpeechRecognition' in window)) {
      return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;

    recognition.onstart = () => this.ngZone.run(() => this.isWebSpeechRecording = true);
    recognition.onerror = event => console.log('error', event);
    recognition.onend = () => this.ngZone.run(() => this.isWebSpeechRecording = false);

    recognition.onresult = event => {
      const terms = [];
      if (event.results) {
        for (const result of event.results) {
          for (const ra of result) {
            terms.push(ra.transcript);
          }
        }
      }

      this.movieSearch(terms);
    };

    recognition.start();
  }


  async searchGoogleCloudSpeech() {
    if (this.isRecording) {
      if (this.recorder) {
        this.recorder.stopRecording(async audioVideoWebMURL => {
          const recordedBlob = this.recorder.getBlob();

          const headers = new Headers();
          headers.append('Content-Type', 'application/octet-stream');

          const requestParams = {
            headers,
            method: 'POST',
            body: recordedBlob
          };
          const response = await fetch(`${environment.serverUrl}/uploadSpeech`, requestParams);
          const searchTerms = await response.json();
          this.movieSearch(searchTerms);

        });
      }
      this.isRecording = false;
    } else {
      this.isRecording = true;
      const stream = await navigator.mediaDevices.getUserMedia({video: false, audio: true});
      const options = {
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder
      };
      this.recorder = RecordRTC(stream, options);
      this.recorder.startRecording();

    }
  }


}