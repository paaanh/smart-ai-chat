import Peer, { type MediaConnection } from 'peerjs'
import Network from '../services/Network'
import store from '../stores'
import { setVideoConnected } from '../stores/UserStore'

export default class WebRTC {
  private myPeer: Peer
  private peers = new Map<string, { call: MediaConnection; video: HTMLVideoElement }>()
  private onCalledPeers = new Map<string, { call: MediaConnection; video: HTMLVideoElement }>()
  private pendingPeerIds = new Set<string>()
  private videoGrid = document.querySelector('.video-grid')
  private buttonGrid = document.querySelector('.button-grid')
  private myVideo = document.createElement('video')
  private myStream?: MediaStream
  private mediaRequest?: Promise<MediaStream | undefined>
  private peerOpen = false
  private buttonsSetUp = false
  private network: Network

  constructor(userId: string, network: Network) {
    const sanitizedId = this.replaceInvalidId(userId)
    this.myPeer = new Peer(sanitizedId)
    this.network = network
    console.log('userId:', userId)
    console.log('sanitizedId:', sanitizedId)
    this.myPeer.on('open', () => {
      this.peerOpen = true
      this.flushPendingCalls()
    })
    this.myPeer.on('error', (err) => {
      console.log(err.type)
      console.error(err)
    })

    // mute your own video stream (you don't want to hear yourself)
    this.myVideo.muted = true

    // config peerJS
    this.initialize()
  }

  // PeerJS throws invalid_id error if it contains some characters such as that colyseus generates.
  // https://peerjs.com/docs.html#peer-id
  private replaceInvalidId(userId: string) {
    return userId.replace(/[^0-9a-z]/gi, 'G')
  }

  initialize() {
    this.myPeer.on('call', (call) => {
      if (!this.onCalledPeers.has(call.peer)) {
        const video = document.createElement('video')
        this.onCalledPeers.set(call.peer, { call, video })

        call.on('stream', (userVideoStream) => {
          this.addVideoStream(video, userVideoStream)
        })
        call.on('close', () => {
          video.remove()
          this.onCalledPeers.delete(call.peer)
        })
        call.on('error', () => {
          video.remove()
          this.onCalledPeers.delete(call.peer)
        })

        this.getUserMedia(false).then((stream) => {
          if (stream) call.answer(stream)
          else call.close()
        })
      }
      // on close is triggered manually with deleteOnCalledVideoStream()
    })
  }

  // check if permission has been granted before
  checkPreviousPermission() {
    const permissionName = 'microphone' as PermissionName
    navigator.permissions?.query({ name: permissionName }).then((result) => {
      if (result.state === 'granted') this.getUserMedia(false)
    })
  }

  getUserMedia(alertOnError = true): Promise<MediaStream | undefined> {
    if (this.myStream) return Promise.resolve(this.myStream)
    if (this.mediaRequest) return this.mediaRequest
    if (!navigator.mediaDevices?.getUserMedia) {
      if (alertOnError) window.alert('No webcam or microphone found, or permission is blocked')
      return Promise.resolve(undefined)
    }

    // ask the browser to get user media
    this.mediaRequest = navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        this.myStream = stream
        this.addVideoStream(this.myVideo, this.myStream)
        if (!this.buttonsSetUp) {
          this.setUpButtons()
          this.buttonsSetUp = true
        }
        store.dispatch(setVideoConnected(true))
        this.network.videoConnected()
        this.flushPendingCalls()
        return stream
      })
      .catch((error) => {
        console.error('[WebRTC] getUserMedia failed:', error)
        if (alertOnError) window.alert('No webcam or microphone found, or permission is blocked')
        return undefined
      })
      .finally(() => {
        this.mediaRequest = undefined
      })

    return this.mediaRequest || Promise.resolve(undefined)
  }

  // method to call a peer
  connectToNewUser(userId: string): boolean {
    const sanitizedId = this.replaceInvalidId(userId)
    if (this.peers.has(sanitizedId) || this.onCalledPeers.has(sanitizedId)) return true

    if (!this.myStream || !this.peerOpen) {
      this.pendingPeerIds.add(userId)
      this.getUserMedia(false)
      return true
    }

    console.log('calling', sanitizedId)
    const call = this.myPeer.call(sanitizedId, this.myStream)
    const video = document.createElement('video')
    this.peers.set(sanitizedId, { call, video })

    call.on('stream', (userVideoStream) => {
      this.addVideoStream(video, userVideoStream)
    })
    call.on('close', () => {
      video.remove()
      this.peers.delete(sanitizedId)
    })
    call.on('error', () => {
      video.remove()
      this.peers.delete(sanitizedId)
    })

    return true
  }

  private flushPendingCalls() {
    if (!this.peerOpen || !this.myStream || this.pendingPeerIds.size === 0) return
    const ids = [...this.pendingPeerIds]
    this.pendingPeerIds.clear()
    ids.forEach((id) => this.connectToNewUser(id))
  }

  // method to add new video stream to videoGrid div
  addVideoStream(video: HTMLVideoElement, stream: MediaStream) {
    video.srcObject = stream
    video.playsInline = true
    video.autoplay = true
    video.addEventListener('loadedmetadata', () => {
      video.play().catch((error) => {
        console.warn('Autoplay blocked for media element. Click the video to resume playback.', error)
      })
    })
    if (this.videoGrid) this.videoGrid.append(video)
  }

  // method to remove video stream (when we are the host of the call)
  deleteVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    this.pendingPeerIds.delete(userId)
    this.pendingPeerIds.delete(sanitizedId)
    if (this.peers.has(sanitizedId)) {
      const peer = this.peers.get(sanitizedId)
      peer?.call.close()
      peer?.video.remove()
      this.peers.delete(sanitizedId)
    }
  }

  // method to remove video stream (when we are the guest of the call)
  deleteOnCalledVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    this.pendingPeerIds.delete(userId)
    this.pendingPeerIds.delete(sanitizedId)
    if (this.onCalledPeers.has(sanitizedId)) {
      const onCalledPeer = this.onCalledPeers.get(sanitizedId)
      onCalledPeer?.call.close()
      onCalledPeer?.video.remove()
      this.onCalledPeers.delete(sanitizedId)
    }
  }

  // method to set up mute/unmute and video on/off buttons
  setUpButtons() {
    const audioButton = document.createElement('button')
    audioButton.innerText = 'Mute'
    audioButton.addEventListener('click', () => {
      if (this.myStream) {
        const audioTrack = this.myStream.getAudioTracks()[0]
        if (audioTrack.enabled) {
          audioTrack.enabled = false
          audioButton.innerText = 'Unmute'
        } else {
          audioTrack.enabled = true
          audioButton.innerText = 'Mute'
        }
      }
    })
    const videoButton = document.createElement('button')
    videoButton.innerText = 'Video off'
    videoButton.addEventListener('click', () => {
      if (this.myStream) {
        const audioTrack = this.myStream.getVideoTracks()[0]
        if (audioTrack.enabled) {
          audioTrack.enabled = false
          videoButton.innerText = 'Video on'
        } else {
          audioTrack.enabled = true
          videoButton.innerText = 'Video off'
        }
      }
    })
    this.buttonGrid?.append(audioButton)
    this.buttonGrid?.append(videoButton)
  }
}
