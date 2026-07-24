import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, email, message } = req.body

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  const { error } = await resend.emails.send({
    from: 'Tally Bug Report <noreply@georgeclinkscalesdev.com>',
    to: 'georgeclinkscalesdev@proton.me',
    replyTo: email,
    subject: `Bug Report from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
  })

  if (error) {
    return res.status(500).json({ error: 'Failed to send message' })
  }

  return res.status(200).json({ success: true })
}
