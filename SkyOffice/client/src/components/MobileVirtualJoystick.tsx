import { useEffect, useState } from 'react'
import styled from 'styled-components'
import JoystickItem from './Joystick'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

import { useAppSelector } from '../hooks'
import { JoystickMovement } from './Joystick'

const Backdrop = styled.div`
  position: fixed;
  bottom: 100px;
  right: 24px;
  max-height: 50%;
  max-width: calc(100% - 24px);
  z-index: 20;
  pointer-events: none;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;

  @media (max-width: 650px) {
    bottom: 88px;
    left: 16px;
    right: auto;
    max-width: calc(100% - 32px);
  }
`

const Wrapper = styled.div`
  position: relative;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
`

const JoystickWrapper = styled.div`
  margin-top: auto;
  align-self: flex-end;
  pointer-events: auto;
  touch-action: none;

  @media (max-width: 650px) {
    align-self: flex-start;
  }
`
export const minimumScreenWidthSize = 650 //px

const isSmallScreen = (smallScreenSize: number) => {
  const [width, setWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return width <= smallScreenSize
}

export default function MobileVirtualJoystick() {
  const showJoystick = useAppSelector((state) => state.user.showJoystick)
  const showChat = useAppSelector((state) => state.chat.showChat)
  const hasSmallScreen = isSmallScreen(minimumScreenWidthSize)
  const game = phaserGame.scene.keys.game as Game | undefined

  const shouldShowJoystick = !(showChat && hasSmallScreen) && showJoystick

  const handleMovement = (movement: JoystickMovement) => {
    game.myPlayer?.handleJoystickMovement(movement)
  }

  if (!shouldShowJoystick) return null

  return (
    <Backdrop>
      <Wrapper>
        <JoystickWrapper>
          <JoystickItem onDirectionChange={handleMovement}></JoystickItem>
        </JoystickWrapper>
      </Wrapper>
    </Backdrop>
  )
}
