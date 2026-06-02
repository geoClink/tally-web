import { useEffect, useRef, useState } from 'react'

export default function useVoiceControl({ onCommand }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    setSupported(true)

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase().trim()
      setTranscript(text)
      onCommand(text)
    }

    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
  }, [])

  function toggleListening() {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      setTranscript('')
      recognitionRef.current.start()
      setListening(true)
    }
  }

  return { listening, supported, transcript, toggleListening }
}
