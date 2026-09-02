export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    app: 'biblioteca-ee11',
    environment: 'vercel'
  });
}
