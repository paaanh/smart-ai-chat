import Peer, { type MediaConnection } from 'peerjs'
import store from '../stores'
import { setMyStream, addVideoStream, removeVideoStream } from '../stores/ComputerStore'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

export default class ShareScreenManager {
  private myPeer: Peer
  private peerOpen = false
  private pendingUserIds = new Set<string>()
  private outboundCalls = new Map<string, MediaConnection>()
  private retryTimers = new Map<string, number>()
  private openWaiters: Array<() => void> = []
  myStream?: MediaStream

  constructor(private userId: string) {
    const sanatizedId = this.makeId(userId)
    this.myPeer = new Peer(sanatizedId)
    this.myPeer.on('open', () => {
      this.peerOpen = true
      this.openWaiters.splice(0).forEach((resolve) => resolve())
      this.flushPendingUsers()
    })
    this.myPeer.on('disconnected', () => {
      this.peerOpen = false
    })
    this.myPeer.on('close', () => {
      this.peerOpen = false
    })
    this.myPeer.on('error', (err) => {
      console.log('ShareScreenWebRTC err.type', err.type)
      console.error('ShareScreenWebRTC', err)
    })

    this.myPeer.on('call', (call) => {
      call.answer()

      call.on('stream', (userVideoStream) => {
        store.dispatch(addVideoStream({ id: call.peer, call, stream: userVideoStream }))
      })
      call.on('close', () => {
        store.dispatch(removeVideoStream(call.peer))
      })
      call.on('error', () => {
        store.dispatch(removeVideoStream(call.peer))
      })
      // we handled on close on our own
    })
  }

  onOpen() {
    if (this.myPeer.disconnected) {
      this.myPeer.reconnect()
    }
    this.flushPendingUsers()
  }

  waitUntilOpen(timeoutMs = 1500) {
    if (this.peerOpen && !this.myPeer.disconnected) return Promise.resolve()

    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        this.openWaiters = this.openWaiters.filter((waiter) => waiter !== done)
        resolve()
      }, timeoutMs)
      const done = () => {
        window.clearTimeout(timer)
        resolve()
      }
      this.openWaiters.push(done)
    })
  }

  onClose() {
    this.stopScreenShare(false)
    this.clearOutboundCalls()
    this.myPeer.disconnect()
  }

  // PeerJS throws invalid_id error if it contains some characters such as that colyseus generates.
  // https://peerjs.com/docs.html#peer-id
  // Also for screen sharing ID add a `-ss` at the end.
  private makeId(id: string) {
    return `${id.replace(/[^0-9a-z]/gi, 'G')}-ss`
  }

  startScreenShare() {
    // @ts-ignore
    navigator.mediaDevices
      ?.getDisplayMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        // Detect when user clicks "Stop sharing" outside of our UI.
        // https://stackoverflow.com/a/25179198
        const track = stream.getVideoTracks()[0]
        if (track) {
          track.onended = () => {
            this.stopScreenShare()
          }
        }

        this.myStream = stream
        store.dispatch(setMyStream(stream))
        this.flushPendingUsers()

        // Call all existing users.
        const game = phaserGame.scene.keys.game as Game
        const computerItem = game.computerMap.get(store.getState().computer.computerId!)
        if (computerItem) {
          for (const userId of computerItem.currentUsers) {
            this.onUserJoined(userId)
          }
        }
      })
  }

  // TODO(daxchen): Fix this trash hack, if we call store.dispatch here when calling
  // from onClose, it causes redux reducer cycle, this may be fixable by using thunk
  // or something.
  stopScreenShare(shouldDispatch = true) {
    this.myStream?.getTracks().forEach((track) => track.stop())
    this.myStream = undefined
    this.pendingUserIds.clear()
    this.clearOutboundCalls()
    if (shouldDispatch) {
      store.dispatch(setMyStream(null))
      // Manually let all other existing users know screen sharing is stopped
      const game = phaserGame.scene.keys.game as Game
      game.network.onStopScreenShare(store.getState().computer.computerId!)
    }
  }

  onUserJoined(userId: string) {
    if (!this.myStream || userId === this.userId) return

    if (!this.peerOpen || this.myPeer.disconnected) {
      this.pendingUserIds.add(userId)
      if (this.myPeer.disconnected) this.myPeer.reconnect()
      return
    }

    this.callUser(userId)
  }

  onUserLeft(userId: string) {
    if (userId === this.userId) return

    const sanatizedId = this.makeId(userId)
    this.pendingUserIds.delete(userId)
    const retryTimer = this.retryTimers.get(sanatizedId)
    if (retryTimer) {
      window.clearTimeout(retryTimer)
      this.retryTimers.delete(sanatizedId)
    }
    const outboundCall = this.outboundCalls.get(sanatizedId)
    outboundCall?.close()
    this.outboundCalls.delete(sanatizedId)
    store.dispatch(removeVideoStream(sanatizedId))
  }

  private flushPendingUsers() {
    if (!this.myStream || !this.peerOpen || this.myPeer.disconnected) return
    const userIds = [...this.pendingUserIds]
    this.pendingUserIds.clear()
    userIds.forEach((userId) => this.callUser(userId))
  }

  private callUser(userId: string, retryCount = 0) {
    if (!this.myStream || userId === this.userId) return

    const sanatizedId = this.makeId(userId)
    if (this.outboundCalls.has(sanatizedId)) return

    const call = this.myPeer.call(sanatizedId, this.myStream)
    this.outboundCalls.set(sanatizedId, call)

    call.on('close', () => {
      this.outboundCalls.delete(sanatizedId)
    })
    call.on('error', () => {
      this.outboundCalls.delete(sanatizedId)
      if (!this.myStream || retryCount >= 5) return

      const retryTimer = window.setTimeout(() => {
        this.retryTimers.delete(sanatizedId)
        this.callUser(userId, retryCount + 1)
      }, 500 * (retryCount + 1))
      this.retryTimers.set(sanatizedId, retryTimer)
    })
  }

  private clearOutboundCalls() {
    this.retryTimers.forEach((timer) => window.clearTimeout(timer))
    this.retryTimers.clear()
    this.outboundCalls.forEach((call) => call.close())
    this.outboundCalls.clear()
  }
}
